import os, time, shutil, subprocess, pathlib, sys, json
import pytest
from fastapi.testclient import TestClient

# Acelerar
os.environ['FAST_PIPELINE'] = 'true'
os.environ.setdefault('JOB_RUNNER_TICK', '0.05')

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
def test_sse_first_event(tmp_path):
    # Generar video sintético
    src = tmp_path / 'sse_first.mp4'
    cmd = ['ffmpeg','-y','-f','lavfi','-i','color=c=blue:s=160x120:d=2','-f','lavfi','-i','sine=frequency=700:duration=2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p', str(src)]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with TestClient(app) as client:
        with open(src, 'rb') as f:
            files = {'file': ('sse_first.mp4', f, 'video/mp4')}
            r = client.post('/api/v1/legacy/uploads/upload_file', files=files)
        assert r.status_code == 200
        vid = r.json()['id']
        pr = client.post(f'/api/v1/legacy/videos/{vid}/process')
        assert pr.status_code == 200
        # Conectarse al stream y leer primer payload jobs
        got_data = None
        start = time.time()
        with client.stream('GET', '/api/v1/legacy/jobs/stream') as resp:
            assert resp.status_code == 200
            for line in resp.iter_lines():
                if not line:
                    if time.time() - start > 5:
                        break
                    continue
                if line.startswith('data: '):
                    raw = line[len('data: '):]
                    got_data = json.loads(raw)
                    break
                if time.time() - start > 5:
                    break
        assert isinstance(got_data, list) and len(got_data) >= 1
        job_obj = got_data[0]
        # Validar campos clave
        for key in ('id','video_id','type','status','progress'):
            assert key in job_obj
