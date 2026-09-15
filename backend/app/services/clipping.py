"""Server-side highlight pipeline: detect loud moments in the audio, cut each one into its own MP4,
grab a thumbnail at its peak and store the clips. Shared by the in-memory runner and Celery."""
from __future__ import annotations
import os, uuid
from pathlib import Path
from typing import Callable, List, Optional

from ..core.paths import UPLOAD_DIR
from ..db import SessionLocal
from ..models import ClipModel, VideoModel
from ..schemas.legacy import Clip
from .ffmpeg_service import cut_clip, extract_frame_jpeg, has_video_stream, probe_duration
from .highlights import HOP, detect_moments, loudest_window, measure_energy_file
from .metadata_service import VideoMetadataService

Report = Callable[[float], None]


def _remove_previous(video_id: str, upload_dir: Path) -> None:
    with SessionLocal() as s:
        for row in s.query(ClipModel).filter(ClipModel.video_id == video_id).all():
            # Only files this pipeline created (named after the clip id); legacy rows pointed at the
            # whole transcoded video, which must never be deleted here.
            for ext in (".mp4", ".jpg"):
                own = upload_dir / f"{row.id}{ext}"
                if own.exists():
                    try:
                        own.unlink()
                    except OSError:
                        pass
            s.delete(row)
        s.commit()


def analyze_and_cut(
    *,
    video_id: str,
    media_path: str | Path,
    report: Optional[Report] = None,
    sensitivity: float = 55,
    upload_dir: Path = UPLOAD_DIR,
    analysis_path: str | Path | None = None,
) -> List[Clip]:
    """Detect on `analysis_path` (the original upload when available: lossy re-encoding shaves energy
    off noisy peaks and can push borderline moments under the threshold), cut from `media_path`."""
    report = report or (lambda _p: None)
    media_path = str(media_path)
    analysis_path = str(analysis_path or media_path)
    duration = probe_duration(analysis_path) or probe_duration(media_path) or 0.0

    levels = measure_energy_file(analysis_path, duration=duration or None, on_progress=lambda f: report(f * 35))
    if not duration:
        duration = levels.size * HOP
    moments = detect_moments(levels, duration, sensitivity)
    if not moments:
        fallback = loudest_window(levels, duration)
        moments = [fallback] if fallback else []
    report(40)

    _remove_previous(video_id, upload_dir)
    with_video = has_video_stream(media_path)
    clips: List[Clip] = []
    for index, moment in enumerate(moments):
        cid = str(uuid.uuid4())
        cut_clip(media_path, upload_dir / f"{cid}.mp4", moment.start, moment.end)
        thumb_url = None
        if with_video and extract_frame_jpeg(media_path, moment.peak_time, upload_dir / f"{cid}.jpg"):
            thumb_url = f"/uploads/{cid}.jpg"
        clips.append(
            Clip(id=cid, video_id=video_id, start=moment.start, end=moment.end, url=f"/uploads/{cid}.mp4", thumbnail_url=thumb_url, score=moment.score, peak=moment.peak_time)
        )
        report(40 + 58 * (index + 1) / len(moments))

    with SessionLocal() as s:
        for c in clips:
            s.add(ClipModel(id=c.id, video_id=c.video_id, start=c.start, end=c.end, url=c.url, thumbnail_url=c.thumbnail_url, score=c.score, peak=c.peak))
        s.commit()
        video = s.get(VideoModel, video_id)
        if video:
            VideoMetadataService(s).enrich(video, media_path)
    return clips


def clip_file_path(clip: Clip, upload_dir: Path = UPLOAD_DIR) -> str:
    return os.path.join(upload_dir, os.path.basename(clip.url))
