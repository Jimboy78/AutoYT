// Pure helpers around transcripts: audio windowing at silences, word timing, subtitle formats, stats.

import type { Transcript, TranscriptSegment, TranscriptWord } from "../library";

export const SAMPLE_RATE = 16000;

export interface Window {
  start: number;
  end: number;
}

export interface RawChunk {
  text: string;
  start: number;
  end: number | null;
}

/**
 * Splits the timeline into windows of at most `maxLen` seconds, cutting at the quietest point
 * (from the stored 50 ms energy) so Whisper never receives a word sliced in half.
 */
export function speechWindows(db: ArrayLike<number>, hop: number, duration: number, maxLen = 28, minLen = 12): Window[] {
  const windows: Window[] = [];
  let start = 0;
  while (duration - start > maxLen) {
    const from = Math.max(0, Math.floor((start + minLen) / hop));
    const to = Math.min(db.length - 1, Math.floor((start + maxLen) / hop));
    let best = to;
    let bestLevel = Infinity;
    for (let i = from; i <= to; i++) {
      let sum = 0;
      let count = 0;
      for (let k = -2; k <= 2; k++) {
        const j = i + k;
        if (j >= 0 && j < db.length) {
          sum += db[j];
          count++;
        }
      }
      const level = sum / count;
      if (level < bestLevel) {
        bestLevel = level;
        best = i;
      }
    }
    const end = Math.max(start + minLen, best * hop);
    windows.push({ start, end });
    start = end;
  }
  if (duration - start > 0.05 || windows.length === 0) windows.push({ start, end: duration });
  return windows;
}

export interface Activity {
  /** Seconds per flag. */
  frame: number;
  /** 1 where the frame looks like voice: audible and not noise-like (low zero-crossing rate). */
  speech: Uint8Array;
}

/** Cheap voice-activity map: RMS above -45 dBFS and zero-crossing rate below 0.3 (white noise sits near 0.5). */
export function speechActivity(samples: Float32Array, rate: number, frame = 0.02): Activity {
  const size = Math.max(1, Math.round(rate * frame));
  const frames = Math.floor(samples.length / size);
  const speech = new Uint8Array(frames);
  for (let f = 0; f < frames; f++) {
    const o = f * size;
    let sum = 0;
    let crossings = 0;
    for (let i = 0; i < size; i++) {
      const v = samples[o + i];
      sum += v * v;
      if (i && (v >= 0) !== (samples[o + i - 1] >= 0)) crossings++;
    }
    const db = 10 * Math.log10(sum / size + 1e-12);
    speech[f] = db > -45 && crossings / size < 0.3 ? 1 : 0;
  }
  return { frame, speech };
}

/** First/last voiced moment inside [start, end], ignoring blips shorter than `minRun`, and total voiced seconds. */
export function speechSpan(activity: Activity, start: number, end: number, minRun = 0.15) {
  const from = Math.max(0, Math.floor(start / activity.frame));
  const to = Math.min(activity.speech.length, Math.ceil(end / activity.frame));
  const need = Math.max(1, Math.round(minRun / activity.frame));
  let first: number | null = null;
  let last: number | null = null;
  let voiced = 0;
  let run = 0;
  for (let f = from; f < to; f++) {
    if (activity.speech[f]) {
      run++;
      voiced++;
      if (run === need && first === null) first = (f - need + 1) * activity.frame;
      if (run >= need) last = (f + 1) * activity.frame;
    } else {
      run = 0;
    }
  }
  return { first, last, seconds: voiced * activity.frame };
}

/**
 * Whisper's timestamps drift when a window starts with music or noise: a short phrase gets stamped
 * across many seconds. If a chunk is far longer than its words need, pull it in to where voice is.
 */
export function tightenChunk(chunk: RawChunk, activity: Activity, windowEnd: number): RawChunk {
  const end = chunk.end ?? windowEnd;
  const words = chunk.text.trim().split(/\s+/).filter(Boolean).length;
  if (end - chunk.start <= Math.max(2, words * 0.7)) return chunk;
  const span = speechSpan(activity, chunk.start, end);
  if (span.first === null || span.last === null) return chunk;
  const start = Math.max(chunk.start, span.first - 0.1);
  return { ...chunk, start, end: Math.max(start + 0.2, Math.min(end, span.last + 0.15)) };
}

