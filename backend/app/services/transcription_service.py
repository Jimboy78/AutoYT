"""Transcripción real con faster-whisper (CTranslate2, CPU int8).

El modelo se elige con WHISPER_MODEL (tiny/base/small/…; por defecto base) y se carga una sola vez
por proceso. Los segmentos se guardan a medida que Whisper los produce, así el cliente puede ver el
avance haciendo polling.
"""
from __future__ import annotations
import math, os, threading, uuid
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..models import TranscriptionModel, SegmentModel
from .repositories import TranscriptionRepo

_models: dict[str, object] = {}
_models_lock = threading.Lock()


def whisper_model_name() -> str:
    return os.getenv("WHISPER_MODEL", "base")


def _load_model(name: str):
    with _models_lock:
        if name not in _models:
            from faster_whisper import WhisperModel  # heavy import, only when transcribing

            _models[name] = WhisperModel(name, device="cpu", compute_type="int8")
        return _models[name]


class TranscriptionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TranscriptionRepo(db)

    def create_and_start(self, video_id: str, language: str, media_path: str) -> TranscriptionModel:
        tr = TranscriptionModel(id=str(uuid.uuid4()), video_id=video_id, language=language, status="pending")
        self.repo.add(tr)
        self.db.commit()
        threading.Thread(target=run_transcription, args=(tr.id, media_path, language), daemon=True).start()
        return tr


def run_transcription(tr_id: str, media_path: str, language: str) -> None:
    with SessionLocal() as s:
        tr = s.get(TranscriptionModel, tr_id)
        if not tr:
            return
        tr.status = "processing"
        s.commit()
        try:
            model = _load_model(whisper_model_name())
            lang = None if language in ("", "auto") else language
            segments, info = model.transcribe(media_path, language=lang, vad_filter=True, beam_size=5)  # type: ignore[attr-defined]
            if lang is None:
                tr.language = info.language
            for seg in segments:
                text = seg.text.strip()
                if not text:
                    continue
                s.add(
                    SegmentModel(
                        id=str(uuid.uuid4()),
                        transcription_id=tr_id,
                        start=round(seg.start, 3),
                        end=round(seg.end, 3),
                        text=text,
                        speaker=None,
                        confidence=round(math.exp(seg.avg_logprob), 3),
                    )
                )
                s.commit()
            tr.status = "completed"
            s.commit()
        except Exception as exc:  # noqa: BLE001 - stored for the client
            s.rollback()
            tr = s.get(TranscriptionModel, tr_id)
            if tr:
                tr.status = "error"
                tr.error = str(exc)[:1000]
                s.commit()
