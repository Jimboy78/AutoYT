"""In-memory job runner: executes real work in a background thread and exposes its progress.

Each job runs `work(report)`; the work calls `report(percent)` as it advances (ffmpeg timestamps,
decoded audio, clips cut). The runner keeps progress monotonic, marks the job completed or failed
with the exception message, and notifies `on_update` so callers can persist the state. It can be
swapped for Celery without changing the API contract.
"""
from __future__ import annotations
import threading, uuid
from typing import Callable, Optional, Dict
from ..schemas.legacy import Job, JobType

Report = Callable[[float], None]
Work = Callable[[Report], None]


class InMemoryJobRunner:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def enqueue(
        self,
        *,
        video_id: str,
        name: str,
        type_: JobType,
        work: Work,
        on_complete: Optional[Callable[[], None]] = None,
        on_update: Optional[Callable[[Job], None]] = None,
    ) -> Job:
        job = Job(id=str(uuid.uuid4()), video_id=video_id, name=name, type=type_, status="pending", progress=0.0)
        with self._lock:
            self._jobs[job.id] = job
        threading.Thread(target=self._run, args=(job, work, on_complete, on_update), daemon=True).start()
        return job

    def _notify(self, job: Job, on_update: Optional[Callable[[Job], None]]):
        if on_update:
            try:
                on_update(job)
            except Exception:
                pass

    def _run(self, job: Job, work: Work, on_complete, on_update):
        with self._lock:
            job.status = "processing"
        self._notify(job, on_update)

        def report(percent: float):
            with self._lock:
                value = round(min(99.0, max(job.progress, float(percent))), 1)
                changed = value != job.progress
                job.progress = value
            if changed:
                self._notify(job, on_update)

        try:
            work(report)
        except Exception as exc:  # noqa: BLE001 - surfaced to the client as the job error
            with self._lock:
                job.status = "error"
                job.error = str(exc)[:1000] or exc.__class__.__name__
            self._notify(job, on_update)
            return
        with self._lock:
            job.progress = 100.0
            job.status = "completed"
        self._notify(job, on_update)
        if on_complete:
            try:
                on_complete()
            except Exception:
                pass

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        with self._lock:
            return list(self._jobs.values())


# Instancia global para reutilizar estado
runner = InMemoryJobRunner()
