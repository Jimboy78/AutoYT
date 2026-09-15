// Beat tracking for the rhythm editor: onset envelope → tempo by autocorrelation → beat phase → grid,
// plus the timeline planner that snaps clip lengths to whole beats.

export interface Envelope {
  env: Float32Array;
  /** Envelope frames per second. */
  frameRate: number;
}

/** Log-energy flux: how much louder each ~11 ms frame is than the previous one (rectified). */
export function onsetEnvelope(samples: Float32Array, sampleRate: number, hopSize = 512): Envelope {
  const frames = Math.max(0, Math.floor(samples.length / hopSize));
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const o = f * hopSize;
    for (let i = 0; i < hopSize; i++) sum += samples[o + i] * samples[o + i];
    energy[f] = Math.log1p(1000 * (sum / hopSize));
  }
  const env = new Float32Array(frames);
  for (let f = 1; f < frames; f++) env[f] = Math.max(0, energy[f] - energy[f - 1]);
  return { env, frameRate: sampleRate / hopSize };
}

export interface Tempo {
  bpm: number;
  /** 0..1, how much the winning period stands out. */
  confidence: number;
  /** Seconds of the first beat. */
  offset: number;
}

function autocorr(env: Float32Array, lag: number) {
  let sum = 0;
  for (let i = lag; i < env.length; i++) sum += env[i] * env[i - lag];
  return sum / (env.length - lag);
}

/**
 * Autocorrelation of the onset envelope over plausible periods, weighted toward ~120 BPM so the
 * half/double-tempo ambiguity resolves the way people tap along.
 */
export function estimateTempo({ env, frameRate }: Envelope, minBpm = 70, maxBpm = 180): Tempo {
  if (env.length < frameRate * 2) return { bpm: 0, confidence: 0, offset: 0 };
  // Widen onsets by a frame each side: fast tempos have fractional periods, and whole-frame lags
  // would miss narrow peaks and favor the slower octave.
  const wide = env.map((v, i) => Math.max(v, env[i - 1] ?? 0, env[i + 1] ?? 0));
  const mean = wide.reduce((a, b) => a + b, 0) / wide.length;
  const centered = wide.map((v) => v - mean);
  const minLag = Math.floor((60 * frameRate) / maxBpm);
  const maxLag = Math.ceil((60 * frameRate) / minBpm);

  const scores: number[] = [];
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * frameRate) / lag;
    const weight = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    // Reward periods whose double also correlates: true beats repeat every 2 periods too.
    const score = weight * (autocorr(centered, lag) + 0.5 * autocorr(centered, lag * 2));
    scores.push(score);
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }

  // Parabolic interpolation around the peak for sub-frame tempo precision.
  const i = best - minLag;
  let lag = best;
  if (i > 0 && i < scores.length - 1) {
    const a = scores[i - 1];
    const b = scores[i];
    const c = scores[i + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) lag = best + (0.5 * (a - c)) / denom;
  }

  // Normalized autocorrelation at the winning period: ~0 for noise, high for a steady beat.
  const energy = autocorr(centered, 0);
  const confidence = energy > 0 ? Math.max(0, Math.min(1, autocorr(centered, best) / energy)) : 0;
  const refined = refineGrid({ env, frameRate }, (60 * frameRate) / lag);
  return { bpm: refined.bpm, confidence, offset: refined.offset };
}

/**
 * Autocorrelation lags are whole frames (~11 ms), and a tiny tempo error drifts the grid by a
 * beat over a long song. A comb search over ±2 BPM and every phase lines tempo and phase up jointly.
 */
export function refineGrid({ env, frameRate }: Envelope, bpm: number) {
  // Tolerate onsets landing one frame early/late.
  const wide = env.map((v, i) => Math.max(v, env[i - 1] ?? 0, env[i + 1] ?? 0));
  let best = { bpm, offset: 0, score: -Infinity };
  for (let candidate = bpm - 2; candidate <= bpm + 2 + 1e-9; candidate += 0.05) {
    const period = (60 * frameRate) / candidate;
    const steps = Math.max(1, Math.round(period));
    for (let s = 0; s < steps; s++) {
      const phase = (s / steps) * period;
      let sum = 0;
      let count = 0;
      for (let t = phase; t < wide.length; t += period) {
        sum += wide[Math.round(t)] ?? 0;
        count++;
      }
      const score = sum / Math.max(1, count);
      if (score > best.score) best = { bpm: candidate, offset: phase / frameRate, score };
    }
  }
  return { bpm: best.bpm, offset: best.offset };
}

/** Phase of the beat grid that lands on the most onset energy. */
export function beatOffset({ env, frameRate }: Envelope, bpm: number) {
  const period = (60 * frameRate) / bpm;
  const steps = Math.max(1, Math.round(period));
  let best = 0;
  let bestSum = -Infinity;
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * period;
    let sum = 0;
    for (let t = phase; t < env.length; t += period) {
      const k = Math.round(t);
      sum += env[k] ?? 0;
    }
    if (sum > bestSum) {
      bestSum = sum;
      best = phase;
    }
  }
  return best / frameRate;
}

export function beatGrid(bpm: number, offset: number, duration: number) {
  if (bpm <= 0) return [];
  const beat = 60 / bpm;
  const out: number[] = [];
  for (let t = offset; t <= duration + 1e-9; t += beat) out.push(Number(t.toFixed(4)));
  return out;
}

export interface MontageClip {
  id: string;
  projectId: string;
  start: number;
  end: number;
  speed: number;
  /** Source duration, so snapping never runs past the end of the video. */
  sourceDuration: number;
}

export interface PlannedClip {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
  beats: number | null;
}

/** Lays clips end to end; with a beat length, each clip lasts a whole number of beats. */
export function planMontage(clips: MontageClip[], beat: number | null): PlannedClip[] {
  let t = 0;
  return clips.map((c) => {
    const natural = (c.end - c.start) / c.speed;
    let length = natural;
    let beats: number | null = null;
    if (beat && beat > 0) {
      beats = Math.max(1, Math.round(natural / beat));
      const maxBeats = Math.max(1, Math.floor((c.sourceDuration - c.start) / c.speed / beat));
      beats = Math.min(beats, maxBeats);
      length = beats * beat;
    }
    const planned = {
      id: c.id,
      sourceStart: c.start,
      sourceEnd: Math.min(c.sourceDuration, c.start + length * c.speed),
      timelineStart: t,
      timelineEnd: t + length,
      beats,
    };
    t += length;
    return planned;
  });
}
