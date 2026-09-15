// Frame grabbing + a small "would this make a good thumbnail?" heuristic.

export interface FrameCandidate {
  time: number;
  highlightId?: number;
  dataUrl: string;
  score: number; // 0..100
  brightness: number; // 0..255
  contrast: number; // luminance std-dev
  colorfulness: number; // Hasler–Süsstrunk
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
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

function release(video: HTMLVideoElement) {
  video.removeAttribute("src");
  video.load();
}

export function scoreFrame(pixels: Uint8ClampedArray) {
  let n = 0;
  let sumL = 0;
  let sumL2 = 0;
  let sumRg = 0;
  let sumRg2 = 0;
  let sumYb = 0;
  let sumYb2 = 0;
  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    sumL += l;
    sumL2 += l * l;
    sumRg += rg;
    sumRg2 += rg * rg;
    sumYb += yb;
    sumYb2 += yb * yb;
    n++;
  }
  const brightness = sumL / n;
  const contrast = Math.sqrt(Math.max(0, sumL2 / n - brightness ** 2));
  const mRg = sumRg / n;
  const mYb = sumYb / n;
  const sRg = Math.sqrt(Math.max(0, sumRg2 / n - mRg ** 2));
  const sYb = Math.sqrt(Math.max(0, sumYb2 / n - mYb ** 2));
  const colorfulness = Math.hypot(sRg, sYb) + 0.3 * Math.hypot(mRg, mYb);

  const b = 1 - Math.min(1, Math.abs(brightness - 125) / 125);
  const c = Math.min(1, contrast / 70);
  const col = Math.min(1, colorfulness / 80);
  const score = Math.round(100 * (0.3 * b + 0.35 * c + 0.35 * col));
  return { brightness, contrast, colorfulness, score };
}

export async function extractFrames(
  src: string,
  targets: { time: number; highlightId?: number }[],
  onProgress?: (done: number, total: number) => void,
): Promise<FrameCandidate[]> {
  const video = await loadVideo(src);
  const width = 480;
  const height = video.videoWidth ? Math.round((width * video.videoHeight) / video.videoWidth) : 270;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D no disponible.");

  const out: FrameCandidate[] = [];
  try {
    for (let i = 0; i < targets.length; i++) {
      await seek(video, targets[i].time);
      ctx.drawImage(video, 0, 0, width, height);
      const stats = scoreFrame(ctx.getImageData(0, 0, width, height).data);
      out.push({ ...targets[i], ...stats, dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
      onProgress?.(i + 1, targets.length);
    }
  } finally {
    release(video);
  }
  return out;
}

/** Full-resolution grab for the thumbnail maker. */
export async function captureFrame(src: string, time: number): Promise<HTMLCanvasElement> {
  const video = await loadVideo(src);
  try {
    await seek(video, time);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    release(video);
  }
}
