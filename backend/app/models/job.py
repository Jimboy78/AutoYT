from sqlalchemy import Integer, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from ..db.base import Base

class JobType(str, enum.Enum):
    upload_ingest = "upload_ingest"
    transcode_normalize = "transcode_normalize"
    detect_events = "detect_events"
    cut_clips = "cut_clips"

class JobState(str, enum.Enum):
    queued = "queued"
    running = "running"
    success = "success"
    failed = "failed"

class Job(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int | None] = mapped_column(ForeignKey("video.id", ondelete="CASCADE"), nullable=True, index=True)
    type: Mapped[JobType] = mapped_column(Enum(JobType))
    state: Mapped[JobState] = mapped_column(Enum(JobState), default=JobState.queued, index=True)
    tries: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact: Mapped[str | None] = mapped_column(String(512), nullable=True)

    video: Mapped["Video"] = relationship(back_populates="jobs")
