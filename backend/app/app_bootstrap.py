"""Bootstrap limpio de la aplicación FastAPI.

Responsabilidades:
 - Instanciar FastAPI.
 - Middleware de logging básico.
 - Configurar CORS (desarrollo).
 - Montar directorio estático /uploads.
 - Incluir routers modulares (si existen) y legacy.
 - Exponer /health.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import Response
import os, json, time as _time
from .core.paths import UPLOAD_DIR
from .core.config import get_settings

def _json_log(data: dict):  # pragma: no cover
    try:
        print(json.dumps(data, ensure_ascii=False))
    except Exception:
        pass

async def log_requests(request: Request, call_next):  # pragma: no cover
    start = _time.time()
    status = 500
    try:
        resp: Response = await call_next(request)  # type: ignore[name-defined]
        status = resp.status_code
        return resp
    finally:
        _json_log({
            "ts": round(start,3),
            "method": request.method,
            "path": request.url.path,
            "status": status,
            "duration_ms": int((_time.time()-start)*1000)
        })

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
)
app.middleware("http")(log_requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

try:  # Routers modulares opcionales
    from .api.v1.endpoints import videos as videos_v1, jobs as jobs_v1  # type: ignore
except Exception:  # noqa: BLE001
    videos_v1 = None
    jobs_v1 = None
from .api.v1 import legacy as legacy_router  # type: ignore

if videos_v1:
    app.include_router(videos_v1.router, prefix=settings.api_v1_prefix)
if jobs_v1:
    app.include_router(jobs_v1.router, prefix=settings.api_v1_prefix)
app.include_router(legacy_router.router, prefix=settings.api_v1_prefix)

@app.get("/health")
async def health():  # pragma: no cover
    return {"status": "ok"}

__all__ = ["app"]
