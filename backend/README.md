# AutoYT Backend (FastAPI)

## Requisitos

- Python 3.11+

## Instalación

### Ejecutar en Git Bash (Windows)

```bash
cd "/d/Escritorio/Projects J/Projects J/AutoYT/backend"
python -m venv .venv
source .venv/Scripts/activate    # Git Bash en Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints (compatibles con el frontend)

- Salud: GET /health
- Upload (compat):
  - POST /api/upload/init → { uploadId, url } (url acepta PUT con el archivo)
  - PUT /api/upload/direct/{uploadId}?filename=NAME
  - POST /api/upload/confirm → { videoId }
- Procesamiento y clips (compat):
  - POST /api/video/:videoId/process → { taskId }
  - GET /api/video/:videoId/clips → [{ id, start, end, thumbnail_url? }]
- API v1 (originales):
  - POST /api/v1/uploads/presign
  - POST /api/v1/uploads/complete
  - POST /api/v1/uploads/upload_file
  - GET /api/v1/videos/:id
  - GET /api/v1/videos/:id/clips
  - POST /api/v1/videos/:id/process
  - Transcripciones: /api/v1/transcriptions/\*

## Notas

- CORS abierto para desarrollo (ajustar en prod).
- Los archivos se guardan en backend/uploads/.
- Si usas S3/MinIO, configura USE_S3=true y variables AWS/S3.

## Variables de entorno

- DATABASE_URL: URL de SQLAlchemy (por defecto SQLite local)
- USE_CELERY: true/false para usar worker de Celery (por defecto false)
- REDIS_URL: URL de Redis para Celery (por defecto redis://localhost:6379/0)

## Con Docker + Celery (opcional)

1. Copia .env.example a .env
2. `docker compose up --build`
3. Backend: http://localhost:8000

El servicio `worker` ejecuta las tareas de transcodificación y generación de miniaturas.

## Flags de entorno clave (pipeline rápido)

| Variable          | Propósito                                                                                    | Valores                            |
| ----------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| `FAST_PIPELINE`   | Acelera jobs (transcoding/clipping completan instantáneo; clips sintéticos y sin thumbnails) | `true` / `false` (default `false`) |
| `JOB_RUNNER_TICK` | Intervalo en segundos para actualizar progreso del runner in-memory                          | flotante (default `0.2`)           |
| `USE_S3`          | Activa flujo de descarga/confirmación desde S3/minio en endpoints legacy                     | `true` / `false`                   |

Cuando `FAST_PIPELINE=true` se prioriza velocidad sobre exactitud de metadata; la extracción de frame para thumbnails se omite.

## Tests

La configuración `pytest.ini` limita la recolección a `tests/` evitando ejecutar tests de librerías en `Lib/site-packages`.

Ejecutar suite:

```bash
pytest -q
```

Para un test que requiera progreso real (no instantáneo) forzar `FAST_PIPELINE=false` dentro del propio archivo (ver `tests/test_job_runner.py`).
