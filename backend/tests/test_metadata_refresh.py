import os, time
from app.db import SessionLocal, Base, engine
from app.models import VideoModel
from app.services.metadata_service import VideoMetadataService
import pytest

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    # Garantiza schema fresco con columnas nuevas (drop/create)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_metadata_enrich_no_file(tmp_path):
    # Crea video sin archivo real -> no rompe
    with SessionLocal() as db:
        v = VideoModel(id="v1.mp4", filename="v1.mp4", url="/uploads/v1.mp4", status="uploaded")
        db.add(v); db.commit()
        svc = VideoMetadataService(db)
        svc.enrich(v, os.path.join(str(tmp_path), 'noexists.mp4'))
        # Campos siguen None
        assert v.codec_video is None

def test_metadata_enrich_dummy_file(tmp_path):
    # Crear archivo vacío (ffprobe fallará pero no debe romper)
    dummy = tmp_path / 'dummy.mp4'
    dummy.write_bytes(b'')
    with SessionLocal() as db:
        v = VideoModel(id="v2.mp4", filename="v2.mp4", url="/uploads/v2.mp4", status="uploaded")
        db.add(v); db.commit()
        svc = VideoMetadataService(db)
        svc.enrich(v, str(dummy))
        assert v.id == "v2.mp4"
