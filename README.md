# AutoYT

Automated video editing pipeline for YouTube content: upload, transcoding, clip generation, thumbnails, and transcription.

## Stack

- **Backend:** FastAPI, SQLAlchemy, Alembic, Celery + Redis (optional async workers), S3/MinIO-compatible storage
- **Frontend:** Next.js dashboard ("Jimbot") — Radix UI, TailwindCSS

## Structure

- `backend/` — FastAPI service. See `backend/README.md` for endpoints and setup.
- `Jimbot/` — Next.js dashboard for upload, processing status, clip review, and analytics.
- `Docs/` — architecture and roadmap notes.

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Git Bash on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or with Docker Compose (API + worker + Redis):

```bash
cd backend
cp .env.example .env
docker compose up --build
```

## Highlights

- Presigned direct-upload flow (init → PUT → confirm) so large video files bypass the API process
- Optional Celery + Redis workers for async transcoding and thumbnail generation
- Both a frontend-compatible REST surface and a versioned `/api/v1` surface
- Pytest suite covering upload, processing, and transcription endpoints
