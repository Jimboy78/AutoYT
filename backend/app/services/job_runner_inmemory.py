"""In-memory job runner (simulación) usado durante el MVP.
Abstrae la lógica de progreso y callbacks para poder reemplazarlo por Celery u otro backend.
"""
from __future__ import annotations
import threading, time, uuid, os
from typing import Callable, Optional, Dict
from pydantic import BaseModel
from ..schemas.legacy import Job, JobType, JobStatus

class _JobState(BaseModel):
    job: Job
    on_complete: Optional[Callable[[], None]] = None
    duration: float = 6.0
    started_at: float

class InMemoryJobRunner:
    def __init__(self):
        self._jobs: Dict[str, _JobState] = {}
        self._lock = threading.Lock()

    def enqueue(self, *, video_id: str, name: str, type_: JobType, duration: float = 6.0, on_complete: Optional[Callable[[], None]] = None) -> Job:
        jid = str(uuid.uuid4())
        fast = os.getenv("FAST_PIPELINE", "false").lower() in ("1","true","yes")
        job = Job(id=jid, video_id=video_id, name=name, type=type_, status="processing" if not fast else "completed", progress=0.0 if not fast else 100.0)
        state = _JobState(job=job, on_complete=on_complete, duration=duration, started_at=time.time())
        with self._lock:
            self._jobs[jid] = state
        if fast:
            # Ejecutar callback inmediatamente de forma segura
            if on_complete:
                try:
                    on_complete()
                except Exception:
                    pass
            return job
        t = threading.Thread(target=self._runner_loop, args=(jid,), daemon=True)
        t.start()
        return job

    def _runner_loop(self, jid: str):
        while True:
            with self._lock:
                state = self._jobs.get(jid)
                if not state:
                    return
                job = state.job
                if job.status == "error":
                    return
                elapsed = time.time() - state.started_at
                progress = min(100.0, (elapsed / state.duration) * 100.0)
                job.progress = progress
                job.status = "completed" if progress >= 100.0 else "processing"
                state.job = job
                self._jobs[jid] = state
            if progress >= 100.0:
                cb = state.on_complete
                if cb:
                    try:
                        cb()
                    except Exception:
                        pass
                return
            tick = float(os.getenv("JOB_RUNNER_TICK", "0.2"))
            time.sleep(tick)

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            st = self._jobs.get(job_id)
            return st.job if st else None

    def list(self) -> list[Job]:
        with self._lock:
            return [st.job for st in self._jobs.values()]

# Instancia global para reutilizar estado
runner = InMemoryJobRunner()
