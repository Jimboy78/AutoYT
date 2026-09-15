"""Stage handlers for the DB job queue (modular models): real ffmpeg + energy detection."""
import os
from pathlib import Path
from sqlalchemy.orm import Session
from ..models.job import Job, JobType
from ..models.video import Video, VideoStatus
from ..models.clip import Clip
from .ffmpeg_service import cut_clip, probe_duration, transcode_baseline
from .highlights import HOP, detect_moments, loudest_window, measure_energy_file

# Moments found by detect_events, consumed by cut_clips within the same worker process.
_detected: dict[int, list] = {}


def _require_video(db: Session, job: Job) -> Video:
    video = db.get(Video, job.video_id)
    if not video:
        raise ValueError("Video missing")
    return video


def h_upload_ingest(db: Session, job: Job):
    video = _require_video(db, job)
    if not os.path.exists(video.original_path):
        raise FileNotFoundError(f"Original not found: {video.original_path}")
    video.status = VideoStatus.processing
    video.duration_seconds = probe_duration(video.original_path)
    db.flush()


def h_transcode_normalize(db: Session, job: Job):
    video = _require_video(db, job)
    source = Path(video.original_path)
    target = source.with_name(f"{source.stem}.normalized.mp4")
    _, duration = transcode_baseline(source, target)
    video.normalized_path = str(target)
    video.duration_seconds = duration or video.duration_seconds
    db.flush()


def h_detect_events(db: Session, job: Job):
    video = _require_video(db, job)
    media = video.normalized_path or video.original_path
    levels = measure_energy_file(media)
    duration = video.duration_seconds or levels.size * HOP
    moments = detect_moments(levels, duration)
    if not moments:
        fallback = loudest_window(levels, duration)
        moments = [fallback] if fallback else []
    _detected[video.id] = moments


def h_cut_clips(db: Session, job: Job):
    video = _require_video(db, job)
    media = video.normalized_path or video.original_path
    moments = _detected.pop(video.id, None)
    if moments is None:
        h_detect_events(db, job)
        moments = _detected.pop(video.id, [])
    out_dir = Path(media).parent / f"{Path(media).stem}_clips"
    out_dir.mkdir(parents=True, exist_ok=True)
    for moment in moments:
        path = out_dir / f"clip_{moment.id:02d}_{int(moment.start)}s.mp4"
        cut_clip(media, path, moment.start, moment.end)
        db.add(Clip(video_id=video.id, start=moment.start, end=moment.end, path=str(path), score=float(moment.score)))
    video.status = VideoStatus.ready
    db.flush()


HANDLERS = {
    JobType.upload_ingest: h_upload_ingest,
    JobType.transcode_normalize: h_transcode_normalize,
    JobType.detect_events: h_detect_events,
    JobType.cut_clips: h_cut_clips,
}
