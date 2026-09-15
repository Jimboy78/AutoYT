from sqlalchemy import Integer, ForeignKey, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

class Clip(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("video.id", ondelete="CASCADE"), index=True)
    start: Mapped[float] = mapped_column(Float)
    end: Mapped[float] = mapped_column(Float)
    path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)

    video: Mapped["Video"] = relationship(back_populates="clips")
