from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ....db.session import get_db
from ....models.video import Video
from ....schemas.video import VideoCreate, VideoRead, VideoDetail
from ....services.jobs import enqueue_pipeline

router = APIRouter(prefix="/videos", tags=["videos"])

@router.post("", response_model=VideoRead, status_code=201)
def create_video(body: VideoCreate, db: Session = Depends(get_db)):
    video = Video(original_path=f"/data/original/{body.filename}")
    db.add(video)
    db.commit()
    db.refresh(video)
    return video

@router.post("/{video_id}/process", response_model=dict)
def process_video(video_id: int, db: Session = Depends(get_db)):
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    enqueue_pipeline(db, video_id=video.id)
    db.commit()
    return {"queued": True, "video_id": video.id}

@router.get("/{video_id}", response_model=VideoDetail)
def get_video(video_id: int, db: Session = Depends(get_db)):
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    # Lazy load clips
    _ = video.clips  # noqa: F841
    return video
