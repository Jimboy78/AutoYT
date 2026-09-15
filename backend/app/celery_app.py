import os
from celery import Celery
from .db import SessionLocal
from .models import JobModel, VideoModel
from .services.clipping import analyze_and_cut
from .services.ffmpeg_service import transcode_baseline

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "autoyt",
    broker=REDIS_URL,
    backend=os.getenv("CELERY_RESULT_BACKEND", REDIS_URL),
)


def _progress_writer(job_id: str, lo: float, hi: float):
    """Map a stage's 0..100 into [lo, hi] of the job and persist it (throttled to 1 % steps)."""
    last = [-1.0]

    def report(percent: float):
        value = round(lo + (hi - lo) * min(100.0, max(0.0, percent)) / 100, 1)
        if value - last[0] < 1:
            return
        last[0] = value
        with SessionLocal() as db:
            job = db.get(JobModel, job_id)
            if job:
                job.progress = value
                db.commit()

    return report


@celery_app.task(name="transcode_and_clip")
def transcode_and_clip(job_id: str, video_id: str, upload_dir: str, filename: str, sensitivity: float = 55):
    """Celery task: transcodifica (0–50 %) y detecta/corta los momentos (50–100 %)."""
    in_path = os.path.join(upload_dir, filename)
    name, _ = os.path.splitext(filename)
    out_path = os.path.join(upload_dir, f"{name}.transcoded.mp4")

    with SessionLocal() as db:
        job = db.get(JobModel, job_id)
        if not job:
            return
        job.status = "processing"
        job.progress = 0.0
        db.commit()

    try:
        transcode_baseline(in_path, out_path, on_progress=_progress_writer(job_id, 0, 50))
        analyze_and_cut(video_id=video_id, media_path=out_path, analysis_path=in_path, report=_progress_writer(job_id, 50, 99), sensitivity=sensitivity)
    except Exception as exc:  # noqa: BLE001 - stored on the job
        with SessionLocal() as db:
            job = db.get(JobModel, job_id)
            if job:
                job.status = "error"
                job.error = str(exc)[:1000]
            video = db.get(VideoModel, video_id)
            if video:
                video.status = "error"
            db.commit()
        return

    with SessionLocal() as db:
        job = db.get(JobModel, job_id)
        video = db.get(VideoModel, video_id)
        if video:
            video.status = "processed"
        if job:
            job.status = "completed"
            job.progress = 100.0
        db.commit()
