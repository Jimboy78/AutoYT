import time

from app.services.job_runner_inmemory import runner


def _wait(job_id, timeout=3.0):
    deadline = time.time() + timeout
    seen = []
    while time.time() < deadline:
        job = runner.get(job_id)
        assert job is not None
        seen.append(job.progress)
        if job.status in ("completed", "error"):
            return job, seen
        time.sleep(0.02)
    raise AssertionError("job did not finish")


def test_progress_comes_from_the_work_and_never_goes_back():
    def work(report):
        for value in (10, 45, 30, 80):  # 30 arrives late and must not move progress backwards
            report(value)
            time.sleep(0.08)

    job = runner.enqueue(video_id="vid1", name="t", type_="transcoding", work=work)
    finished, seen = _wait(job.id)
    assert finished.status == "completed"
    assert finished.progress == 100.0
    assert all(b >= a for a, b in zip(seen, seen[1:])), seen
    assert 45.0 in seen or 80.0 in seen, seen


def test_failures_keep_progress_and_expose_the_error():
    completed = []

    def work(report):
        report(20)
        raise ValueError("El archivo no tiene una pista de audio legible.")

    job = runner.enqueue(video_id="vid2", name="t", type_="clipping", work=work, on_complete=lambda: completed.append(True))
    finished, _ = _wait(job.id)
    assert finished.status == "error"
    assert finished.progress == 20.0
    assert "pista de audio" in finished.error
    assert completed == []


def test_on_complete_and_updates_are_notified():
    updates = []
    done = []
    job = runner.enqueue(video_id="vid3", name="t", type_="clipping", work=lambda report: report(50), on_complete=lambda: done.append(True), on_update=lambda j: updates.append((j.status, j.progress)))
    _wait(job.id)
    deadline = time.time() + 1
    while not done and time.time() < deadline:
        time.sleep(0.02)
    assert done == [True]
    assert updates[0][0] == "processing"
    assert ("completed", 100.0) in updates
