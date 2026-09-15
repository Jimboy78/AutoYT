"""Router legacy que encapsula los endpoints antiguos basados en IDs string.
Refactor incremental: mantiene compatibilidad mientras se unifica el modelo.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.orm import Session
import asyncio, json, os, uuid, threading
from urllib.parse import quote
from typing import Optional, List

from ...db import get_db, SessionLocal
from ...models import VideoModel, JobModel, ClipModel
from ...schemas.legacy import (
    Video, Clip, Job, Transcription, Segment,
    InitUploadIn, InitUploadOut, ConfirmIn, ProcessResponse, JobType, JobStatus,
)
from ...core.paths import UPLOAD_DIR
from ...utils.db import commit_with_retry
from ...services.clipping import analyze_and_cut
from ...services.ffmpeg_service import probe_duration, transcode_baseline
from ...services.job_runner_inmemory import runner as job_runner, Work
from ...services.metadata_service import VideoMetadataService
from ...services.transcription_service import TranscriptionService, whisper_model_name

router = APIRouter(prefix="/legacy", tags=["legacy"], responses={404: {"description": "Not found"}})

_jobs: dict[str, Job] = {}
_jobs_lock = threading.Lock()
_pending_uploads: dict[str, str] = {}
_persisted_progress: dict[str, tuple[str, float]] = {}


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
    tr = TranscriptionService(db).repo.latest_for_video(video_id)
    return Video(id=vm.id, filename=vm.filename, status=vm.status, url=vm.url, duration=vm.duration, transcription_status=tr.status if tr else None)

@router.get("/videos", response_model=List[Video], deprecated=True)
def list_videos(db: Session = Depends(get_db)):
    rows = db.query(VideoModel).order_by(VideoModel.created_at.desc()).all()
    return [Video(id=r.id, filename=r.filename, status=r.status, url=r.url, duration=r.duration) for r in rows]

@router.post("/videos/{video_id}/refresh-metadata", response_model=Video, deprecated=True)
def refresh_metadata(video_id: str, db: Session = Depends(get_db)):
    vm = db.get(VideoModel, video_id)
    if not vm:
        raise HTTPException(404, "Video not found")
    path = _media_path(vm)
    if not os.path.exists(path):
        raise HTTPException(400, "Video file not present in uploads directory")
    VideoMetadataService(db).enrich(vm, path)
    return Video(id=vm.id, filename=vm.filename, status=vm.status, url=vm.url, duration=vm.duration)


def _media_path(vm: VideoModel) -> str:
    """Transcoded file when the pipeline already produced it, else the original upload."""
    name, _ = os.path.splitext(vm.filename)
    transcoded = os.path.join(UPLOAD_DIR, f"{name}.transcoded.mp4")
    return transcoded if os.path.exists(transcoded) else os.path.join(UPLOAD_DIR, vm.filename)


# ---------- Jobs reales (ffmpeg + detector de energía) ----------

def _persist_job(job: Job) -> None:
    """Mirror runner state into the jobs table; progress writes are throttled to ~2 % steps."""
    last = _persisted_progress.get(job.id)
    if last and last[0] == job.status and job.progress - last[1] < 2 and job.progress < 100:
        return
    _persisted_progress[job.id] = (job.status, job.progress)
    try:
        with SessionLocal() as s:
            jm = s.get(JobModel, job.id)
            if jm is None:
                s.add(JobModel(id=job.id, video_id=job.video_id, name=job.name, type=job.type, status=job.status, progress=job.progress, error=job.error))
            else:
                jm.status = job.status; jm.progress = job.progress; jm.error = job.error
            commit_with_retry(s)
    except Exception:
        pass


def _set_video_status(video_id: str, status: str) -> None:
    try:
        with SessionLocal() as s:
            vm = s.get(VideoModel, video_id)
            if vm:
                vm.status = status
                commit_with_retry(s)
    except Exception:
        pass


def _enqueue_job(video_id: str, name: str, type_: JobType, work: Work, on_complete=None) -> Job:
    job = job_runner.enqueue(video_id=video_id, name=name, type_=type_, work=work, on_complete=on_complete, on_update=_persist_job)
    with _jobs_lock:
        _jobs[job.id] = job
    return job


@router.post("/videos/{video_id}/process", response_model=ProcessResponse, deprecated=True)
def process_video(video_id: str, sensitivity: float = 55, db: Session = Depends(get_db)):
    """Transcode to H.264/AAC (progress from ffmpeg), then detect moments and cut each into a clip."""
    vm = db.get(VideoModel, video_id)
    if not vm: raise HTTPException(404, "Video not found")
    source = os.path.join(UPLOAD_DIR, vm.filename)
    if not os.path.exists(source):
        raise HTTPException(400, "El archivo del video no está en el directorio de uploads")
    name, _ = os.path.splitext(vm.filename)
    out_name = f"{name}.transcoded.mp4"
    out_path = os.path.join(UPLOAD_DIR, out_name)

    def transcode(report):
        try:
            transcode_baseline(source, out_path, on_progress=report)
        except Exception:
            _set_video_status(video_id, "error")
            raise

    def clipping(report):
        try:
            analyze_and_cut(video_id=video_id, media_path=out_path, analysis_path=source, report=report, sensitivity=sensitivity)
        except Exception:
            _set_video_status(video_id, "error")
            raise
        _set_video_status(video_id, "processed")

    _set_video_status(video_id, "processing")
    job = _enqueue_job(video_id, vm.filename, "transcoding", transcode, on_complete=lambda: _enqueue_job(video_id, out_name, "clipping", clipping))
    return ProcessResponse(jobIds=[job.id])


def _merged_jobs(db: Session) -> list[Job]:
    """DB rows (survive restarts) overridden by live in-memory state."""
    merged: dict[str, Job] = {}
    for jm in db.query(JobModel).order_by(JobModel.created_at.desc()).all():
        st: JobStatus = jm.status if jm.status in ("pending","processing","completed","error") else "processing"
        tp: JobType = jm.type if jm.type in ("transcoding","clipping","thumbnails","upload") else "transcoding"
        merged[jm.id] = Job(id=jm.id, video_id=jm.video_id, name=jm.name, type=tp, status=st, progress=float(jm.progress or 0.0), error=jm.error)
    with _jobs_lock:
        for j in _jobs.values():
            merged[j.id] = j
    return list(merged.values())


@router.get("/jobs", response_model=List[Job], deprecated=True)
def list_jobs(db: Session = Depends(get_db)):
    return _merged_jobs(db)

# --- SSE Jobs Progress (colocado antes de /jobs/{job_id} para evitar captura por path param) ---
@router.get("/jobs/stream", deprecated=True)
async def jobs_stream(request: Request, once: bool = False, interval: float = 1.0):
    """SSE con el estado de los jobs. Termina cuando el cliente se desconecta, o tras el primer
    evento con `?once=true` (útil para tests y health checks)."""
    async def event_gen():
        last_payload = None
        while True:
            if await request.is_disconnected():
                break
            with SessionLocal() as s:
                jobs = _merged_jobs(s)
            payload = [j.model_dump() for j in jobs]
            if payload != last_payload:
                yield f"event: jobs\ndata: {json.dumps(payload)}\n\n"
                last_payload = payload
            if once:
                break
            await asyncio.sleep(max(0.2, interval))
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
    rows = db.query(ClipModel).filter(ClipModel.video_id == video_id).order_by(ClipModel.start).all()
    return [Clip(id=r.id, video_id=r.video_id, start=r.start, end=r.end, url=r.url, thumbnail_url=r.thumbnail_url, score=r.score, peak=r.peak) for r in rows]

# Upload directo (compat frontend)
@router.post("/upload/init", response_model=InitUploadOut, deprecated=True)
def init_upload_compat(req: InitUploadIn, request: Request):
    if not req.filename: raise HTTPException(400, "filename requerido")
    upload_id = str(uuid.uuid4()); _pending_uploads[upload_id] = req.filename
    # url_for resolves the full mounted path (/api/v1/legacy/...), not just the router prefix.
    url = f"{request.url_for('direct_put', upload_id=upload_id)}?filename={quote(req.filename)}"
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

# Transcripciones reales (faster-whisper)
@router.post("/transcriptions/{video_id}", response_model=Transcription, deprecated=True)
def create_transcription(video_id: str, language: str = "es", db: Session = Depends(get_db)):
    vm = db.get(VideoModel, video_id)
    if not vm:
        raise HTTPException(404, "Video not found")
    path = _media_path(vm)
    if not os.path.exists(path):
        raise HTTPException(400, "El archivo del video no está en el directorio de uploads")
    tr = TranscriptionService(db).create_and_start(video_id, language, path)
    return Transcription(id=tr.id, video_id=tr.video_id, language=tr.language, status=tr.status, model=whisper_model_name(), segments=[])

@router.get("/transcriptions/{video_id}", response_model=Transcription, deprecated=True)
def get_transcription(video_id: str, db: Session = Depends(get_db)):
    svc = TranscriptionService(db)
    tr = svc.repo.latest_for_video(video_id)
    if not tr:
        raise HTTPException(404, "Transcription not found")
    seg_rows = svc.repo.list_segments(tr.id)
    segs = [Segment(id=s.id, start=s.start, end=s.end, text=s.text, speaker=s.speaker, confidence=s.confidence) for s in seg_rows]
    status = tr.status if tr.status in ("pending","processing","completed","error") else "pending"
    return Transcription(id=tr.id, video_id=tr.video_id, language=tr.language, status=status, error=tr.error, model=whisper_model_name(), segments=segs)

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

