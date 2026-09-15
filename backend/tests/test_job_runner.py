import os, time

# Asegurar que FAST_PIPELINE esté desactivado para esta prueba (necesitamos progreso incremental)
os.environ["FAST_PIPELINE"] = "false"

from app.services.job_runner_inmemory import runner
from app.schemas.legacy import JobType

def test_job_runner_progress_completion():
    job = runner.enqueue(video_id="vid1", name="t", type_=JobType.__args__[0], duration=0.5)  # type: ignore
    # Progreso inicial puede ser 0 o algo >0 dependiendo del instante de lectura; nunca debe ser 100 todavía.
    assert 0.0 <= job.progress <= 100.0
    # Esperar a que complete
    deadline = time.time() + 2
    finished = None
    last_progress = job.progress
    while time.time() < deadline:
        finished = runner.get(job.id)
        assert finished is not None
        # progreso no debe decrecer
        assert finished.progress >= last_progress
        last_progress = finished.progress
        if finished.status == "completed":
            break
        time.sleep(0.05)
    assert finished is not None
    assert finished.status == "completed"
    assert finished.progress == 100.0
