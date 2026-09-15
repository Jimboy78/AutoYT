from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from typing import List

class VideoStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    error = "error"

class VideoCreate(BaseModel):
    filename: str = Field(..., json_schema_extra={"example": "input.mp4"})

class VideoRead(BaseModel):
    id: int
    status: VideoStatus
    duration_seconds: float | None
    original_path: str
    normalized_path: str | None
    # Metadata técnica (puede llegar después de procesamiento)
    resolution_width: int | None = None
    resolution_height: int | None = None
    video_bitrate_kbps: int | None = None
    audio_bitrate_kbps: int | None = None
    codec_video: str | None = None
    codec_audio: str | None = None

    model_config = ConfigDict(from_attributes=True)

class ClipRead(BaseModel):
    id: int
    start: float
    end: float
    score: float | None
    model_config = ConfigDict(from_attributes=True)

class VideoDetail(VideoRead):
    clips: List[ClipRead] = []
