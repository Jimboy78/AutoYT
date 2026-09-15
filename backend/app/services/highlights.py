"""Audio-energy highlight detection.

Port of the Studio's in-browser detector (Jimbot/lib/studio/analyze.ts) so the server pipeline and
the browser find the same moments: RMS level per 50 ms window, smoothed in linear power, compared
with the video's own baseline using a robust z-score (median/MAD over frames that carry sound).
"""
from __future__ import annotations

import math
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

import numpy as np

HOP = 0.05  # analysis window, seconds


class AudioDecodeError(RuntimeError):
    pass


@dataclass
class Highlight:
    id: int
    start: float
    end: float
    peak_time: float
    peak_z: float
    score: int


def threshold_for(sensitivity: float) -> float:
    """sensitivity 0..100 → z-score threshold 4..1."""
    return 4 - (min(100.0, max(0.0, sensitivity)) / 100) * 3


def _median(values: np.ndarray) -> float:
    # Same convention as the browser (upper median) so both sides agree on even-sized inputs.
    if values.size == 0:
        return 0.0
    return float(np.sort(values)[values.size // 2])


def _js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def measure_energy_file(
    path: str | Path,
    *,
    rate: int = 48000,
    duration: Optional[float] = None,
    on_progress: Optional[Callable[[float], None]] = None,
) -> np.ndarray:
    """Decode the audio track with ffmpeg as a stream and return dB per HOP window.

    Streaming keeps memory flat for long VODs (an hour at 48 kHz would be ~700 MB as one array).
    """
    win = max(1, round(rate * HOP))
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    levels: list[float] = []
    carry = np.zeros(0, dtype=np.float32)
    chunk_bytes = win * 2 * 20  # one second of audio per read
    try:
        while True:
            raw = proc.stdout.read(chunk_bytes)
            if not raw:
                break
            data = np.frombuffer(raw[: len(raw) - (len(raw) % 2)], dtype=np.int16).astype(np.float32) / 32768.0
            if carry.size:
                data = np.concatenate([carry, data])
            frames = data.size // win
            if frames:
                block = data[: frames * win].reshape(frames, win)
                rms = np.sqrt(np.mean(block * block, axis=1))
                levels.extend((20 * np.log10(rms + 1e-6)).tolist())
            carry = data[frames * win :]
            if on_progress and duration:
                on_progress(min(1.0, len(levels) * HOP / duration))
    finally:
        stderr = proc.stderr.read().decode("utf-8", errors="ignore") if proc.stderr else ""
        code = proc.wait()
    if code != 0:
        raise AudioDecodeError(stderr.strip() or f"ffmpeg salió con código {code}")
    if not levels:
        raise AudioDecodeError("El archivo no tiene una pista de audio legible.")
    return np.asarray(levels, dtype=np.float32)


def robust_z(db: np.ndarray) -> tuple[np.ndarray, float]:
    n = db.size
    k = max(1, round(0.3 / HOP))
    # Smooth in linear power (a sliding RMS), not in dB: averaging decibels lets digital silence next
    # to a short scream drag the scream below the speech level.
    prefix = np.concatenate([[0.0], np.cumsum(10 ** (db.astype(np.float64) / 10))])
    idx = np.arange(n)
    a = np.maximum(0, idx - k)
    b = np.minimum(n, idx + k + 1)
    smooth = 10 * np.log10((prefix[b] - prefix[a]) / (b - a) + 1e-12)

    rough = _median(smooth)
    active = smooth[smooth >= max(-70.0, rough - 30)]
    basis = active if active.size >= max(10, n * 0.1) else smooth
    med = _median(basis)
    spread = max(1.5, 1.4826 * _median(np.abs(basis - med)))
    return (smooth - med) / spread, med


def detect_moments(
    db: np.ndarray,
    duration: float,
    sensitivity: float = 55,
    *,
    merge_gap: float = 1.5,
    pad_before: float = 2.0,
    pad_after: float = 1.0,
    min_length: float = 1.5,
    max_highlights: int = 12,
) -> list[Highlight]:
    n = int(db.size)
    if n == 0:
        return []
    z, _ = robust_z(db)
    threshold = threshold_for(sensitivity)

    runs: list[list[float]] = []  # [start_frame, end_frame, peak_z, peak_frame]
    i = 0
    above = z >= threshold
    while i < n:
        if not above[i]:
            i += 1
            continue
        s = i
        peak = float(z[i])
        peak_i = i
        while i < n and above[i]:
            if z[i] > peak:
                peak = float(z[i])
                peak_i = i
            i += 1
        if runs and (s - runs[-1][1]) * HOP < merge_gap:
            runs[-1][1] = i
            if peak > runs[-1][2]:
                runs[-1][2] = peak
                runs[-1][3] = peak_i
        else:
            runs.append([s, i, peak, peak_i])

    found: list[Highlight] = []
    for s, e, peak, peak_i in runs:
        start = max(0.0, s * HOP - pad_before)
        end = min(duration, e * HOP + pad_after)
        length = end - start
        if length < min_length:
            continue
        score = _js_round(min(100.0, (peak / (threshold + 4)) * 80 + min(20.0, length * 2)))
        found.append(Highlight(0, round(start, 3), round(end, 3), round(peak_i * HOP, 3), round(peak, 3), score))

    best = sorted(found, key=lambda h: -h.score)[:max_highlights]
    ordered = sorted(best, key=lambda h: h.start)
    for number, h in enumerate(ordered, start=1):
        h.id = number
    return ordered


def loudest_window(db: np.ndarray, duration: float, length: float = 6.0) -> Optional[Highlight]:
    """Fallback for audio with no stand-out peak (e.g. constant music): the loudest stretch."""
    if db.size == 0 or duration <= 0:
        return None
    z, _ = robust_z(db)
    peak_i = int(np.argmax(z))
    peak_time = peak_i * HOP
    length = min(length, duration)
    start = min(max(0.0, peak_time - length / 2), max(0.0, duration - length))
    return Highlight(1, round(start, 3), round(start + length, 3), round(peak_time, 3), round(float(z[peak_i]), 3), 0)
