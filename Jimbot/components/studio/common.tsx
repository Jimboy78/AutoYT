"use client";

import Link from "next/link";
import { Captions, Film, Flame, Sparkles, UploadCloud } from "lucide-react";
import type { Project } from "@/lib/library";
import { formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-[#ff6b8b]">{eyebrow}</p>
        <h1 className="font-display text-4xl tracking-wide md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-zinc-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5", className)}>{children}</div>;
}

export function StatCard({ icon: Icon, label, value, hint, accent }: { icon: typeof Flame; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="animate-fade-in rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("mt-1 font-display text-3xl tracking-wide", accent && "text-gradient")}>{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function EmptyLibrary({ title = "Tu biblioteca está vacía", text }: { title?: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/15 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff2e63] to-[#ff9f1c]">
        <UploadCloud className="h-7 w-7 text-white" />
      </div>
      <div>
        <p className="font-display text-2xl tracking-wide">{title.toUpperCase()}</p>
        <p className="mt-1 max-w-md text-sm text-zinc-400">
          {text ?? "Analizá un video en el Studio (o probá con el de muestra) y va a aparecer acá, listo para usar en todas las herramientas."}
        </p>
      </div>
      <Link
        href="/studio"
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_24px_-8px_#ff2e63]"
      >
        <Sparkles className="h-4 w-4" /> Abrir Studio
      </Link>
    </div>
  );
}

export function ProjectPicker({
  projects,
  value,
  onChange,
  disabled,
}: {
  projects: Project[];
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Proyectos">
      {projects.map((p) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            role="option"
            aria-selected={on}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={cn(
              "group w-52 shrink-0 overflow-hidden rounded-xl border text-left transition-all disabled:opacity-60",
              on ? "border-[#ff2e63] shadow-[0_10px_30px_-14px_#ff2e63]" : "border-white/10 hover:border-white/30",
            )}
          >
            <div className="relative aspect-video bg-zinc-900">
              {p.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.poster} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  <Film className="h-6 w-6" />
                </div>
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 font-mono text-[11px] text-white">
                {formatClock(p.duration)}
              </span>
            </div>
            <div className="space-y-1 p-2.5">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-[#ff6b8b]" /> {p.highlights.length}
                </span>
                {p.transcript && (
                  <span className="flex items-center gap-1 text-sky-300">
                    <Captions className="h-3 w-3" /> {p.transcript.segments.length}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Energy sparkline with moment overlays; `onSeek` makes it clickable. */
export function MomentTimeline({
  db,
  duration,
  highlights,
  accent = "#ff2e63",
  onSeek,
  height = 56,
}: {
  db: Float32Array;
  duration: number;
  highlights: { id: number; start: number; end: number }[];
  accent?: string;
  onSeek?: (time: number) => void;
  height?: number;
}) {
  const bars = 160;
  const per = Math.max(1, Math.floor(db.length / bars));
  const levels: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let b = 0; b < bars; b++) {
    let m = -120;
    for (let i = b * per; i < Math.min(db.length, (b + 1) * per); i++) m = Math.max(m, db[i]);
    levels.push(m);
    if (m > -100) lo = Math.min(lo, m);
    hi = Math.max(hi, m);
  }
  const span = Math.max(1, hi - lo);

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg bg-black/40", onSeek && "cursor-pointer")}
      style={{ height }}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - rect.left) / rect.width) * duration);
      }}
    >
      <div className="absolute inset-0 flex items-end gap-px px-px">
        {levels.map((l, i) => (
          <div key={i} className="flex-1 rounded-t-sm bg-violet-400/40" style={{ height: `${Math.max(4, ((l - lo) / span) * 100)}%` }} />
        ))}
      </div>
      {highlights.map((h) => (
        <div
          key={h.id}
          className="absolute inset-y-0 border-x"
          style={{
            left: `${(h.start / duration) * 100}%`,
            width: `${Math.max(0.4, ((h.end - h.start) / duration) * 100)}%`,
            background: `${accent}33`,
            borderColor: accent,
          }}
        />
      ))}
    </div>
  );
}
