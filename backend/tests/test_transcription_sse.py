import os, time, shutil, subprocess, pathlib, sys
import pytest
from fastapi.testclient import TestClient

# Asegurar modo rápido para no ralentizar otros jobs
os.environ['FAST_PIPELINE'] = 'true'

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT/'app') not in sys.path:
    sys.path.insert(0, str(ROOT/'app'))

from app.main import app  # noqa: E402
from app.db import Base, engine  # noqa: E402

@pytest.fixture(scope='module', autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.mark.skipif(shutil.which('ffmpeg') is None, reason='ffmpeg no disponible en entorno')
def test_transcription_flow_and_sse_jobs(tmp_path):
    # Crear video sintético (2s) y subirlo
    src = tmp_path / 'sse_src.mp4'
    cmd = ['ffmpeg','-y','-f','lavfi','-i','color=c=black:s=160x120:d=2','-f','lavfi','-i','sine=frequency=500:duration=2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p', str(src)]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with TestClient(app) as client:
        with open(src, 'rb') as f:
            files = {'file': ('sse_src.mp4', f, 'video/mp4')}
            r = client.post('/api/v1/legacy/uploads/upload_file', files=files)
        assert r.status_code == 200
        vid = r.json()['id']
        # Lanzar procesamiento (creará jobs)
        pr = client.post(f'/api/v1/legacy/videos/{vid}/process')
        assert pr.status_code == 200
        # Crear transcripción
        tr = client.post(f'/api/v1/legacy/transcriptions/{vid}', params={'language':'es'})
        assert tr.status_code == 200
        # Poll transcripción hasta completed
        deadline = time.time() + 8
        status = None
        while time.time() < deadline:
            gt = client.get(f'/api/v1/legacy/transcriptions/{vid}')
            assert gt.status_code == 200
            status = gt.json()['status']
            if status == 'completed':
                break
            time.sleep(0.25)
        assert status == 'completed'
        # Comprobar al menos 3 segmentos
        segs = client.get(f'/api/v1/legacy/transcriptions/{vid}').json()['segments']
        assert len(segs) >= 3
    # Verificar que la ruta del stream exista (HEAD fallback)
    head_resp = client.head('/api/v1/legacy/jobs/stream')
    assert head_resp.status_code in (200,405)  # 405 si HEAD no implementado
