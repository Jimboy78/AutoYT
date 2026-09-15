"""Utilidades de DB compartidas (commit con reintentos, etc.)."""
from __future__ import annotations
import time
from sqlalchemy.orm import Session

__all__ = ["commit_with_retry"]

def commit_with_retry(db: Session, retries: int = 5, base_sleep: float = 0.1):
    """Commit con reintentos exponenciales.

    Evita fallar de forma definitiva ante bloqueos transitorios (ej. sqlite busy).
    """
    last_err = None
    for i in range(retries):
        try:
            db.commit(); return
        except Exception as e:  # noqa: BLE001
            last_err = e
            try:
                db.rollback()
            except Exception:
                pass
            time.sleep(base_sleep * (2 ** i))
    if last_err:
        raise last_err
