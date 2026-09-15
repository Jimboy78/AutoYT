from sqlalchemy import String, Integer, Enum, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from ..db.base import Base

class VideoStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    error = "error"

class Video(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    original_path: Mapped[str] = mapped_column(String(512))
    normalized_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus), default=VideoStatus.pending)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    clips: Mapped[list["Clip"]] = relationship(back_populates="video", cascade="all,delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="video", cascade="all,delete-orphan")
