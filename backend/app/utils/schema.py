"""Create missing tables and add columns introduced after a database was created.

The project has no migrations for the legacy (string id) tables, so existing SQLite files would fail
on new columns with "no such column". This keeps old databases usable on startup.
"""
from __future__ import annotations
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "clips": {"score": "FLOAT", "peak": "FLOAT"},
    "transcriptions": {"error": "VARCHAR"},
}


def ensure_schema(engine: Engine) -> list[str]:
    from ..db import Base
    from .. import models  # noqa: F401 - registers the tables on Base

    Base.metadata.create_all(bind=engine, checkfirst=True)
    added: list[str] = []
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            present = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in present:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
                    added.append(f"{table}.{name}")
    return added
