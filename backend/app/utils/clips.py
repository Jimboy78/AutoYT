"""Utilidades relacionadas con generación de clips y miniaturas."""
from __future__ import annotations
import os, uuid
from typing import List, Tuple
from ..services.ffmpeg_service import probe_duration, extract_frame_jpeg
from ..services.metadata_service import VideoMetadataService
from ..core.paths import UPLOAD_DIR
from ..db import SessionLocal
from ..models import ClipModel, VideoModel
from ..schemas.legacy import Clip

__all__ = ["generate_clips"]

def generate_clips(*, video_id: str, out_name: str, out_path: str) -> List[Clip]:
    """Genera clips sintéticos (heurísticos) y miniaturas.

    Retorna la lista de `Clip` creados y persiste filas en DB (best-effort).
    En modo FAST (`FAST_PIPELINE=true`) evita trabajo pesado (thumbnails reales).
    """
    file_url = f"/uploads/{out_name}"; clips_local: List[Clip] = []
    dur = probe_duration(out_path) or 0
    fast = os.getenv("FAST_PIPELINE", "false").lower() in ("1","true","yes")
    if fast and dur == 0:
        dur = 5.0
    # Enriquecer metadata del video (best-effort)
    try:
        with SessionLocal() as s:
            vm_db = s.get(VideoModel, video_id)
            if vm_db:
                VideoMetadataService(s).enrich(vm_db, out_path)
    except Exception:
        pass
    windows: List[Tuple[float,float]] = []
    if dur > 0:
        clip_len = max(3.0, min(10.0, dur * 0.2)); centers = [dur*0.15, dur*0.5, dur*0.8]
        for c in centers:
            start = max(0.0, c - clip_len/2); end = min(dur, start + clip_len); windows.append((start,end))
    else:
        windows = [(0.0,10.0),(12.0,25.0),(30.0,45.0)]
    for start, end in windows:
        cid = str(uuid.uuid4()); thumb_name = f"{cid}.jpg"; thumb_path = os.path.join(UPLOAD_DIR, thumb_name)
        mid = max(0.0,(start+end)/2)
        thumb_url = None
        if not fast:
            thumb_url = f"/uploads/{thumb_name}" if extract_frame_jpeg(out_path, mid, thumb_path) else None
        clips_local.append(Clip(id=cid, video_id=video_id, start=start, end=end, url=file_url, thumbnail_url=thumb_url))
    # Persistir clips (best-effort)
    try:
        with SessionLocal() as s:
            for c in clips_local:
                if not s.get(ClipModel, c.id):
                    s.add(ClipModel(id=c.id, video_id=c.video_id, start=c.start, end=c.end, url=c.url, thumbnail_url=c.thumbnail_url))
            s.commit()
    except Exception:
        pass
    return clips_local
