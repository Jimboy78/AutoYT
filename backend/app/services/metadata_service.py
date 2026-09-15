"""Servicio para analizar metadata técnica de un video usando ffprobe."""
from __future__ import annotations
from typing import Optional
import ffmpeg
from sqlalchemy.orm import Session
from ..models import VideoModel

class VideoMetadataService:
    def __init__(self, db: Session):
        self.db = db

    def enrich(self, video: VideoModel, path: str) -> VideoModel:
        try:
            probe = ffmpeg.probe(path)
        except Exception:
            return video
        format_info = probe.get('format', {})
        streams = probe.get('streams', [])
        if 'duration' in format_info and (video.duration is None):
            try: video.duration = float(format_info['duration'])
            except Exception: pass
        for st in streams:
            if st.get('codec_type') == 'video':
                video.codec_video = st.get('codec_name')
                video.resolution_width = st.get('width')
                video.resolution_height = st.get('height')
                if st.get('bit_rate'):
                    try: video.video_bitrate_kbps = int(int(st['bit_rate'])/1000)
                    except Exception: pass
            elif st.get('codec_type') == 'audio':
                video.codec_audio = st.get('codec_name')
                if st.get('bit_rate'):
                    try: video.audio_bitrate_kbps = int(int(st['bit_rate'])/1000)
                    except Exception: pass
        self.db.add(video)
        try: self.db.commit()
        except Exception:
            try: self.db.rollback()
            except Exception: pass
        return video
