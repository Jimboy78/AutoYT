from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from ....db.session import get_db
from ....models.job import Job
from ....schemas.job import JobRead

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("", response_model=list[JobRead])
def list_jobs(
    db: Session = Depends(get_db),
    video_id: int | None = Query(None),
):
    stmt = select(Job)
    if video_id is not None:
        stmt = stmt.where(Job.video_id == video_id)
    return db.execute(stmt.order_by(Job.id.desc())).scalars().all()
