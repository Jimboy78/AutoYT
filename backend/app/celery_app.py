import os
import uuid
from celery import Celery
import ffmpeg
from .db import SessionLocal
from .models import JobModel, ClipModel, VideoModel

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "autoyt",
    broker=REDIS_URL,
    backend=os.getenv("CELERY_RESULT_BACKEND", REDIS_URL),
)

@celery_app.task(name="transcode_and_clip")
def transcode_and_clip(job_id: str, video_id: str, upload_dir: str, filename: str):
    """Celery task: transcodifica un video y genera clips con miniaturas.
    Actualiza el Job en DB y crea filas en clips.
    """
    in_path = os.path.join(upload_dir, filename)
    name, _ = os.path.splitext(filename)
    out_name = f"{name}.transcoded.mp4"
    out_path = os.path.join(upload_dir, out_name)
    file_url = f"/uploads/{out_name}"

    with SessionLocal() as db:
        job = db.get(JobModel, job_id)
        if not job:
            # Nada que hacer, pero evitamos fallo
            return
        job.status = "processing"
        job.progress = 1.0
        db.commit()
        try:
            (
                ffmpeg
                .input(in_path)
                .output(out_path, vcodec="libx264", acodec="aac", video_bitrate="1500k", audio_bitrate="128k", preset="veryfast", movflags="+faststart")
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            job.progress = 50.0
            db.commit()
        except ffmpeg.Error as e:
            job.status = "error"
            job.error = e.stderr.decode("utf-8", errors="ignore") if isinstance(e.stderr, (bytes, bytearray)) else str(e)
            job.progress = 0.0
            db.commit()
            return

        # Simular clipping fijo y generar thumbnails
        # Duración con ffprobe
        dur = 0.0
        try:
            probe = ffmpeg.probe(out_path)
            dur = float(probe.get("format", {}).get("duration", 0))
        except Exception:
            dur = 0.0
        # Actualiza duración en Video si está vacía
        vid = db.get(VideoModel, video_id)
        if vid and (vid.duration is None or vid.duration == 0):
            vid.duration = dur or vid.duration
            db.commit()

        clips = []
        if dur and dur > 0:
            clip_len = max(3.0, min(10.0, dur * 0.2))
            centers = [dur * 0.15, dur * 0.5, dur * 0.8]
            windows = []
            for c in centers:
                start = max(0.0, c - clip_len / 2.0)
                end = min(dur, start + clip_len)
                windows.append((start, end))
        else:
            windows = [(0.0, 10.0), (12.0, 25.0), (30.0, 45.0)]

        for idx, (start, end) in enumerate(windows):
            cid = str(uuid.uuid4())
            thumb_name = f"{cid}.jpg"
            thumb_path = os.path.join(upload_dir, thumb_name)
            mid = max(0.0, (start + end) / 2.0)
            thumb_url = None
            try:
                (
                    ffmpeg
                    .input(out_path, ss=mid)
                    .output(thumb_path, vframes=1)
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
                thumb_url = f"/uploads/{thumb_name}"
            except Exception:
                thumb_url = None

            clips.append(ClipModel(id=cid, video_id=video_id, start=start, end=end, url=file_url, thumbnail_url=thumb_url))
            # progreso intermedio
            job.progress = 50.0 + (idx + 1) * (50.0 / max(1, len(windows)))
            db.commit()

        # Persistir clips
        for c in clips:
            if not db.get(ClipModel, c.id):
                db.add(c)
        # Actualizar video status opcionalmente
        if vid:
            vid.status = "processed"
        # Completar job
        job.status = "completed"
        job.progress = 100.0
        db.commit()
