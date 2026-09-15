from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models.job import Job, JobState, JobType
from ..core.config import get_settings
from contextlib import contextmanager

settings = get_settings()

@contextmanager
def transactional(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise

def create_job(db: Session, *, video_id: int | None, job_type: JobType) -> Job:
    job = Job(video_id=video_id, type=job_type)
    db.add(job)
    db.flush()
    return job

def next_runnable_job(db: Session) -> Job | None:
    stmt = select(Job).where(Job.state == JobState.queued).order_by(Job.id.asc()).limit(1)
    return db.execute(stmt).scalars().first()

def start_job(db: Session, job: Job) -> Job:
    job.state = JobState.running
    job.tries += 1
    db.flush()
    return job

def complete_job(db: Session, job: Job, message: str | None = None):
    job.state = JobState.success
    job.message = message

def fail_job(db: Session, job: Job, message: str):
    job.state = JobState.failed
    job.message = message

def enqueue_pipeline(db: Session, video_id: int):
    create_job(db, video_id=video_id, job_type=JobType.upload_ingest)
    create_job(db, video_id=video_id, job_type=JobType.transcode_normalize)
    create_job(db, video_id=video_id, job_type=JobType.detect_events)
    create_job(db, video_id=video_id, job_type=JobType.cut_clips)

def process_one(db: Session, handler_map: dict[JobType, callable]):
    job = next_runnable_job(db)
    if not job:
        return None
    with transactional(db):
        start_job(db, job)
    handler = handler_map.get(job.type)
    try:
        handler(db, job)  # Etapa
        with transactional(db):
            complete_job(db, job)
    except Exception as exc:  # noqa: BLE001
        with transactional(db):
            fail_job(db, job, message=str(exc))
        # Reintentos simples
        if job.tries < settings.max_retries:
            with transactional(db):
                job.state = JobState.queued
    return job
