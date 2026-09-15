"""Servicio utilitario para operaciones ffmpeg.
Centraliza transcodificación, probe de metadata y generación de snapshots.
"""
from __future__ import annotations
import ffmpeg
from pathlib import Path
from typing import Optional, Tuple

class FFMpegError(RuntimeError):
    pass

def probe_duration(path: str | Path) -> Optional[float]:
    try:
        result = ffmpeg.probe(str(path))
        fmt = result.get("format", {})
        if "duration" in fmt:
            return float(fmt["duration"])  # segundos
    except Exception:
        return None
    return None

def transcode_baseline(input_path: str | Path, output_path: str | Path, *, video_bitrate: str = "1500k", audio_bitrate: str = "128k", preset: str = "veryfast") -> Tuple[str, Optional[float]]:
    """Transcodifica a H.264 + AAC baseline con faststart.
    Retorna (output_path, duration_detectada)
    """
    input_path = str(input_path); output_path = str(output_path)
    try:
        (
            ffmpeg
            .input(input_path)
            .output(output_path, vcodec="libx264", acodec="aac", video_bitrate=video_bitrate, audio_bitrate=audio_bitrate, preset=preset, movflags="+faststart")
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
    except ffmpeg.Error as e:  # pragma: no cover - logging futuro
        stderr = e.stderr.decode("utf-8", errors="ignore") if isinstance(e.stderr, (bytes, bytearray)) else str(e)
        raise FFMpegError(stderr) from e
    return output_path, probe_duration(output_path)

def extract_frame_jpeg(input_path: str | Path, time_sec: float, output_path: str | Path) -> bool:
    try:
        (
            ffmpeg
            .input(str(input_path), ss=time_sec)
            .output(str(output_path), vframes=1)
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        return True
    except Exception:
        return False
