import { frameLayout, type Fit } from "./presets";

/** Draws the current video frame onto an output canvas using the chosen framing. */
export function drawFramed(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number, fit: Fit, focusX: number) {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const layout = frameLayout(vw, vh, width, height, fit, focusX);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  if (layout.background) {
    const b = layout.background;
    ctx.filter = `blur(${Math.max(8, Math.round(Math.max(width, height) / 40))}px) brightness(0.55) saturate(1.3)`;
    ctx.drawImage(video, b.x, b.y, b.w, b.h);
    ctx.filter = "none";
  }
  const { src, dst } = layout;
  ctx.drawImage(video, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
}
