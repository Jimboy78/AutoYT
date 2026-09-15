"""Servicio de alto nivel para operaciones de Video (legacy modelo string ID)."""
from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from ..models import VideoModel
from .repositories import VideoRepo

class VideoService:
    def __init__(self, db: Session):
        self.repo = VideoRepo(db)
        self.db = db
    def get_or_create_uploaded(self, filename: str, url: str, duration: Optional[float]) -> VideoModel:
        existing = self.repo.get(filename)
        if existing:
            # actualizar duración si no existía
            if existing.duration is None and duration is not None:
                existing.duration = duration
            return existing
        video = VideoModel(id=filename, filename=filename, url=url, status="uploaded", duration=duration)
        self.repo.add(video)
        self.db.commit()
        return video
    def list(self): return self.repo.list()
    def get(self, vid: str) -> Optional[VideoModel]: return self.repo.get(vid)
