import math
import shutil
import wave

import numpy as np
import pytest

from app.services.highlights import HOP, AudioDecodeError, detect_moments, loudest_window, measure_energy_file, threshold_for


def curve(pieces):
    """[(seconds, dB), ...] → dB per HOP frame."""
    out = []
    for seconds, level in pieces:
        out += [level] * round(seconds / HOP)
    return np.asarray(out, dtype=np.float32)


def test_threshold_maps_sensitivity():
    assert threshold_for(0) == 4
    assert threshold_for(100) == 1
    assert threshold_for(250) == 1


def test_constant_audio_has_no_moments_but_a_loudest_window():
    db = curve([(30, -22)])
    assert detect_moments(db, 30, 100) == []
    window = loudest_window(db, 30, 6)
    assert window is not None and 0 <= window.start and window.end <= 30 and math.isclose(window.end - window.start, 6)


def test_peaks_in_a_steady_stream_become_ordered_moments():
    db = curve([(10, -25), (1, -8), (10, -25), (2, -6), (10, -25), (1, -7), (6, -25)])
    moments = detect_moments(db, 40, 55)
    assert [m.id for m in moments] == [1, 2, 3]
    peaks = [m.peak_time for m in moments]
    assert 10 <= peaks[0] <= 11 and 21 <= peaks[1] <= 23 and 33 <= peaks[2] <= 34
    assert all(0 <= m.score <= 100 for m in moments)
    assert all(m.start <= m.peak_time <= m.end for m in moments)


def test_digital_silence_between_phrases_does_not_hide_the_loud_events():
    # Talk at -24 dB with -120 dB pauses and two shouts: averaging in dB used to bury the shouts.
    pieces = []
    for _ in range(6):
        pieces += [(2.5, -24), (1.0, -120)]
    pieces[3] = (0.8, -4)
    pieces[9] = (1.2, -5)
    db = curve(pieces)
    moments = detect_moments(db, db.size * HOP, 55)
    assert len(moments) == 2, moments


def test_merge_gap_and_max_highlights():
    db = curve([(8, -25), (0.7, -6), (1.2, -25), (0.7, -6), (8, -25)])
    split = detect_moments(db, 18.6, 55, merge_gap=0.5, pad_before=0, pad_after=0, min_length=0.2)
    merged = detect_moments(db, 18.6, 55, merge_gap=2, pad_before=0, pad_after=0, min_length=0.2)
    assert len(split) == 2 and len(merged) == 1
    pieces = []
    for i in range(10):
        pieces += [(4, -25), (0.6 + i * 0.3, -6)]
    capped = detect_moments(curve(pieces), 70, 55, max_highlights=3)
    assert len(capped) == 3


def _write_wav(path, samples, rate):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes())


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg no disponible")
def test_measure_energy_file_streams_real_audio(tmp_path):
    rate = 22050
    rng = np.random.default_rng(7)
    samples = rng.normal(0, 0.02, rate * 20).astype(np.float32)
    for at in (5, 14):
        samples[at * rate : (at + 1) * rate] = rng.normal(0, 0.4, rate)
    src = tmp_path / "bursts.wav"
    _write_wav(src, samples, rate)

    progress = []
    db = measure_energy_file(src, duration=20, on_progress=progress.append)
    assert abs(db.size - 400) <= 1
    assert progress and progress[-1] == pytest.approx(1.0, abs=0.01)
    moments = detect_moments(db, 20, 55)
    assert len(moments) == 2
    assert 5 <= moments[0].peak_time <= 6 and 14 <= moments[1].peak_time <= 15


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg no disponible")
def test_measure_energy_file_errors_are_explicit(tmp_path):
    with pytest.raises(AudioDecodeError):
        measure_energy_file(tmp_path / "missing.mp4")
