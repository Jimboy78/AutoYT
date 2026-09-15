// Generic real-time recorder: plays a source range into a canvas you draw on, and captures the canvas
// plus the source audio with MediaRecorder. Used by Conversión and clip exports.

export interface RecordJob {
  src: string;
  start: number;
  end: number;
  width: number;
  height: number;
  fps?: number;
  videoBitsPerSecond?: number;
  prefer?: "mp4" | "webm";
  /** Draw the current source frame onto the output canvas. */
  draw: (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, time: number) => void;
  /** Optional visible canvas to mirror the output for a live preview. */
  preview?: HTMLCanvasElement | null;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export interface RecordResult {
  blob: Blob | null;
  mime: string;
  elapsed: number;
}

const MP4 = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01F,mp4a.40.2", "video/mp4"];
const WEBM = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

export function supportedMime(prefer: "mp4" | "webm" = "mp4"): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const order = prefer === "mp4" ? [...MP4, ...WEBM] : [...WEBM, ...MP4];
  return order.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export const canRecord = (container: "mp4" | "webm") =>
  typeof MediaRecorder !== "undefined" && (container === "mp4" ? MP4 : WEBM).some((m) => MediaRecorder.isTypeSupported(m));

export function loadVideo(src: string, muted = false): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = muted;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("El navegador no puede decodificar este video."));
    video.src = src;
  });
}

export function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
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

export async function recordSegment(job: RecordJob): Promise<RecordResult> {
  const began = performance.now();
  const mime = supportedMime(job.prefer);
  if (!mime) throw new Error("Este navegador no puede grabar video (MediaRecorder).");

  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible.");
  const previewCtx = job.preview?.getContext("2d") ?? null;

  const video = await loadVideo(job.src);
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audio = new Ctx();
  const stream = canvas.captureStream(job.fps ?? 30);
  try {
    await seekVideo(video, job.start);
    const source = audio.createMediaElementSource(video);
    const dest = audio.createMediaStreamDestination();
    const silent = audio.createGain();
    silent.gain.value = 0;
    source.connect(dest);
    source.connect(silent);
    silent.connect(audio.destination);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: job.videoBitsPerSecond ?? 6_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const paint = () => {
      job.draw(ctx, video, video.currentTime);
      if (previewCtx && job.preview) previewCtx.drawImage(canvas, 0, 0, job.preview.width, job.preview.height);
    };

    await audio.resume();
    paint();
    recorder.start(250);
    await video.play();
    const length = Math.max(0.01, job.end - job.start);
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = video.currentTime;
        if (job.signal?.aborted || video.ended || t >= job.end) return resolve();
        paint();
        job.onProgress?.(Math.min(1, Math.max(0, (t - job.start) / length)));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    video.pause();
    job.onProgress?.(1);
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const blob = job.signal?.aborted ? null : new Blob(chunks, { type: mime.split(";")[0] });
    return { blob, mime, elapsed: performance.now() - began };
  } finally {
    video.pause();
    stream.getTracks().forEach((t) => t.stop());
    void audio.close();
    video.removeAttribute("src");
    video.load();
  }
}
