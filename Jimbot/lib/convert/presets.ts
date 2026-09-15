// Output formats per platform, frame layout math and the equivalent ffmpeg command for each conversion.

import { cropRect } from "../studio/reframe";

export type Fit = "crop" | "blur" | "letterbox";

export interface OutputFormat {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  bitrate: number; // bits per second
}

export const FORMATS: OutputFormat[] = [
  { id: "yt-1080", label: "YouTube 1080p", platform: "16:9", width: 1920, height: 1080, bitrate: 8_000_000 },
  { id: "yt-720", label: "YouTube 720p", platform: "16:9", width: 1280, height: 720, bitrate: 5_000_000 },
  { id: "shorts", label: "Shorts · Reels · TikTok", platform: "9:16", width: 1080, height: 1920, bitrate: 8_000_000 },
  { id: "square", label: "Instagram cuadrado", platform: "1:1", width: 1080, height: 1080, bitrate: 6_000_000 },
  { id: "portrait", label: "Instagram feed", platform: "4:5", width: 1080, height: 1350, bitrate: 6_000_000 },
];

export const FIT_LABELS: Record<Fit, string> = { crop: "Recortar", blur: "Fondo desenfocado", letterbox: "Barras" };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameLayout {
  /** Source region to sample. */
  src: Rect;
  /** Where that region lands on the output canvas. */
  dst: Rect;
  /** Blurred cover background (blur fit only). */
  background: Rect | null;
}

export function frameLayout(srcW: number, srcH: number, outW: number, outH: number, fit: Fit, focusX = 0.5): FrameLayout {
  if (fit === "crop") {
    const r = cropRect(srcW, srcH, outW / outH, focusX);
    return { src: { x: r.sx, y: r.sy, w: r.sw, h: r.sh }, dst: { x: 0, y: 0, w: outW, h: outH }, background: null };
  }
  const scale = Math.min(outW / srcW, outH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  const dst = { x: (outW - w) / 2, y: (outH - h) / 2, w, h };
  let background: Rect | null = null;
  if (fit === "blur") {
    const cover = Math.max(outW / srcW, outH / srcH);
    background = { x: (outW - srcW * cover) / 2, y: (outH - srcH * cover) / 2, w: srcW * cover, h: srcH * cover };
  }
  return { src: { x: 0, y: 0, w: srcW, h: srcH }, dst, background };
}

const even = (n: number) => Math.round(n / 2) * 2;
const ts = (s: number) => s.toFixed(2);

/** The ffmpeg invocation that produces the same framing, for doing it server-side or in bulk. */
export function ffmpegCommand(input: string, output: string, format: OutputFormat, fit: Fit, start: number, end: number, focusX = 0.5) {
  const { width: W, height: H } = format;
  let filter: string;
  if (fit === "crop") {
    const cw = `ih*${W}/${H}`;
    filter = `-vf "crop=${cw}:ih:(iw-${cw})*${focusX.toFixed(2)}:0,scale=${W}:${H}"`;
    // Portrait-ish sources are wider in aspect than the target less often; ffmpeg clamps the crop.
  } else if (fit === "letterbox") {
    filter = `-vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black"`;
  } else {
    filter =
      `-filter_complex "[0:v]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:2,eq=brightness=-0.15[bg];` +
      `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"`;
  }
  const kbps = Math.round(format.bitrate / 1000);
  return `ffmpeg -ss ${ts(start)} -to ${ts(end)} -i "${input}" ${filter} -c:v libx264 -b:v ${kbps}k -c:a aac -b:a 160k -r 30 "${output}"`;
}

export function estimateBytes(videoBitrate: number, seconds: number, audioBitrate = 128_000) {
  return Math.round(((videoBitrate + audioBitrate) / 8) * Math.max(0, seconds));
}

/** Output size never exceeds what the source can fill without upscaling beyond 2x, and stays even for encoders. */
export function outputSize(format: OutputFormat, srcW: number, srcH: number) {
  const k = Math.min(1, (Math.max(srcW, srcH) * 2) / Math.max(format.width, format.height));
  return { width: even(format.width * k), height: even(format.height * k) };
}
