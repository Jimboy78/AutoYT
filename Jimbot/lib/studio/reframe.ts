// Motion-aware 9:16 reframing: find where things move in a tiny luma grid and ease the crop there.

export const GRID_W = 64;
export const GRID_H = 36;
const NOISE = 10; // luma diff below this is compression noise

export interface Focus {
  /** Horizontal center of the action, 0 (left) .. 1 (right). */
  x: number;
  /** Mean per-cell motion; ~0 on a static shot. */
  strength: number;
}

export function toLuma(rgba: Uint8ClampedArray, out: Float32Array): Float32Array {
  for (let i = 0, p = 0; p < out.length; i += 4, p++) out[p] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return out;
}

/**
 * Slides a crop-wide window over the per-column motion between two frames and returns the
 * motion-weighted center of the busiest window, so the crop frames the action rather than
 * the average of everything that moves.
 */
export function motionFocus(prev: Float32Array, cur: Float32Array, w: number, h: number, windowFrac: number): Focus {
  const cols = new Float32Array(w);
  let total = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(cur[row + x] - prev[row + x]);
      if (d > NOISE) {
        cols[x] += d;
        total += d;
      }
    }
  }
  const strength = total / (w * h);
  if (total === 0) return { x: 0.5, strength: 0 };

  const win = Math.max(1, Math.min(w, Math.round(w * windowFrac)));
  let sum = 0;
  for (let x = 0; x < win; x++) sum += cols[x];
  let best = sum;
  let bestStart = 0;
  for (let x = win; x < w; x++) {
    sum += cols[x] - cols[x - win];
    if (sum > best) {
      best = sum;
      bestStart = x - win + 1;
    }
  }

  let weighted = 0;
  for (let x = bestStart; x < bestStart + win; x++) weighted += cols[x] * (x + 0.5);
  return { x: weighted / best / w, strength };
}

/** Eases the crop toward the action with a dead zone, so it glides like a camera operator instead of jittering. */
export class CropTracker {
  x: number;

  constructor(
    start = 0.5,
    private readonly ease = 0.08,
    private readonly deadZone = 0.03,
    private readonly minStrength = 0.4,
  ) {
    this.x = start;
  }

  update(focus: Focus): number {
    if (focus.strength < this.minStrength) return this.x;
    const delta = focus.x - this.x;
    if (Math.abs(delta) > this.deadZone) this.x += (delta - Math.sign(delta) * this.deadZone) * this.ease;
    return this.x;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Largest `aspect` (w/h) rect inside the source, zoomed and centered on `centerX`, kept within bounds. */
export function cropRect(srcW: number, srcH: number, aspect: number, centerX: number, zoom = 1, centerY = 0.5) {
  let sw: number;
  let sh: number;
  if (srcW / srcH > aspect) {
    sh = srcH;
    sw = sh * aspect;
  } else {
    sw = srcW;
    sh = sw / aspect;
  }
  sw /= zoom;
  sh /= zoom;
  return {
    sx: clamp(centerX * srcW - sw / 2, 0, srcW - sw),
    sy: clamp(centerY * srcH - sh / 2, 0, srcH - sh),
    sw,
    sh,
  };
}

/** Fraction of the source width a full-height crop of `aspect` covers. */
export const windowFraction = (srcW: number, srcH: number, aspect: number) => Math.min(1, (srcH * aspect) / srcW);
