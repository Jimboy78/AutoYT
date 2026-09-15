import os, time, shutil, pathlib, sys, unicodedata
import pytest
from fastapi.testclient import TestClient

pytest.importorskip("faster_whisper")

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT/'app') not in sys.path:
    sys.path.insert(0, str(ROOT/'app'))

from app.main import app  # noqa: E402
from app.db import Base, engine  # noqa: E402

SPEECH = ROOT / 'tests' / 'fixtures' / 'speech_es.m4a'  # 16 s of Spanish TTS


def fold(text: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if unicodedata.category(c) != 'Mn')


@pytest.fixture(scope='module', autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.mark.skipif(shutil.which('ffmpeg') is None, reason='ffmpeg no disponible en entorno')
def test_whisper_transcribes_real_speech_and_exports_srt():
    with TestClient(app) as client:
        with open(SPEECH, 'rb') as f:
            r = client.post('/api/v1/legacy/uploads/upload_file', files={'file': ('speech_es.m4a', f, 'audio/mp4')})
        assert r.status_code == 200
        vid = r.json()['id']
        assert client.get(f'/api/v1/legacy/videos/{vid}').json()['transcription_status'] is None

        tr = client.post(f'/api/v1/legacy/transcriptions/{vid}', params={'language': 'es'})
        assert tr.status_code == 200
        assert tr.json()['status'] == 'pending'

        deadline = time.time() + 240  # first call loads the model
        body = None
        while time.time() < deadline:
            body = client.get(f'/api/v1/legacy/transcriptions/{vid}').json()
            if body['status'] in ('completed', 'error'):
                break
            time.sleep(0.5)
        assert body is not None and body['status'] == 'completed', body
        assert client.get(f'/api/v1/legacy/videos/{vid}').json()['transcription_status'] == 'completed'

        segments = body['segments']
        text = fold(' '.join(s['text'] for s in segments))
        assert len(segments) >= 2, segments
        for word in ('bienvenidos', 'analizar', 'momentos'):
            assert word in text, text
        assert all(0 < s['confidence'] <= 1 for s in segments)
        assert all(0 <= s['start'] < s['end'] <= 16.5 for s in segments)

        srt = client.get(f'/api/v1/legacy/transcriptions/{vid}/srt')
        assert srt.status_code == 200
        assert '-->' in srt.text and 'bienvenidos' in fold(srt.text)


def test_transcription_of_unknown_video_is_404():
    with TestClient(app) as client:
        assert client.post('/api/v1/legacy/transcriptions/nope.mp4').status_code == 404
