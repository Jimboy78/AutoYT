"""Servicio para creación y simulación de transcripciones."""
from __future__ import annotations
import uuid, threading, time
from typing import List
from sqlalchemy.orm import Session
from ..models import TranscriptionModel, SegmentModel
from .repositories import TranscriptionRepo

BASE_TEXTS = [
    "¡Hola a todos! Bienvenidos al video.",
    "Hoy veremos algunos highlights.",
    "Esto fue increíble.",
    "Presten atención a esta jugada.",
    "El chat se volvió loco.",
    "Gracias por ver, suscríbanse.",
]

class TranscriptionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TranscriptionRepo(db)

    def create_and_simulate(self, video_id: str, language: str) -> TranscriptionModel:
        tr_id = str(uuid.uuid4())
        tr = TranscriptionModel(id=tr_id, video_id=video_id, language=language, status="pending")
        self.repo.add(tr)
        self.db.commit()
        threading.Thread(target=self._simulate, args=(tr_id, language), daemon=True).start()
        return tr

    def _simulate(self, tr_id: str, language: str):  # pragma: no cover (hilo)
        try:
            with self.db.bind.connect() as conn:  # nueva sesión aislada
                from sqlalchemy.orm import Session as _S
                s = _S(bind=conn)
                tr = s.get(TranscriptionModel, tr_id)
                if not tr: return
                tr.status = "processing"; s.commit()
                t = 0.0
                for text_line in BASE_TEXTS:
                    seg_id = str(uuid.uuid4())
                    start = t; end = t + 3.5; t = end
                    seg = SegmentModel(
                        id=seg_id,
                        transcription_id=tr_id,
                        start=start,
                        end=end,
                        text=(f"[{language}] "+text_line) if language != "es" else text_line,
                        speaker="Speaker",
                        confidence=0.9,
                    )
                    s.add(seg); s.commit()
                tr.status = "completed"; s.commit()
        except Exception:
            try:
                with self.db.bind.connect() as conn:
                    from sqlalchemy.orm import Session as _S
                    s = _S(bind=conn)
                    tr = s.get(TranscriptionModel, tr_id)
                    if tr:
                        tr.status = "error"; s.commit()
            except Exception:
                pass
