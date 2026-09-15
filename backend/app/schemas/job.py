from pydantic import BaseModel, ConfigDict
from enum import Enum

class JobType(str, Enum):
    upload_ingest = "upload_ingest"
    transcode_normalize = "transcode_normalize"
    detect_events = "detect_events"
    cut_clips = "cut_clips"

class JobState(str, Enum):
    queued = "queued"
    running = "running"
    success = "success"
    failed = "failed"

class JobRead(BaseModel):
    id: int
    type: JobType
    state: JobState
    tries: int
    message: str | None
    video_id: int | None
    model_config = ConfigDict(from_attributes=True)
