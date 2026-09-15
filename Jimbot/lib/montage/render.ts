// Montage renderer: plays planned clips from one or more videos back to back into a canvas, with entry
// transitions, an optional beat pulse, the clips' own audio and a music bed aligned to the beat grid.
// The recorder pauses while the next clip seeks, so seeks never end up in the output.

import { drawFramed } from "../convert/draw";
import type { Fit } from "../convert/presets";
import { loadVideo, seekVideo, supportedMime } from "../studio/recorder";
import type { PlannedClip } from "./beats";

export type Transition = "cut" | "fade" | "flash" | "zoom";

export const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "cut", label: "Corte" },
  { id: "fade", label: "Fundido" },
  { id: "flash", label: "Flash" },
  { id: "zoom", label: "Zoom" },
];

export interface MontageItem extends PlannedClip {
  src: string;
  speed: number;
  transition: Transition;
}

export interface MontageJob {
  items: MontageItem[];
  width: number;
  height: number;
  fit: Fit;
  music: AudioBuffer | null;
  /** Seconds into the music where timeline 0 starts (the first beat). */
  musicOffset: number;
  musicVolume: number;
  clipVolume: number;
  /** Beat length in seconds; enables the pulse when `beatPulse` is on. */
  beat: number | null;
  beatPulse: boolean;
  mode: "preview" | "record";
  prefer?: "mp4" | "webm";
  preview?: HTMLCanvasElement | null;
  signal?: AbortSignal;
  onProgress?: (fraction: number, index: number) => void;
}

export interface MontageResult {
  blob: Blob | null;
  mime: string;
  elapsed: number;
}

const FADE = 0.3;
const FLASH = 0.18;
const ZOOM = 0.35;

function paint(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, job: MontageJob, item: MontageItem, next: MontageItem | undefined, local: number) {
  const { width: W, height: H } = job;
  const length = item.timelineEnd - item.timelineStart;
  let scale = 1;
  if (item.transition === "zoom" && local < ZOOM) scale = 1 + 0.25 * (1 - local / ZOOM) ** 2;
  if (job.beatPulse && job.beat) {
    const phase = (item.timelineStart + local) % job.beat;
    scale *= 1 + 0.035 * Math.exp(-phase * 14);
  }

  ctx.save();
  if (scale !== 1) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-W / 2, -H / 2);
  }
  drawFramed(ctx, video, W, H, job.fit, 0.5);
  ctx.restore();

  let black = 0;
  if (item.transition === "fade" && local < FADE) black = 1 - local / FADE;
  if (next?.transition === "fade" && local > length - FADE) black = Math.max(black, (local - (length - FADE)) / FADE);
  if (black > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, black)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (item.transition === "flash" && local < FLASH) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - local / FLASH)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export async function renderMontage(job: MontageJob): Promise<MontageResult> {
  const began = performance.now();
  if (!job.items.length) throw new Error("La línea de tiempo está vacía.");
  const record = job.mode === "record";
  const mime = record ? supportedMime(job.prefer) : "";
  if (record && !mime) throw new Error("Este navegador no puede grabar video (MediaRecorder).");

  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  const previewCtx = job.preview?.getContext("2d") ?? null;
  const mirror = () => {
    if (previewCtx && job.preview) previewCtx.drawImage(canvas, 0, 0, job.preview.width, job.preview.height);
  };

  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audio = new Ctx();
  const out = audio.createGain();
  out.gain.value = 1;
  const monitor = audio.createGain();
  monitor.gain.value = record ? 0 : 1;
  out.connect(monitor);
  monitor.connect(audio.destination);
  const dest = record ? audio.createMediaStreamDestination() : null;
  if (dest) out.connect(dest);

  const clipGain = audio.createGain();
  clipGain.gain.value = job.clipVolume;
  clipGain.connect(out);
  const musicGain = audio.createGain();
  musicGain.gain.value = job.musicVolume;
  musicGain.connect(out);

  const videos = new Map<string, HTMLVideoElement>();
  const stream = record ? canvas.captureStream(30) : null;
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  let music: AudioBufferSourceNode | null = null;

  try {
    for (const item of job.items) {
      if (videos.has(item.src)) continue;
      const video = await loadVideo(item.src);
      audio.createMediaElementSource(video).connect(clipGain);
      videos.set(item.src, video);
    }
    if (stream && dest) {
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      recorder = new MediaRecorder(stream, { mimeType: mime!, videoBitsPerSecond: 6_000_000 });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
    }
    await audio.resume();
    const total = job.items[job.items.length - 1].timelineEnd;

    for (let i = 0; i < job.items.length; i++) {
      if (job.signal?.aborted) break;
      const item = job.items[i];
      const next = job.items[i + 1];
      const video = videos.get(item.src)!;
      video.playbackRate = item.speed;
      await seekVideo(video, item.sourceStart);
      paint(ctx, video, job, item, next, 0);
      mirror();

      if (recorder) {
        if (recorder.state === "inactive") recorder.start(250);
        else recorder.resume();
      }
      if (job.music) {
        music = audio.createBufferSource();
        music.buffer = job.music;
        music.connect(musicGain);
        const at = job.musicOffset + item.timelineStart;
        if (at < job.music.duration) music.start(0, at);
      }
      await video.play();

      await new Promise<void>((resolve) => {
        const tick = () => {
          const t = video.currentTime;
          if (job.signal?.aborted || video.ended || t >= item.sourceEnd) return resolve();
          const local = (t - item.sourceStart) / item.speed;
          paint(ctx, video, job, item, next, local);
          mirror();
          job.onProgress?.(Math.min(1, (item.timelineStart + local) / total), i);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      video.pause();
      try {
        music?.stop();
      } catch {
        // Source may not have started (music shorter than the timeline).
      }
      music = null;
      if (recorder && recorder.state === "recording") recorder.pause();
    }

    job.onProgress?.(1, job.items.length - 1);
    let blob: Blob | null = null;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder!.onstop = () => resolve();
        recorder!.stop();
      });
      if (!job.signal?.aborted) blob = new Blob(chunks, { type: mime!.split(";")[0] });
    }
    return { blob, mime: mime ?? "", elapsed: performance.now() - began };
  } finally {
    try {
      music?.stop();
    } catch {
      // already stopped
    }
    videos.forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
    stream?.getTracks().forEach((t) => t.stop());
    void audio.close();
  }
}
