from sqlalchemy.orm import Session
from ..models.job import Job, JobType
from ..models.video import Video, VideoStatus
from ..models.clip import Clip

def h_upload_ingest(db: Session, job: Job):
    video = db.get(Video, job.video_id)
    if not video:
        raise ValueError("Video missing")
    video.status = VideoStatus.processing
    # TODO: almacenar archivo real, checksum, metadata inicial
    db.flush()

def h_transcode_normalize(db: Session, job: Job):
    video = db.get(Video, job.video_id)
    if not video:
        raise ValueError("Video missing")
    # TODO: ffmpeg transcode; aquí se simula
    video.normalized_path = video.original_path.replace("original", "normalized")
    video.duration_seconds = 600.0  # Simulado
    db.flush()

def h_detect_events(db: Session, job: Job):
    # TODO: analizar waveform / energía / silencios y guardar features (tabla futura)
    pass

def h_cut_clips(db: Session, job: Job):
    video = db.get(Video, job.video_id)
    if not video or video.duration_seconds is None:
        raise ValueError("Video missing/duration unknown")
    # Heurística simple: 3 clips equidistantes
    base = video.duration_seconds
    segments = [(0, min(30, base/3)), (base/3, base/3 + 30), (2*base/3, 2*base/3 + 30)]
    for start, end in segments:
        clip = Clip(video_id=video.id, start=start, end=min(end, base), score=None)
        db.add(clip)
    video.status = VideoStatus.ready
    db.flush()

HANDLERS = {
    JobType.upload_ingest: h_upload_ingest,
    JobType.transcode_normalize: h_transcode_normalize,
    JobType.detect_events: h_detect_events,
    JobType.cut_clips: h_cut_clips,
}
