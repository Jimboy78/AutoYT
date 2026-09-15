// Renders a highlight into a vertical 9:16 Short on a canvas and records it with MediaRecorder.
// Everything is drawn per frame: motion-tracked crop, audio-driven punch-in zoom and shake,
// animated hook sticker, live spectrum bars from the real audio, and a progress bar.

import type { TranscriptWord } from "../library";
import { HOP } from "./analyze";
import { CropTracker, GRID_H, GRID_W, cropRect, motionFocus, toLuma, windowFraction } from "./reframe";

export const OUT_W = 720;
export const OUT_H = 1280;
const ASPECT = OUT_W / OUT_H;
const BAR_COUNT = 24;

export interface ShortStyle {
  id: string;
  label: string;
  accent: string;
  accent2: string;
  ink: string;
}

export const SHORT_STYLES: ShortStyle[] = [
  { id: "neon", label: "Neón", accent: "#ff2e63", accent2: "#ff9f1c", ink: "#ffffff" },
  { id: "hype", label: "Hype", accent: "#ffe14d", accent2: "#ff2e63", ink: "#111111" },
  { id: "ice", label: "Ice", accent: "#4cc9f0", accent2: "#7b61ff", ink: "#04121a" },
];

export interface ShortOptions {
  hook: string;
  style: ShortStyle;
  reframe: boolean;
  punch: boolean;
  bars: boolean;
  /** Timed words from the transcript, drawn as karaoke captions. */
  captions: TranscriptWord[] | null;
}

export interface TrackSample {
  t: number;
  x: number;
  zoom: number;
}

export interface RenderJob {
  src: string;
  start: number;
  end: number;
  /** Robust z-score of the audio level per HOP window (from detectMoments). */
  z: Float32Array;
  options: ShortOptions;
  canvas: HTMLCanvasElement;
  mode: "still" | "preview" | "record";
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export interface RenderResult {
  blob: Blob | null;
  mime: string;
  samples: TrackSample[];
  elapsed: number;
}

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function recordingMime(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("El navegador no puede decodificar este video."));
    video.src = src;
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 4000);
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