/** Whisper gives phrase-level timestamps; spread the words across each phrase by character length. */
export function spreadWords(text: string, start: number, end: number): TranscriptWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const weights = tokens.map((t) => t.length + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = start;
  return tokens.map((word, i) => {
    const d = ((end - start) * weights[i]) / total;
    const out = { text: word, start: t, end: t + d };
    t += d;
    return out;
  });
}

/** Normalizes chunks from one window: fills missing end times, drops empty text, keeps order and bounds. */
export function toSegments(chunks: RawChunk[], windowEnd: number): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  chunks.forEach((c, i) => {
    const text = c.text.replace(/\s+/g, " ").trim();
    if (!text) return;
    const start = Math.min(c.start, windowEnd);
    const nextStart = chunks[i + 1]?.start;
    let end = c.end ?? nextStart ?? windowEnd;
    end = Math.min(Math.max(end, start + 0.2), windowEnd);
    if (end <= start) return;
    out.push({ start, end, text, words: spreadWords(text, start, end) });
  });
  return out;
}

const pad = (n: number, size = 2) => String(Math.floor(n)).padStart(size, "0");

function stamp(seconds: number, sep: "," | ".") {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${pad(ms / 3_600_000)}:${pad((ms % 3_600_000) / 60_000)}:${pad((ms % 60_000) / 1000)}${sep}${pad(ms % 1000, 3)}`;
}

export const toSRT = (segments: TranscriptSegment[]) =>
  segments.map((s, i) => `${i + 1}\n${stamp(s.start, ",")} --> ${stamp(s.end, ",")}\n${s.text}\n`).join("\n");

export const toVTT = (segments: TranscriptSegment[]) =>
  `WEBVTT\n\n${segments.map((s) => `${stamp(s.start, ".")} --> ${stamp(s.end, ".")}\n${s.text}\n`).join("\n")}`;

export const toTXT = (segments: TranscriptSegment[]) => segments.map((s) => s.text).join("\n");

/** Index of the segment playing at `time`, or -1. Segments are sorted by start. */
export function segmentAt(segments: TranscriptSegment[], time: number) {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].end <= time) lo = mid + 1;
    else if (segments[mid].start > time) hi = mid - 1;
    else return mid;
  }
  return -1;
}

export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const STOPWORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes aqui asi aun bien cada casi como con contra cual cuando de del desde donde dos el ella ellas ello ellos en entre era eran eres es esa esas ese eso esos esta estaba estamos estan estar este esto estos estoy fue fueron ha habia han hasta hay hoy la las le les lo los mas me mi mis mucho muy nada ni no nos nosotros nuestra nuestro o otra otro para pero poco por porque que quien se sea ser si sin sobre solo son su sus tambien tan tanto te tengo ti tiene tienen todo todos tu tus un una unas uno unos usted vamos va van ver vez y ya yo " +
    "about after all also and any are because been but can could did does for from had has have her here him his how into its just like more not now one only other our out over she some than that the their them then there these they this those very was were what when which who will with would you your"
  ).split(" "),
);

export function keywords(text: string, limit = 12) {
  const counts = new Map<string, { word: string; count: number }>();
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 4) continue;
    const key = fold(raw);
    if (STOPWORDS.has(key)) continue;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { word: raw.toLowerCase(), count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.word.length - a.word.length).slice(0, limit);
}

export function transcriptStats(transcript: Transcript, duration: number) {
  const text = transcript.segments.map((s) => s.text).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const speaking = transcript.segments.reduce((acc, s) => acc + (s.end - s.start), 0);
  return {
    words,
    speaking,
    coverage: duration ? Math.min(1, speaking / duration) : 0,
    wpm: speaking > 0 ? Math.round(words / (speaking / 60)) : 0,
    keywords: keywords(text),
  };
}
