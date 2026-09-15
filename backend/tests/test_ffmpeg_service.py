from app.services import ffmpeg_service as fs

def test_probe_duration_nonexistent():
    assert fs.probe_duration("/path/does/not/exist.mp4") is None

def test_extract_frame_jpeg_fail():
    ok = fs.extract_frame_jpeg("/nope.mp4", 1.0, "out.jpg")
    assert ok is False
