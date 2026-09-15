# AutoYT

Finds the best moments of a VOD and turns them into Shorts, montages, thumbnails, subtitles and a ready-to-paste YouTube package.

**Live:** https://autoyt-studio.vercel.app — every tool runs in your browser; nothing is uploaded.

## What works

| Tool | How |
| --- | --- |
| **Studio** | Web Audio decodes the track; RMS per 50 ms, linear-power smoothing and a robust z-score (median/MAD over frames with sound) find the loud moments. Waveform timeline, chapters, frame scoring. |
| **Shorts Forge** | 9:16 clips rendered with Canvas + MediaRecorder (MP4/H.264 when the browser supports it): motion-tracked reframing, hook sticker, audio bars, karaoke captions from the transcript. |
| **Transcripciones** | Whisper (tiny/base/small) in a Web Worker via transformers.js, word timings, voice-activity tightening, search, inline edit, SRT/VTT/TXT. |
| **Editor de Ritmo** | Montage timeline from moments across videos; BPM detection (onset envelope + autocorrelation + comb refinement) snaps cuts to beats; transitions, speed, render. |
| **Conversión** | 16:9 / 9:16 / 1:1 / 4:5 reframing (crop, blurred background, bars), lossless WAV export, equivalent ffmpeg command. |
| **Thumbnail Lab** | Frames scored by brightness, contrast and colorfulness; three layouts; feed preview at real sizes; PNG saved to the library. |
| **YouTube** | Title ideas, description with chapters and hashtags, tags from transcript keywords, validated against YouTube limits (100/5000/500 chars, chapter rules). |
| **Galería / Procesamiento / Analytics** | IndexedDB library shared by every page, task monitor with cancel, analytics computed from the library. |

## Backend (optional)

`backend/` is a FastAPI service the dashboard uses when `NEXT_PUBLIC_API_BASE` is set:

- Presigned direct upload (`init → PUT → confirm`)
- ffmpeg transcode with progress parsed from `-progress`
- The same energy detector ported to numpy (streaming decode), each moment cut into its own MP4 with a thumbnail at its peak and a score
- faster-whisper transcription (`WHISPER_MODEL`, default `base`), SRT/VTT
- In-memory job runner or Celery + Redis; SSE job stream

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# frontend
cd ../Jimbot && NEXT_PUBLIC_API_BASE=http://localhost:8000 pnpm dev
```

Tests: `pytest` (uses its own temporary SQLite database).

## Structure

- `Jimbot/` — Next.js 15 dashboard (React 19, Tailwind, Radix)
- `backend/` — FastAPI, SQLAlchemy, Celery, ffmpeg, faster-whisper
