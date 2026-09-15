"""Servicio utilitario para operaciones ffmpeg.
Centraliza transcodificación (con progreso real), probe de metadata, cortes y snapshots.
"""
from __future__ import annotations
import subprocess
import ffmpeg
from pathlib import Path
from typing import Callable, Optional, Tuple


class FFMpegError(RuntimeError):
    pass


def probe(path: str | Path) -> Optional[dict]:
    try:
        return ffmpeg.probe(str(path))
    except Exception:
        return None


def probe_duration(path: str | Path) -> Optional[float]:
    info = probe(path)
    if not info:
        return None
    fmt = info.get("format", {})
    try:
        return float(fmt["duration"]) if "duration" in fmt else None
    except (TypeError, ValueError):
        return None


def has_video_stream(path: str | Path) -> bool:
    info = probe(path) or {}
    return any(s.get("codec_type") == "video" and s.get("disposition", {}).get("attached_pic") != 1 for s in info.get("streams", []))


def _run_with_progress(cmd: list[str], duration: Optional[float], on_progress: Optional[Callable[[float], None]]) -> None:
    """Run ffmpeg with `-progress pipe:1` and report 0..100 from the encoded timestamp."""
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    assert proc.stdout is not None
    for line in proc.stdout:
        key, _, value = line.strip().partition("=")
        # Both keys carry microseconds (out_time_ms is misnamed in ffmpeg).
        if key in ("out_time_us", "out_time_ms") and duration and on_progress:
            try:
                on_progress(min(99.0, max(0.0, int(value) / 1_000_000 / duration * 100)))
            except ValueError:
                pass
    stderr = proc.stderr.read() if proc.stderr else ""
    if proc.wait() != 0:
        raise FFMpegError(stderr.strip() or "ffmpeg falló")


def transcode_baseline(
    input_path: str | Path,
    output_path: str | Path,
    *,
    video_bitrate: str = "1500k",
    audio_bitrate: str = "128k",
    preset: str = "veryfast",
    duration: Optional[float] = None,
    on_progress: Optional[Callable[[float], None]] = None,
) -> Tuple[str, Optional[float]]:
    """Transcodifica a H.264 + AAC con faststart. Retorna (output_path, duración detectada)."""
    input_path = str(input_path)
    output_path = str(output_path)
    duration = duration or probe_duration(input_path)
    cmd = ["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", input_path]
    if has_video_stream(input_path):
        cmd += ["-c:v", "libx264", "-preset", preset, "-b:v", video_bitrate, "-pix_fmt", "yuv420p"]
    else:
        cmd += ["-vn"]
    cmd += ["-c:a", "aac", "-b:a", audio_bitrate, "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", output_path]
    _run_with_progress(cmd, duration, on_progress)
    return output_path, probe_duration(output_path)


def cut_clip(input_path: str | Path, output_path: str | Path, start: float, end: float, *, preset: str = "veryfast") -> str:
    """Frame-accurate cut (re-encoded) of [start, end] into its own MP4."""
    length = max(0.1, end - start)
    cmd = ["ffmpeg", "-nostdin", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", str(input_path), "-t", f"{length:.3f}"]
    if has_video_stream(input_path):
        cmd += ["-c:v", "libx264", "-preset", preset, "-crf", "23", "-pix_fmt", "yuv420p"]
    else:
        cmd += ["-vn"]
    cmd += ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(output_path)]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
    if proc.returncode != 0:
        raise FFMpegError(proc.stderr.strip() or "ffmpeg falló al cortar el clip")
    return str(output_path)


def extract_frame_jpeg(input_path: str | Path, time_sec: float, output_path: str | Path) -> bool:
    try:
        (
            ffmpeg
            .input(str(input_path), ss=time_sec)
            .output(str(output_path), vframes=1)
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        return Path(output_path).exists()
    except Exception:
        return False
