// Audio-energy highlight detection that runs entirely in the browser (Web Audio API).
// Same idea as the backend's pending `h_detect_events` step: loud, sustained moments
// relative to the video's own baseline are the ones worth clipping.

export const HOP = 0.05; // analysis window, seconds

export interface Segment {
  start: number;
  end: number;
}

export interface Highlight extends Segment {
  id: number;
  peakTime: number;
  peakZ: number;
  score: number; // 0..100
}

export interface Energy {
  duration: number;
  db: Float32Array; // RMS level per HOP window
  waveform: Float32Array; // normalized peak amplitude per display bin
}

export interface Moments {
  z: Float32Array; // robust z-score of smoothed level
  highlights: Highlight[];
  silences: Segment[];
  medianDb: number;
  peakDb: number;
  silenceRatio: number;
}

export interface Chapter {
  time: number;
  kind: "intro" | "highlight" | "part";
  highlightId?: number;
}

export async function decodeAudio(file: Blob): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(data);
  } catch {
    throw new Error("No encontramos una pista de audio legible en el archivo.");
  } finally {
    void ctx.close();
  }
}

function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  const k = 1 / buffer.numberOfChannels;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] * k;
  }
  return out;
}

function median(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)];
}

export function measureEnergy(buffer: AudioBuffer, bins = 1600): Energy {
  const data = toMono(buffer);
  const win = Math.max(1, Math.round(buffer.sampleRate * HOP));
  const frames = Math.max(1, Math.floor(data.length / win));

  const db = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const o = f * win;
    for (let i = 0; i < win; i++) sum += data[o + i] * data[o + i];
    db[f] = 20 * Math.log10(Math.sqrt(sum / win) + 1e-6);
  }

  const waveform = new Float32Array(bins);
  const per = data.length / bins;
  let max = 1e-6;
  for (let b = 0; b < bins; b++) {
    let m = 0;
    const end = Math.min(data.length, Math.floor((b + 1) * per));
    for (let i = Math.floor(b * per); i < end; i += 8) {
      const v = Math.abs(data[i]);
      if (v > m) m = v;
    }
    waveform[b] = m;
    if (m > max) max = m;
  }
  for (let b = 0; b < bins; b++) waveform[b] /= max;

  return { duration: buffer.duration, db, waveform };
}

/**
 * sensitivity 0..100 → z-score threshold 4..1. Uses median/MAD instead of mean/std so
 * a few very loud minutes don't hide every other peak.
 */
export function detectMoments(db: Float32Array, duration: number, sensitivity: number): Moments {
  const n = db.length;
  const k = Math.max(1, Math.round(0.5 / HOP));
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + db[i];
  const smooth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - k);
    const b = Math.min(n, i + k + 1);
    smooth[i] = (prefix[b] - prefix[a]) / (b - a);
  }

  const med = median(smooth);
  const dev = new Float32Array(n);
  for (let i = 0; i < n; i++) dev[i] = Math.abs(smooth[i] - med);
  // Floor the spread so near-constant audio doesn't turn tiny wiggles into "peaks".
  const spread = Math.max(1.5, 1.4826 * median(dev));
  const z = new Float32Array(n);
  let peakDb = -Infinity;
  for (let i = 0; i < n; i++) {
    z[i] = (smooth[i] - med) / spread;
    if (db[i] > peakDb) peakDb = db[i];
  }

  const threshold = 4 - (Math.min(100, Math.max(0, sensitivity)) / 100) * 3;

  // Runs above threshold → merge close runs → pad for context.
  const runs: { s: number; e: number; peak: number; peakI: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (z[i] < threshold) continue;
    const s = i;
    let peak = z[i];
    let peakI = i;
    while (i < n && z[i] >= threshold) {
      if (z[i] > peak) {
        peak = z[i];
        peakI = i;
      }
      i++;
    }
    const last = runs[runs.length - 1];
    if (last && (s - last.e) * HOP < 1.5) {
      last.e = i;
      if (peak > last.peak) {
        last.peak = peak;
        last.peakI = peakI;
      }
    } else {
      runs.push({ s, e: i, peak, peakI });
    }
  }

  const highlights = runs
    .map((r) => {
      const start = Math.max(0, r.s * HOP - 2);
      const end = Math.min(duration, r.e * HOP + 1);
      const len = end - start;
      const score = Math.round(Math.min(100, (r.peak / (threshold + 4)) * 80 + Math.min(20, len * 2)));
      return { id: 0, start, end, peakTime: r.peakI * HOP, peakZ: r.peak, score };
    })
    .filter((h) => h.end - h.start >= 1.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .sort((a, b) => a.start - b.start)
    .map((h, i) => ({ ...h, id: i + 1 }));

  const floor = Math.max(-55, med - 18);
  const silences: Segment[] = [];
  let silent = 0;
  for (let i = 0; i < n; i++) {
    if (db[i] >= floor) continue;
    const s = i;
    while (i < n && db[i] < floor) i++;
    if ((i - s) * HOP >= 1.2) {
      silences.push({ start: s * HOP, end: i * HOP });
      silent += i - s;
    }
  }

  return { z, highlights, silences, medianDb: med, peakDb, silenceRatio: n ? silent / n : 0 };
}

/** YouTube chapters: start at 0:00, at least 3 entries, each ≥ 10 s. */
export function buildChapters(duration: number, highlights: Highlight[]): Chapter[] {
  if (duration < 30) return [{ time: 0, kind: "intro" }];
  const minGap = Math.max(10, duration / 24);
  const chapters: Chapter[] = [{ time: 0, kind: "intro" }];

  for (const h of highlights) {
    const time = Math.floor(h.start);
    const prev = chapters[chapters.length - 1].time;
    if (time - prev >= minGap && duration - time >= 10) {
      chapters.push({ time, kind: "highlight", highlightId: h.id });
    }
  }

  while (chapters.length < 3) {
    let bestIdx = -1;
    let bestGap = 0;
    for (let i = 0; i < chapters.length; i++) {
      const next = i + 1 < chapters.length ? chapters[i + 1].time : duration;
      const gap = next - chapters[i].time;
      if (gap > bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }
    if (bestGap / 2 < 10) break;
    chapters.splice(bestIdx + 1, 0, { time: Math.floor(chapters[bestIdx].time + bestGap / 2), kind: "part" });
  }
  return chapters;
}

/** Frames to score as thumbnail candidates: highlight peaks first, plus an even spread. */
export function pickFrameTimes(duration: number, highlights: Highlight[]) {
  const targets: { time: number; highlightId?: number }[] = [...highlights]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((h) => ({ time: h.peakTime, highlightId: h.id }));
  const spread = 8;
  for (let i = 0; i < spread; i++) {
    const time = ((i + 0.5) / spread) * duration;
    if (targets.every((t) => Math.abs(t.time - time) > 2)) targets.push({ time });
  }
  return targets.map((t) => ({ ...t, time: Math.min(Math.max(0, duration - 0.1), t.time) }));
}
