"""Modelos legacy basados en IDs string (coexisten con modelos modulares nuevos)."""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base

class VideoModel(Base):
    __tablename__ = "videos"
    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    url = Column(String, nullable=False)
    status = Column(String, default="uploaded")
    duration = Column(Float)  # segundos
    resolution_width = Column(Integer, nullable=True)
    resolution_height = Column(Integer, nullable=True)
    video_bitrate_kbps = Column(Integer, nullable=True)
    audio_bitrate_kbps = Column(Integer, nullable=True)
    codec_video = Column(String, nullable=True)
    codec_audio = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    jobs = relationship("JobModel", back_populates="video")
    clips = relationship("ClipModel", back_populates="video")

class JobModel(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, index=True)
    video_id = Column(String, ForeignKey("videos.id"), index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    progress = Column(Float, default=0.0)
    error = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    video = relationship("VideoModel", back_populates="jobs")

class ClipModel(Base):
    __tablename__ = "clips"
    id = Column(String, primary_key=True, index=True)
    video_id = Column(String, ForeignKey("videos.id"), index=True)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)
    url = Column(String, nullable=False)
    thumbnail_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    video = relationship("VideoModel", back_populates="clips")

class TranscriptionModel(Base):
    __tablename__ = "transcriptions"
    id = Column(String, primary_key=True, index=True)
    video_id = Column(String, ForeignKey("videos.id"), index=True)
    language = Column(String, default="es")
    status = Column(String, default="pending")
    error = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    video = relationship("VideoModel")
    segments = relationship("SegmentModel", back_populates="transcription")

class SegmentModel(Base):
    __tablename__ = "segments"
    id = Column(String, primary_key=True, index=True)
    transcription_id = Column(String, ForeignKey("transcriptions.id"), index=True)
    start = Column(Float, nullable=False)
    end = Column(Float, nullable=False)
    text = Column(Text, nullable=False)
    speaker = Column(String)
    confidence = Column(Float, default=0.9)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transcription = relationship("TranscriptionModel", back_populates="segments")
