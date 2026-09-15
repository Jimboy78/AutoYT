"""Delegación mínima: preserva el import histórico `app.main:app`.

El bootstrap real vive en `app_bootstrap.py`.
"""
from .app_bootstrap import app  # noqa: F401

__all__ = ["app"]
