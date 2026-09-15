"""Rutas centrales reutilizadas en la app (evita duplicaciones)."""
from __future__ import annotations
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # app/
UPLOAD_DIR = (BASE_DIR / 'uploads').resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

__all__ = ["UPLOAD_DIR", "BASE_DIR"]
