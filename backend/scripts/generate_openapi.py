"""Script para generar el JSON OpenAPI del backend y guardarlo en /openapi.json."""
from __future__ import annotations
import json, os, sys
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.main import app  # noqa: E402

def main():
    with TestClient(app) as client:
        schema = app.openapi()
        out_path = os.path.join(os.path.dirname(__file__), '..', 'openapi.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(schema, f, ensure_ascii=False, indent=2)
        print(f"OpenAPI escrito en {out_path}")

if __name__ == "__main__":
    main()
