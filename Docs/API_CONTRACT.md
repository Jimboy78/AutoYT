# API Contract (MVP)

## Health

- GET /health -> { status: "ok" }

## Uploads

- POST /api/v1/uploads/presign

  - in: { filename, contentType?, size? }
  - out: { url, fields }
  - Nota: En MVP devuelve ruta del backend para POST directo con multipart/form-data.

- POST /api/v1/uploads/upload_file

  - form-data: file: UploadFile
  - out: Video { id, filename, status, url, duration? }

  - POST /api/v1/uploads/complete (modo S3/MinIO)
    - in: { filename, contentType?, size? }
    - out: Video { id, filename, status, url, duration? }

## Videos

- GET /api/v1/videos/:id

  - out: Video { id, filename, status, url, duration? }

- GET /api/v1/videos

  - out: Video[]

- POST /api/v1/videos/:id/process

  - out: { jobIds: string[] }

- GET /api/v1/videos/:id/clips
  - out: Clip[]

## Jobs

- GET /api/v1/jobs
  - out: Job[]
- GET /api/v1/jobs/:id
  - out: Job

## Próximos (plan)

- POST /api/v1/transcriptions/:videoId -> Transcription { id, video_id, language, status }
- GET /api/v1/transcriptions/:videoId -> Transcription { id, video_id, language, status, segments[] }
- GET /api/v1/transcriptions/:videoId/srt -> archivo SRT
- GET /api/v1/transcriptions/:videoId/vtt -> archivo VTT
- POST /api/v1/youtube/auth, /callback, /upload
