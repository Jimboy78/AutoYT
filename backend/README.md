# AutoYT Backend (FastAPI)

Procesamiento real del lado servidor: transcodificación con ffmpeg, detección de momentos por energía de audio (el mismo algoritmo que el Studio del navegador, portado a numpy), cortes de cada momento en su propio MP4 con miniatura y transcripción con faster-whisper.

## Requisitos

- Python 3.11+
- ffmpeg / ffprobe en el PATH

## Instalación (Git Bash en Windows)

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El frontend lo usa con `NEXT_PUBLIC_API_BASE=http://localhost:8000`.

## Endpoints (`/api/v1/legacy`, usados por el dashboard)

| Método | Ruta | Qué hace |
| --- | --- | --- |
| POST | `/upload/init` → `PUT /upload/direct/{id}` → `POST /upload/confirm` | Subida directa del archivo |
| POST | `/uploads/upload_file` | Subida multipart simple |
| GET | `/videos`, `/videos/{id}` | Videos y estado (`uploaded`, `processing`, `processed`, `error`) |
| POST | `/videos/{id}/process?sensitivity=55` | Job `transcoding` (progreso real de ffmpeg) y al terminar job `clipping` |
| GET | `/videos/{id}/clips` | Clips cortados: `url` al MP4 propio, `thumbnail_url`, `score` 0..100, `peak` |
| GET | `/jobs`, `/jobs/{id}` | Estado vivo (memoria) + persistido (DB) |
| GET | `/jobs/stream` | SSE con el estado de los jobs; `?once=true` emite un snapshot y cierra |
| POST/GET | `/transcriptions/{id}` | faster-whisper; los segmentos se guardan a medida que salen |
| GET | `/transcriptions/{id}/srt`, `/vtt` | Exportación |

## Pipeline

1. **Transcode**: H.264 + AAC con `+faststart`; el progreso sale de `-progress pipe:1` (`out_time_us / duración`).
2. **Detección** (`app/services/highlights.py`): decodifica el audio **original** en streaming a 48 kHz mono, RMS por ventana de 50 ms, suavizado en potencia lineal ±0.3 s, z-score robusto (mediana/MAD sobre los frames con sonido), umbral `4 − sensibilidad·3/100`, fusión de picos cercanos y padding. Si no hay picos destacados, usa la ventana más fuerte.
3. **Cortes** (`app/services/clipping.py`): cada momento re-encodeado a su MP4, miniatura JPG en el pico, filas en `clips` con score.
4. **Transcripción** (`app/services/transcription_service.py`): faster-whisper CPU int8 con VAD; confianza = `exp(avg_logprob)`.

Con Celery (`app/celery_app.py`, tarea `transcode_and_clip`) se ejecuta el mismo pipeline y el progreso se escribe en la tabla `jobs`.

## Variables de entorno

| Variable | Propósito | Default |
| --- | --- | --- |
| `DATABASE_URL` | URL de SQLAlchemy | `sqlite:///./autoyt.db` |
| `WHISPER_MODEL` | Modelo de faster-whisper (`tiny`, `base`, `small`, …) | `base` |
| `REDIS_URL` | Broker de Celery | `redis://localhost:6379/0` |

Las columnas nuevas (`clips.score`, `clips.peak`) se agregan solas al arrancar sobre bases SQLite existentes (`app/utils/schema.py`).

## Con Docker + Celery (opcional)

1. Copiá `.env.example` a `.env`
2. `docker compose up --build`
3. Backend: http://localhost:8000

## Tests

```bash
pytest -q
```

Usan una base SQLite temporal propia (ver `tests/conftest.py`), nunca la de desarrollo. Cubren el detector (curvas sintéticas y audio real decodificado por ffmpeg), el runner de jobs, el pipeline completo con cortes verificados por ffprobe, el SSE y una transcripción real de `tests/fixtures/speech_es.m4a`.
