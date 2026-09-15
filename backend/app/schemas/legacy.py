from pydantic import BaseModel
from typing import Optional, List, Literal, Dict

# Pydantic models legacy (string IDs basadas en filename / uuid)
class Video(BaseModel):
    id: str
    filename: str
    status: str = "uploaded"
    url: str
    duration: Optional[float] = None
    # Latest transcription state, so clients know whether there is one to fetch.
    transcription_status: Optional[str] = None

class Clip(BaseModel):
    id: str
    video_id: str
    start: float
    end: float
    url: str
    thumbnail_url: Optional[str] = None
    score: Optional[float] = None
    peak: Optional[float] = None

JobType = Literal["transcoding", "clipping", "thumbnails", "upload"]
JobStatus = Literal["pending", "processing", "completed", "error"]

class Job(BaseModel):
    id: str
    video_id: str
    name: str
    type: JobType
    status: JobStatus
    progress: float = 0.0
    error: Optional[str] = None

class Segment(BaseModel):
    id: str
    start: float
    end: float
    text: str
    speaker: Optional[str] = None
    confidence: float = 0.9

class Transcription(BaseModel):
    id: str
    video_id: str
    language: str = "es"
    status: Literal["pending", "processing", "completed", "error"] = "pending"
    error: Optional[str] = None
    model: Optional[str] = None
    segments: List[Segment] = []

# Upload / presign models
class PresignRequest(BaseModel):
    filename: str
    contentType: Optional[str] = None
    size: Optional[int] = None

class PresignResponse(BaseModel):
    url: str
    method: str = "POST"
    fields: Dict[str, str] = {}
    headers: Dict[str, str] = {}

class CompleteUploadRequest(BaseModel):
    filename: str
    contentType: Optional[str] = None
    size: Optional[int] = None

class InitUploadIn(BaseModel):
    filename: str
    contentType: Optional[str] = None
    size: Optional[int] = None

class InitUploadOut(BaseModel):
    uploadId: str
    url: str

class ConfirmIn(BaseModel):
    uploadId: str

class ProcessResponse(BaseModel):
    jobIds: List[str]
