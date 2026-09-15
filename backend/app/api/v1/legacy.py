"""Router legacy que encapsula los endpoints antiguos basados en IDs string.
Refactor incremental: mantiene compatibilidad mientras se unifica el modelo.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import os, uuid, time, threading
from typing import Optional, List

from ...db import get_db, SessionLocal, Base, engine
# NOTE: Endpoints presign/complete retirados temporalmente; reintroducir si se requiere S3 multi-part
# from ...storage import get_storage, ensure_bucket_exists
from ...models import VideoModel, JobModel, ClipModel, TranscriptionModel, SegmentModel
from ...schemas.legacy import (
    Video, Clip, Job, Transcription, Segment,
    InitUploadIn, InitUploadOut, ConfirmIn, ProcessResponse
)

router = APIRouter(prefix="/legacy", tags=["legacy"], responses={404: {"description": "Not found"}})

from ...core.paths import UPLOAD_DIR

_jobs: dict[str, Job] = {}
_jobs_lock = threading.Lock()
_clips: dict[str, list[Clip]] = {}
_pending_uploads: dict[str, str] = {}

# Utilidad commit con reintentos
from fastapi import BackgroundTasks
from ...utils.db import commit_with_retry


@router.post("/uploads/upload_file", response_model=Video, deprecated=True)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    duration = probe_duration(path)
    vid = Video(id=file.filename, filename=file.filename, url=f"/uploads/{file.filename}", duration=duration)
    vm = db.get(VideoModel, vid.id)
    if not vm:
        vm = VideoModel(id=vid.id, filename=vid.filename, url=vid.url, status=vid.status, duration=duration)
        db.add(vm); commit_with_retry(db)
    return vid

@router.get("/videos/{video_id}", response_model=Video, deprecated=True)
def get_video(video_id: str, db: Session = Depends(get_db)):
    vm = db.get(VideoModel, video_id)
    if not vm: raise HTTPException(404, "Video not found")
    return Video(id=vm.id, filename=vm.filename, status=vm.status, url=vm.url, duration=vm.duration)

@router.get("/videos", response_model=List[Video], deprecated=True)
def list_videos(db: Session = Depends(get_db)):
    rows = db.query(VideoModel).order_by(VideoModel.created_at.desc()).all()
    return [Video(id=r.id, filename=r.filename, status=r.status, url=r.url, duration=r.duration) for r in rows]

@router.post("/videos/{video_id}/refresh-metadata", response_model=Video, deprecated=True)
def refresh_metadata(video_id: str, db: Session = Depends(get_db)):
    vm = db.get(VideoModel, video_id)
    if not vm:
        raise HTTPException(404, "Video not found")
    # Determinar ruta local preferida (transcoded si existe)
    name, ext = os.path.splitext(vm.filename)
    transcoded = os.path.join(UPLOAD_DIR, f"{name}.transcoded.mp4")
    original = os.path.join(UPLOAD_DIR, vm.filename)
    path = transcoded if os.path.exists(transcoded) else original
    if not os.path.exists(path):
        raise HTTPException(400, "Video file not present in uploads directory")
    VideoMetadataService(db).enrich(vm, path)
    return Video(id=vm.id, filename=vm.filename, status=vm.status, url=vm.url, duration=vm.duration)

# Jobs simulados
from ...schemas.legacy import JobType, JobStatus
from ...services.ffmpeg_service import probe_duration, transcode_baseline, FFMpegError
from ...services.job_runner_inmemory import runner as job_runner
from ...services.transcription_service import TranscriptionService
from ...services.metadata_service import VideoMetadataService
from ...utils.clips import generate_clips as generate_clips_util
from fastapi import Response
from starlette.responses import StreamingResponse

def _enqueue_job(video_id: str, name: str, type_: JobType, duration: float = 2.0, on_complete=None, db: Session | None = None) -> Job:
    job = job_runner.enqueue(video_id=video_id, name=name, type_=type_, duration=duration, on_complete=on_complete)
    # Persistir representación
    if db is not None:
        jm = JobModel(id=job.id, video_id=video_id, name=name, type=type_, status=job.status, progress=job.progress)
        db.add(jm)
        try: commit_with_retry(db)
        except Exception: pass
    with _jobs_lock:
        _jobs[job.id] = job
    return job

@router.post("/videos/{video_id}/process", response_model=ProcessResponse, deprecated=True)
def process_video(video_id: str, db: Session = Depends(get_db)):
    vm = db.get(VideoModel, video_id)
    if not vm: raise HTTPException(404, "Video not found")
    video = Video(id=vm.id, filename=vm.filename, status=vm.status, url=vm.url)
    def run_ffmpeg_transcode():
        in_path = os.path.join(UPLOAD_DIR, video.filename)
        name, _ = os.path.splitext(video.filename)
        out_name = f"{name}.transcoded.mp4"; out_path = os.path.join(UPLOAD_DIR, out_name)
        fast = os.getenv("FAST_PIPELINE", "false").lower() in ("1","true","yes")
        if fast:
            # Copia rápida o touch de archivo de salida
            try:
                if os.path.exists(in_path):
                    import shutil; shutil.copyfile(in_path, out_path)
                else:
                    with open(out_path, 'wb') as f: f.write(b'')
            except Exception:
                pass
        else:
            try:
                transcode_baseline(in_path, out_path)
            except FFMpegError as e:
                with _jobs_lock:
                    for j in _jobs.values():
                        if j.video_id == video_id and j.type == "transcoding" and j.status == "processing":
                            j.status = "error"; j.error = str(e); j.progress = 0.0
                            try:
                                with SessionLocal() as s:
                                    jm = s.get(JobModel, j.id)
                                    if jm: jm.status = "error"; jm.error = j.error; jm.progress = 0.0; s.commit()
                            except Exception: pass
                return
        def after_clipping():
            # Generar clips usando util centralizado
            clips_created = generate_clips_util(video_id=video_id, out_name=out_name, out_path=out_path)
            with _jobs_lock:
                _clips[video_id] = clips_created
        clip_duration = 0.2 if os.getenv("FAST_PIPELINE", "false").lower() in ("1","true","yes") else 5.0
        _enqueue_job(video_id, out_name, "clipping", duration=clip_duration, on_complete=after_clipping, db=db)
    trans_duration = 0.2 if os.getenv("FAST_PIPELINE", "false").lower() in ("1","true","yes") else 2.5
    trans_job = _enqueue_job(video_id, video.filename, "transcoding", duration=trans_duration, on_complete=run_ffmpeg_transcode, db=db)
    return ProcessResponse(jobIds=[trans_job.id])

@router.get("/jobs", response_model=List[Job], deprecated=True)
def list_jobs(db: Session = Depends(get_db)):
    """Listar jobs combinando estado vivo en memoria y filas persistidas.

    Antes: si existía al menos una fila en DB se ignoraban los estados en memoria
    (progreso, status actualizado) provocando que los tests nunca vieran jobs
    completados. Ahora se fusionan y siempre prevalece el estado in-memory.
    """
    db_rows = db.query(JobModel).order_by(JobModel.created_at.desc()).all()
    merged: dict[str, Job] = {}
    # Primero DB (persistencia básica)
    for jm in db_rows:
        st: JobStatus = jm.status if jm.status in ("pending","processing","completed","error") else "processing"
        tp: JobType = jm.type if jm.type in ("transcoding","clipping","thumbnails","upload") else "transcoding"
        merged[jm.id] = Job(id=jm.id, video_id=jm.video_id, name=jm.name, type=tp, status=st, progress=float(jm.progress or 0.0), error=jm.error)
    # Luego override con estado en memoria (fuente de verdad actualizada)
    with _jobs_lock:
        for j in _jobs.values():
            merged[j.id] = j
    # Ordenar por created_at si lo tenemos en DB, sino mantener inserción
    return list(merged.values())

# --- SSE Jobs Progress (colocado antes de /jobs/{job_id} para evitar captura por path param) ---
@router.get("/jobs/stream", deprecated=True)
async def jobs_stream(db: Session = Depends(get_db)):
    """Stream de eventos SSE con estado de jobs (legacy + DB persistidos)."""
    import asyncio, json
    async def event_gen():
        last_payload = None
        while True:
            with _jobs_lock:
                mem_jobs = list(_jobs.values())
            db_jobs = db.query(JobModel).order_by(JobModel.created_at.desc()).all()
            merged: dict[str, Job] = {}
            for j in db_jobs:
                merged[j.id] = Job(id=j.id, video_id=j.video_id, name=j.name, type=j.type, status=j.status, progress=float(j.progress or 0.0), error=j.error)
            for j in mem_jobs:
                merged.setdefault(j.id, j)
            payload = [{"id": j.id, "video_id": j.video_id, "type": j.type, "status": j.status, "progress": j.progress, "error": j.error} for j in merged.values()]
            if payload != last_payload:
                data = json.dumps(payload)
                yield f"event: jobs\ndata: {data}\n\n"
                last_payload = payload
            await asyncio.sleep(1.0)
    return StreamingResponse(event_gen(), media_type="text/event-stream")

@router.get("/jobs/{job_id}", response_model=Job, deprecated=True)
def get_job(job_id: str, db: Session = Depends(get_db)):
    """Obtener job preferenciando estado vivo en memoria si existe."""
    with _jobs_lock:
        mem_job = _jobs.get(job_id)
    if mem_job:
        return mem_job
    jm = db.get(JobModel, job_id)
    if not jm:
        raise HTTPException(404, "Job not found")
    st: JobStatus = jm.status if jm.status in ("pending","processing","completed","error") else "processing"
    tp: JobType = jm.type if jm.type in ("transcoding","clipping","thumbnails","upload") else "transcoding"
    return Job(id=jm.id, video_id=jm.video_id, name=jm.name, type=tp, status=st, progress=float(jm.progress or 0.0), error=jm.error)

@router.get("/videos/{video_id}/clips", response_model=List[Clip], deprecated=True)
def get_clips(video_id: str, db: Session = Depends(get_db)):
    with _jobs_lock:
        memory_clips = _clips.get(video_id)
    if memory_clips:
        for c in memory_clips:
            if not db.get(ClipModel, c.id):
                db.add(ClipModel(id=c.id, video_id=c.video_id, start=c.start, end=c.end, url=c.url, thumbnail_url=c.thumbnail_url))
        try: commit_with_retry(db)
        except Exception:
            try: db.rollback()
            except Exception: pass
        return memory_clips
    db_rows = db.query(ClipModel).filter(ClipModel.video_id==video_id).all()
    return [Clip(id=r.id, video_id=r.video_id, start=r.start, end=r.end, url=r.url, thumbnail_url=r.thumbnail_url) for r in db_rows]

# Upload directo (compat frontend)
@router.post("/upload/init", response_model=InitUploadOut, deprecated=True)
def init_upload_compat(req: InitUploadIn, request: Request):
    if not req.filename: raise HTTPException(400, "filename requerido")
    upload_id = str(uuid.uuid4()); _pending_uploads[upload_id] = req.filename
    base = str(request.base_url).rstrip("/")
    url = f"{base}{router.prefix}/upload/direct/{upload_id}?filename={req.filename}"
    return InitUploadOut(uploadId=upload_id, url=url)

@router.put("/upload/direct/{upload_id}", deprecated=True)
async def direct_put(upload_id: str, request: Request, filename: Optional[str] = None):
    fname = filename or _pending_uploads.get(upload_id) or f"{upload_id}.bin"
    _pending_uploads.setdefault(upload_id, fname)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    path = os.path.join(UPLOAD_DIR, fname)
    data = await request.body()
    with open(path, "wb") as f: f.write(data)
    return {"ok": True, "filename": fname}

@router.post("/upload/confirm", deprecated=True)
def confirm_upload_compat(body: ConfirmIn, db: Session = Depends(get_db)):
    fname = _pending_uploads.get(body.uploadId)
    if not fname: raise HTTPException(400, "uploadId desconocido")
    path = os.path.join(UPLOAD_DIR, fname)
    if not os.path.exists(path): raise HTTPException(400, "archivo no encontrado")
    duration = probe_duration(path)
    url = f"/uploads/{fname}"
    vm = db.get(VideoModel, fname)
    if not vm:
        vm = VideoModel(id=fname, filename=fname, url=url, status="uploaded", duration=duration)
        db.add(vm); commit_with_retry(db)
    return {"videoId": fname}

# Transcripciones simuladas
@router.post("/transcriptions/{video_id}", response_model=Transcription, deprecated=True)
def create_transcription(video_id: str, language: str = "es", db: Session = Depends(get_db)):
    vm = db.get(VideoModel, video_id)
    if not vm:
        raise HTTPException(404, "Video not found")
    svc = TranscriptionService(db)
    tr = svc.create_and_simulate(video_id, language)
    return Transcription(id=tr.id, video_id=tr.video_id, language=tr.language, status=tr.status, segments=[])

@router.get("/transcriptions/{video_id}", response_model=Transcription, deprecated=True)
def get_transcription(video_id: str, db: Session = Depends(get_db)):
    svc = TranscriptionService(db)
    tr = svc.repo.latest_for_video(video_id)
    if not tr:
        raise HTTPException(404, "Transcription not found")
    seg_rows = svc.repo.list_segments(tr.id)
    segs = [Segment(id=s.id, start=s.start, end=s.end, text=s.text, speaker=s.speaker, confidence=s.confidence) for s in seg_rows]
    status = tr.status if tr.status in ("pending","processing","completed","error") else "pending"
    return Transcription(id=tr.id, video_id=tr.video_id, language=tr.language, status=status, segments=segs)

@router.get("/transcriptions/{video_id}/srt", deprecated=True)
def download_srt(video_id: str, db: Session = Depends(get_db)):
    svc = TranscriptionService(db)
    tr = svc.repo.latest_for_video(video_id)
    if not tr:
        raise HTTPException(404, "Transcription not found")
    seg_rows = svc.repo.list_segments(tr.id)
    lines=[]
    for i,s in enumerate(seg_rows, start=1):
        lines.append(str(i)); lines.append(f"{_fmt_time_srt(s.start)} --> {_fmt_time_srt(s.end)}"); lines.append(s.text); lines.append("")
    content="\n".join(lines); resp=PlainTextResponse(content, media_type="text/plain; charset=utf-8"); resp.headers["Content-Disposition"]=f"attachment; filename={video_id}.srt"; return resp

@router.get("/transcriptions/{video_id}/vtt", deprecated=True)
def download_vtt(video_id: str, db: Session = Depends(get_db)):
    svc = TranscriptionService(db)
    tr = svc.repo.latest_for_video(video_id)
    if not tr:
        raise HTTPException(404, "Transcription not found")
    seg_rows = svc.repo.list_segments(tr.id)
    lines=["WEBVTT",""]
    for s in seg_rows:
        lines.append(f"{_fmt_time_vtt(s.start)} --> {_fmt_time_vtt(s.end)}"); lines.append(s.text); lines.append("")
    content="\n".join(lines); resp=PlainTextResponse(content, media_type="text/vtt; charset=utf-8"); resp.headers["Content-Disposition"]=f"attachment; filename={video_id}.vtt"; return resp

# Helpers formato tiempo

def _fmt_time_srt(t: float) -> str:
    h=int(t//3600); m=int((t%3600)//60); s=int(t%60); ms=int((t-int(t))*1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def _fmt_time_vtt(t: float) -> str:
    h=int(t//3600); m=int((t%3600)//60); s=int(t%60); ms=int((t-int(t))*1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

## stream movido arriba

## generate_clips ahora vive en app.utils.clips
