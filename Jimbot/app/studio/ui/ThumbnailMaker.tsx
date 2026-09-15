"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { captureFrame, type FrameCandidate } from "@/lib/studio/frames";
import { formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

const W = 1280;
const H = 720;
const COLORS = ["#ffe14d", "#ffffff", "#ff2e63", "#4ade80"];

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

interface ThumbnailMakerProps {
  frame: FrameCandidate | null;
  src: string;
  onClose: () => void;
}

export function ThumbnailMaker({ frame, src, onClose }: ThumbnailMakerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [title, setTitle] = useState("NO VAS A CREER ESTO");
  const [color, setColor] = useState(COLORS[0]);
  const [badge, setBadge] = useState(true);

  useEffect(() => {
    setSource(null);
    if (!frame) return;
    let cancelled = false;
    captureFrame(src, frame.time).then((c) => !cancelled && setSource(c));
    return () => {
      cancelled = true;
    };
  }, [frame, src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !source) return;

    // Cover-fit the frame, slightly punched up.
    const scale = Math.max(W / source.width, H / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    ctx.filter = "saturate(1.35) contrast(1.12)";
    ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.filter = "none";

    const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    const display = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "Impact";
    ctx.font = `120px ${display}`;
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    const lines = wrapLines(ctx, title.toUpperCase(), W - 140);
    let y = H - 60 - (lines.length - 1) * 118;
    for (const line of lines) {
      ctx.lineWidth = 18;
      ctx.strokeStyle = "#000";
      ctx.strokeText(line, 64, y);
      ctx.fillStyle = color;
      ctx.fillText(line, 64, y);
      y += 118;
    }

    if (badge) {
      ctx.save();
      ctx.translate(W - 70, 70);
      ctx.rotate(0.08);
      ctx.font = `64px ${display}`;
      const label = "HIGHLIGHT";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "#ff2e63";
      ctx.beginPath();
      ctx.roundRect(-tw - 36, -20, tw + 36, 88, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, -tw - 18, 48);
      ctx.restore();
    }
  }, [source, title, color, badge]);

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autoyt-thumbnail-${Math.round(frame?.time ?? 0)}s.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  return (
    <Dialog open={!!frame} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl border-white/10 bg-[#0d0d16]">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wide">MINIATURA 1280×720</DialogTitle>
          <DialogDescription>
            Frame en {formatClock(frame?.time ?? 0)} · puntaje {frame?.score ?? 0}/100
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          <canvas ref={canvasRef} width={W} height={H} className="h-full w-full" />
          {!source && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={title}
            maxLength={48}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[220px] flex-1 border-white/10 bg-white/5"
            placeholder="Texto de la miniatura"
          />
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn("h-8 w-8 rounded-full border-2", color === c ? "border-white" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
          </div>
          <Button variant="outline" onClick={() => setBadge((b) => !b)} className="border-white/15 bg-transparent">
            {badge ? "Quitar sello" : "Agregar sello"}
          </Button>
          <Button onClick={download} disabled={!source} className="bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] text-white">
            <Download className="mr-2 h-4 w-4" /> Descargar PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
