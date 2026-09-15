"""Repositorios simples para aislar acceso a modelos ORM.
Facilitan pruebas y futura migración de DB.
"""
from __future__ import annotations
from typing import Optional, Sequence
from sqlalchemy.orm import Session
from ..models import VideoModel, JobModel, ClipModel, TranscriptionModel, SegmentModel

class VideoRepo:
    def __init__(self, db: Session):
        self.db = db
    def get(self, vid: str) -> Optional[VideoModel]:
        return self.db.get(VideoModel, vid)
    def list(self) -> Sequence[VideoModel]:
        return self.db.query(VideoModel).order_by(VideoModel.created_at.desc()).all()
    def add(self, video: VideoModel):
        self.db.add(video)

class JobRepo:
    def __init__(self, db: Session): self.db = db
    def add(self, job: JobModel): self.db.add(job)
    def get(self, jid: str) -> Optional[JobModel]: return self.db.get(JobModel, jid)
    def list(self): return self.db.query(JobModel).order_by(JobModel.created_at.desc()).all()

class ClipRepo:
    def __init__(self, db: Session): self.db = db
    def add(self, clip: ClipModel): self.db.add(clip)
    def list_by_video(self, video_id: str):
        return self.db.query(ClipModel).filter(ClipModel.video_id==video_id).all()

class TranscriptionRepo:
    def __init__(self, db: Session): self.db = db
    def latest_for_video(self, video_id: str) -> Optional[TranscriptionModel]:
        return (
            self.db.query(TranscriptionModel)
            .filter(TranscriptionModel.video_id==video_id)
            .order_by(TranscriptionModel.created_at.desc())
            .first()
        )
    def add(self, tr: TranscriptionModel): self.db.add(tr)
    def add_segment(self, seg: SegmentModel): self.db.add(seg)
    def list_segments(self, transcription_id: str):
        return (
            self.db.query(SegmentModel)
            .filter(SegmentModel.transcription_id==transcription_id)
            .order_by(SegmentModel.start.asc())
            .all()
        )
