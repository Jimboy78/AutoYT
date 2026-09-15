"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Highlight, Segment } from "@/lib/studio/analyze";
import { formatClock } from "@/lib/studio/format";

const HEIGHT = 190;

interface WaveformProps {
  waveform: Float32Array;
  z: Float32Array;
  duration: number;
  highlights: Highlight[];
  silences: Segment[];
  selectedId: number | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSeek: (time: number) => void;
}

function setupCanvas(canvas: HTMLCanvasElement, width: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = HEIGHT * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function Waveform({ waveform, z, duration, highlights, silences, selectedId, videoRef, onSeek }: WaveformProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Static layer: silences, highlight regions, amplitude bars, energy curve.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas || !width || !duration) return;
    const ctx = setupCanvas(canvas, width);
    ctx.clearRect(0, 0, width, HEIGHT);
    const x = (t: number) => (t / duration) * width;

    ctx.fillStyle = "rgba(148,163,184,0.08)";
    for (const s of silences) ctx.fillRect(x(s.start), 0, Math.max(1, x(s.end) - x(s.start)), HEIGHT);

    for (const h of highlights) {
      const selected = h.id === selectedId;
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, selected ? "rgba(255,46,99,0.5)" : "rgba(255,46,99,0.22)");
      g.addColorStop(1, "rgba(255,159,28,0.04)");
      ctx.fillStyle = g;
      ctx.fillRect(x(h.start), 0, x(h.end) - x(h.start), HEIGHT);
      ctx.fillStyle = selected ? "#ff9f1c" : "#ff2e63";
      ctx.fillRect(x(h.start), 0, x(h.end) - x(h.start), 3);
    }

    const mid = HEIGHT * 0.56;
    const step = 3;
    for (let px = 0; px < width; px += step) {
      const t = (px / width) * duration;
      const a = Math.floor((px / width) * waveform.length);
      const b = Math.max(a + 1, Math.floor(((px + step) / width) * waveform.length));
      let v = 0;
      for (let i = a; i < b && i < waveform.length; i++) v = Math.max(v, waveform[i]);
      const bar = Math.max(1.5, v * HEIGHT * 0.4);
      const inHighlight = highlights.some((h) => t >= h.start && t <= h.end);
      ctx.fillStyle = inHighlight ? "#ff6b8b" : "#3b3b52";
      ctx.fillRect(px, mid - bar, step - 1, bar * 1.6);
    }

    ctx.beginPath();
    for (let px = 0; px <= width; px += 2) {
      const a = Math.floor((px / width) * z.length);
      const b = Math.max(a + 1, Math.floor(((px + 2) / width) * z.length));
      let v = -Infinity;
      for (let i = a; i < b && i < z.length; i++) v = Math.max(v, z[i]);
      if (!Number.isFinite(v)) continue;
      const y = HEIGHT - 10 - ((Math.max(-3, Math.min(8, v)) + 3) / 11) * (HEIGHT - 28);
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.strokeStyle = "rgba(167,139,250,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [width, waveform, z, duration, highlights, silences, selectedId]);

  // Playhead layer, repainted from the <video> clock without re-rendering React.
  useEffect(() => {
    const canvas = headRef.current;
    if (!canvas || !width || !duration) return;
    const ctx = setupCanvas(canvas, width);
    let raf = 0;
    let last = -1;
    const tick = () => {
      const t = videoRef.current?.currentTime ?? 0;
      if (t !== last) {
        last = t;
        ctx.clearRect(0, 0, width, HEIGHT);
        const px = (t / duration) * width;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 0, px, HEIGHT);
        ctx.fillStyle = "#fff";
        ctx.fillRect(px - 1, 0, 2, HEIGHT);
        ctx.beginPath();
        ctx.arc(px, 7, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [width, duration, videoRef]);

  const timeAt = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((clientX - rect.left) / rect.width) * duration));
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative cursor-crosshair overflow-hidden rounded-xl border border-white/10 bg-[#0d0d16]"
        style={{ height: HEIGHT }}
        onMouseMove={(e) => setHover(timeAt(e.clientX))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => onSeek(timeAt(e.clientX))}
      >
        <canvas ref={baseRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={headRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-0.5 font-mono text-xs text-white"
            style={{ left: `${(hover / duration) * 100}%` }}
          >
            {formatClock(hover)}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-zinc-500">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f}>{formatClock(duration * f)}</span>
        ))}
      </div>
    </div>
  );
}
