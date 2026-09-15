from app.services.video_service import VideoService
from app.db import SessionLocal, Base, engine
from app.models import VideoModel
import pytest

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_get_or_create_video():
    with SessionLocal() as db:
        svc = VideoService(db)
        v1 = svc.get_or_create_uploaded("fileA.mp4", "/uploads/fileA.mp4", 10.0)
        assert isinstance(v1, VideoModel)
        v2 = svc.get_or_create_uploaded("fileA.mp4", "/uploads/fileA.mp4", 10.0)
        assert v1.id == v2.id
