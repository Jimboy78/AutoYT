// Thumbnail compositor with three layouts, plus quick legibility checks.

export const THUMB_W = 1280;
export const THUMB_H = 720;

export type ThumbLayout = "impact" | "split" | "box";

export interface ThumbDesign {
  layout: ThumbLayout;
  title: string;
  color: string;
  badge: string;
  emoji: string;
  zoom: number;
  focusX: number;
  focusY: number;
}

export const LAYOUTS: { id: ThumbLayout; label: string }[] = [
  { id: "impact", label: "Impacto" },
  { id: "split", label: "Dividido" },
  { id: "box", label: "Caja" },
];

export const THUMB_COLORS = ["#ffe14d", "#ffffff", "#ff2e63", "#4ade80", "#38bdf8"];

export const DEFAULT_DESIGN: ThumbDesign = {
  layout: "impact",
  title: "NO VAS A CREER ESTO",
  color: "#ffe14d",
  badge: "HIGHLIGHT",
  emoji: "😳",
  zoom: 1.1,
  focusX: 0.5,
  focusY: 0.5,
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3) {
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
  return lines.slice(0, maxLines);
}

type Source = CanvasImageSource & { width: number; height: number };

/** Cover-fit `source` into a box with zoom around a focus point. */
function drawCover(ctx: CanvasRenderingContext2D, source: Source, x: number, y: number, w: number, h: number, d: ThumbDesign) {
  const scale = Math.max(w / source.width, h / source.height) * d.zoom;
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.min(source.width - sw, Math.max(0, d.focusX * source.width - sw / 2));
  const sy = Math.min(source.height - sh, Math.max(0, d.focusY * source.height - sh / 2));
  ctx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
}

function strokeText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke = 18) {
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke;
  ctx.strokeStyle = "#000";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawBadge(ctx: CanvasRenderingContext2D, label: string, font: string, x: number, y: number, angle: number) {
  if (!label.trim()) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `60px ${font}`;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width;
  ctx.fillStyle = "#ff2e63";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.roundRect(-w - 40, -44, w + 40, 88, 16);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#fff";
  ctx.fillText(label, -w - 20, 4);
  ctx.restore();
}

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  if (!emoji.trim()) return;
  ctx.save();
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 30;
  ctx.fillText(emoji, x, y);
  ctx.restore();
}

export function drawThumbnail(ctx: CanvasRenderingContext2D, source: Source, d: ThumbDesign, font: string) {
  const W = THUMB_W;
  const H = THUMB_H;
  const title = d.title.toUpperCase();
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.filter = "saturate(1.35) contrast(1.12)";

  if (d.layout === "split") {
    const cut = W * 0.58;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cut + 60, 0);
    ctx.lineTo(cut - 60, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.clip();
    drawCover(ctx, source, 0, 0, cut + 60, H, d);
    ctx.restore();
    ctx.filter = "none";
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cut + 60, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H);
    ctx.lineTo(cut - 60, H);
    ctx.closePath();
    const panel = ctx.createLinearGradient(cut, 0, W, H);
    panel.addColorStop(0, "#14141f");
    panel.addColorStop(1, "#050508");
    ctx.fillStyle = panel;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(cut + 52, 0);
    ctx.lineTo(cut + 68, 0);
    ctx.lineTo(cut - 52, H);
    ctx.lineTo(cut - 68, H);
    ctx.closePath();
    ctx.fill();
    ctx.font = `104px ${font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const lines = wrap(ctx, title, W - cut - 70, 4);
    const lh = 104;
    let y = H / 2 - ((lines.length - 1) * lh) / 2 + 10;
    for (const line of lines) {
      strokeText(ctx, line, cut + (W - cut) / 2 + 10, y, d.color, 14);
      y += lh;
    }
    drawEmoji(ctx, d.emoji, cut - 150, H - 130, 170);
    drawBadge(ctx, d.badge, font, cut - 80, 80, -0.05);
  } else if (d.layout === "box") {
    drawCover(ctx, source, 0, 0, W, H, d);
    ctx.filter = "none";
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.font = `110px ${font}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const lines = wrap(ctx, title, W - 220, 2);
    const lh = 118;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxH = lines.length * lh + 30;
    ctx.save();
    ctx.translate(W / 2, 60 + boxH / 2);
    ctx.rotate(-0.025);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.roundRect(-widest / 2 - 40, -boxH / 2, widest + 80, boxH, 22);
    ctx.fill();
    ctx.fillStyle = d.color === "#ffffff" || d.color === "#ffe14d" || d.color === "#4ade80" ? "#0b0b10" : "#ffffff";
    lines.forEach((line, i) => ctx.fillText(line, 0, -((lines.length - 1) * lh) / 2 + i * lh + 6));
    ctx.restore();
    drawEmoji(ctx, d.emoji, W - 150, H - 140, 190);
    drawBadge(ctx, d.badge, font, 420, H - 80, 0.04);
  } else {
    drawCover(ctx, source, 0, 0, W, H, d);
    ctx.filter = "none";
    const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
    ctx.font = `124px ${font}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const lines = wrap(ctx, title, W - 160, 3);
    let y = H - 64 - (lines.length - 1) * 120;
    for (const line of lines) {
      strokeText(ctx, line, 64, y, d.color);
      y += 120;
    }
    drawEmoji(ctx, d.emoji, 140, 130, 170);
    drawBadge(ctx, d.badge, font, W - 50, 90, 0.08);
  }
  ctx.restore();
}

export interface ThumbCheck {
  ok: boolean;
  label: string;
}

/** Heuristics that matter at the 168–360 px sizes thumbnails are actually seen at. */
export function thumbnailChecks(d: ThumbDesign, frameScore: number | null): ThumbCheck[] {
  const words = d.title.trim().split(/\s+/).filter(Boolean).length;
  return [
    { ok: words > 0 && words <= 5, label: `Texto corto: ${words} palabra${words === 1 ? "" : "s"} (ideal ≤ 5)` },
    { ok: d.title.length <= 28, label: `Se lee en móvil: ${d.title.length} caracteres (ideal ≤ 28)` },
    { ok: d.badge.length <= 12, label: `Sello breve (${d.badge.length} ≤ 12)` },
    { ok: frameScore === null || frameScore >= 55, label: frameScore === null ? "Frame sin puntaje" : `Frame con brillo, contraste y color: ${frameScore}/100` },
  ];
}