/** next/font hashes the family name, so read it back from the CSS variable. */
async function displayFont() {
  const family = getComputedStyle(document.body).getPropertyValue("--font-display").trim() || "Impact, sans-serif";
  try {
    await document.fonts.load(`76px ${family}`);
  } catch {
    // Canvas falls back to the next family in the stack.
  }
  return family;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawHook(ctx: CanvasRenderingContext2D, text: string, style: ShortStyle, font: string, local: number) {
  if (!text.trim()) return;
  const appear = easeOutBack(clamp(local / 0.5, 0, 1));
  const lineHeight = 84;
  ctx.save();
  ctx.font = `76px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text.toUpperCase(), OUT_W - 150).slice(0, 3);
  const blockH = lines.length * lineHeight;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));

  // Gentle wobble keeps the sticker alive for the whole clip.
  ctx.translate(OUT_W / 2, 170 + blockH / 2);
  ctx.rotate(-0.04 + Math.sin(local * 2.2) * 0.012);
  ctx.scale(appear, appear);

  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = style.accent;
  ctx.beginPath();
  ctx.roundRect(-widest / 2 - 36, -blockH / 2 - 20, widest + 72, blockH + 40, 26);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = style.accent2;
  ctx.beginPath();
  ctx.roundRect(-widest / 2 - 36, blockH / 2 + 8, widest + 72, 12, 6);
  ctx.fill();

  ctx.fillStyle = style.ink;
  lines.forEach((line, i) => ctx.fillText(line, 0, -blockH / 2 + lineHeight * (i + 0.5) + 4));
  ctx.restore();
}

const CAPTION_PAGE = 3;

/** Three words at a time; the word being spoken pops and takes the accent color. */
function drawCaptions(ctx: CanvasRenderingContext2D, words: TranscriptWord[], t: number, style: ShortStyle, font: string) {
  let current = -1;
  let lo = 0;
  let hi = words.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= t) {
      current = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (current < 0) return;
  const first = Math.floor(current / CAPTION_PAGE) * CAPTION_PAGE;
  const group = words.slice(first, first + CAPTION_PAGE);
  if (t > group[group.length - 1].end + 0.35) return;

  ctx.save();
  ctx.font = `62px ${font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  const texts = group.map((w) => w.text.toUpperCase());
  const widths = texts.map((s) => ctx.measureText(s).width);
  const gap = 18;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (texts.length - 1);
  const scale = Math.min(1, (OUT_W - 80) / total);
  ctx.translate(OUT_W / 2, 900);
  ctx.scale(scale, scale);
  let x = -total / 2;
  group.forEach((w, k) => {
    const index = first + k;
    const speaking = index === current && t <= w.end + 0.15;
    const pop = speaking ? 1 + 0.2 * Math.max(0, 1 - (t - w.start) / 0.2) : 1;
    ctx.save();
    ctx.translate(x + widths[k] / 2, 0);
    ctx.scale(pop, pop);
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(texts[k], 0, 0);
    ctx.fillStyle = speaking ? style.accent : "#ffffff";
    ctx.fillText(texts[k], 0, 0);
    ctx.restore();
    x += widths[k] + gap;
  });
  ctx.restore();
}

function drawBars(ctx: CanvasRenderingContext2D, levels: Float32Array, style: ShortStyle) {
  const barW = 14;
  const gap = 9;
  const total = BAR_COUNT * (barW + gap) - gap;
  const x0 = (OUT_W - total) / 2;
  const baseY = 1110;
  const gradient = ctx.createLinearGradient(0, baseY - 70, 0, baseY + 70);
  gradient.addColorStop(0, style.accent2);
  gradient.addColorStop(0.5, style.accent);
  gradient.addColorStop(1, style.accent2);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.shadowColor = style.accent;
  ctx.shadowBlur = 18;
  for (let i = 0; i < BAR_COUNT; i++) {
    const h = 10 + levels[i] * 130;
    ctx.beginPath();
    ctx.roundRect(x0 + i * (barW + gap), baseY - h / 2, barW, h, barW / 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawChrome(ctx: CanvasRenderingContext2D, style: ShortStyle, progress: number, local: number, length: number) {
  const top = ctx.createLinearGradient(0, 0, 0, 380);
  top.addColorStop(0, "rgba(0,0,0,0.6)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, OUT_W, 380);
  const bottom = ctx.createLinearGradient(0, OUT_H - 320, 0, OUT_H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, OUT_H - 320, OUT_W, 320);

  ctx.save();
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.roundRect(36, 48, 168, 44, 22);
  ctx.fill();
  ctx.fillStyle = style.accent;
  ctx.beginPath();
  ctx.moveTo(58, 58);
  ctx.lineTo(78, 70);
  ctx.lineTo(58, 82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText("AUTOYT", 90, 71);

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${clock(Math.max(0, local))} / ${clock(length)}`, OUT_W - 40, 71);
  ctx.restore();

  const x = 60;
  const w = OUT_W - 120;
  const y = OUT_H - 58;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 8, 4);
  ctx.fill();
  const fill = ctx.createLinearGradient(x, 0, x + w, 0);
  fill.addColorStop(0, style.accent);
  fill.addColorStop(1, style.accent2);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(8, w * progress), 8, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + w * progress, y + 4, 11, 0, Math.PI * 2);
  ctx.fill();
}

export async function renderShort(job: RenderJob): Promise<RenderResult> {
  const { canvas, options, z, start, end, mode, signal } = job;
  const began = performance.now();
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible.");

  const [font, video] = await Promise.all([displayFont(), loadVideo(job.src)]);
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const length = end - start;
  const samples: TrackSample[] = [];

  const grid = document.createElement("canvas");
  grid.width = GRID_W;
  grid.height = GRID_H;
  const gctx = grid.getContext("2d", { willReadFrequently: true });
  let prevLuma = new Float32Array(GRID_W * GRID_H);
  let curLuma = new Float32Array(GRID_W * GRID_H);
  let hasPrev = false;
  const winFrac = windowFraction(vw, vh, ASPECT);
  const tracker = new CropTracker();

  const levels = new Float32Array(BAR_COUNT);
  let freq: Uint8Array<ArrayBuffer> | null = null;
  let analyser: AnalyserNode | null = null;
  let zoom = 1;
  let flash = 0;
  let lastZ = 0;
  let lastSample = -1;

  const paint = (t: number, dt: number) => {
    const local = t - start;
    const zt = z.length ? z[clamp(Math.floor(t / HOP), 0, z.length - 1)] : 0;

    if (options.reframe && gctx) {
      gctx.drawImage(video, 0, 0, GRID_W, GRID_H);
      toLuma(gctx.getImageData(0, 0, GRID_W, GRID_H).data, curLuma);
      if (hasPrev) tracker.update(motionFocus(prevLuma, curLuma, GRID_W, GRID_H, winFrac));
      [prevLuma, curLuma] = [curLuma, prevLuma];
      hasPrev = true;
    }

    const targetZoom = options.punch ? 1 + 0.18 * clamp((zt - 0.8) / 3, 0, 1) : 1;
    zoom += (targetZoom - zoom) * Math.min(1, dt * 7);
    if (options.punch && zt > 3 && lastZ <= 3) flash = 0.45;
    flash *= Math.exp(-dt * 5);
    lastZ = zt;
    const shake = options.punch ? clamp((zt - 2.2) / 2, 0, 1) * 10 : 0;
    const dx = Math.sin(t * 63) * shake;
    const dy = Math.cos(t * 51) * shake;

    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    const cover = Math.max(OUT_W / vw, OUT_H / vh) * 1.1;
    ctx.filter = "blur(32px) brightness(0.5) saturate(1.5)";
    ctx.drawImage(video, (OUT_W - vw * cover) / 2, (OUT_H - vh * cover) / 2, vw * cover, vh * cover);
    ctx.filter = "none";

    if (options.reframe) {
      const r = cropRect(vw, vh, ASPECT, tracker.x, zoom);
      ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, dx - 14, dy - 25, OUT_W + 28, OUT_H + 50);
    } else {
      const dw = OUT_W * zoom;
      const dh = (dw * vh) / vw;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(24, OUT_H / 2 - (OUT_W * vh) / vw / 2, OUT_W - 48, ((OUT_W - 48) * vh) / vw, 28);
      ctx.clip();
      ctx.drawImage(video, (OUT_W - dw) / 2 + dx, (OUT_H - dh) / 2 + dy, dw, dh);
      ctx.restore();
    }

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, OUT_W, OUT_H);
    }

    const progress = clamp(local / length, 0, 1);
    drawChrome(ctx, options.style, progress, local, length);

    if (options.bars) {
      if (analyser && freq) {
        analyser.getByteFrequencyData(freq);
        for (let i = 0; i < BAR_COUNT; i++) {
          // Log-ish spacing: bass gets fewer bins per bar, highs are grouped, like a real spectrum.
          const bin = 1 + Math.floor((i / (BAR_COUNT - 1)) ** 1.6 * (freq.length - 2));
          const v = freq[bin] / 255;
          levels[i] += (v - levels[i]) * 0.5;
        }
      } else {
        const energy = clamp((zt + 1) / 4, 0.15, 1);
        for (let i = 0; i < BAR_COUNT; i++) levels[i] = energy * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + t * 3)));
      }
      drawBars(ctx, levels, options.style);
    }

    if (options.captions?.length) drawCaptions(ctx, options.captions, t, options.style, font);

    drawHook(ctx, options.hook, options.style, font, mode === "still" ? 1 : local);

    if (local - lastSample >= 0.1) {
      samples.push({ t: local, x: tracker.x, zoom });
      lastSample = local;
    }
  };

  let audio: AudioContext | null = null;
  let stream: MediaStream | null = null;
  try {
    await seek(video, start);
    if (signal?.aborted) return { blob: null, mime: "", samples, elapsed: 0 };
    if (mode === "still") {
      paint(start, 1);
      return { blob: null, mime: "", samples, elapsed: performance.now() - began };
    }

    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio = new Ctx();
    const source = audio.createMediaElementSource(video);
    analyser = audio.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;
    freq = new Uint8Array(analyser.frequencyBinCount);
    // The graph must reach the destination to be processed; the gain decides whether you hear it.
    const monitor = audio.createGain();
    monitor.gain.value = mode === "preview" ? 1 : 0;
    source.connect(analyser);
    analyser.connect(monitor);
    monitor.connect(audio.destination);

    let recorder: MediaRecorder | null = null;
    let mime = "";
    const chunks: Blob[] = [];
    if (mode === "record") {
      mime = recordingMime() ?? "";
      if (!mime) throw new Error("Este navegador no puede grabar video (MediaRecorder).");
      const dest = audio.createMediaStreamDestination();
      source.connect(dest);
      stream = canvas.captureStream(30);
      dest.stream.getAudioTracks().forEach((track) => stream!.addTrack(track));
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
    }

    await audio.resume();
    paint(start, 0);
    recorder?.start(250);
    await video.play();

    await new Promise<void>((resolve) => {
      let last = performance.now();
      const tick = (now: number) => {
        const t = video.currentTime;
        if (signal?.aborted || video.ended || t >= end) return resolve();
        paint(t, Math.min(0.1, (now - last) / 1000));
        last = now;
        job.onProgress?.(clamp((t - start) / length, 0, 1));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    video.pause();
    job.onProgress?.(1);

    let blob: Blob | null = null;
    if (recorder) {
      await new Promise<void>((resolve) => {
        recorder!.onstop = () => resolve();
        recorder!.stop();
      });
      if (!signal?.aborted) blob = new Blob(chunks, { type: mime.split(";")[0] });
    }
    return { blob, mime, samples, elapsed: performance.now() - began };
  } finally {
    video.pause();
    stream?.getTracks().forEach((track) => track.stop());
    void audio?.close();
    video.removeAttribute("src");
    video.load();
  }
}
