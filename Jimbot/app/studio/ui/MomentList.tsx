"use client";

import { Flame, Play } from "lucide-react";
import type { Highlight } from "@/lib/studio/analyze";
import { formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

interface MomentListProps {
  highlights: Highlight[];
  selectedId: number | null;
  onPlay: (h: Highlight) => void;
}

export function MomentList({ highlights, selectedId, onPlay }: MomentListProps) {
  if (!highlights.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-zinc-500">
        <Flame className="h-8 w-8 text-zinc-700" />
        No hay picos por encima del umbral. Subí la sensibilidad.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {highlights.map((h, i) => (
        <li key={h.id}>
          <button
            onClick={() => onPlay(h)}
            className={cn(
              "animate-fade-in group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
              h.id === selectedId
                ? "border-[#ff9f1c]/70 bg-[#ff9f1c]/10"
                : "border-white/10 bg-white/[0.03] hover:border-[#ff2e63]/50 hover:bg-white/[0.06]",
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff2e63] to-[#ff9f1c] font-display text-lg text-white">
              {h.id}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm text-white">
                  {formatClock(h.start)} → {formatClock(h.end)}
                </span>
                <span className="text-xs text-zinc-500">{(h.end - h.start).toFixed(1)} s</span>
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c]"
                    style={{ width: `${h.score}%` }}
                  />
                </span>
                <span className="w-8 text-right font-mono text-xs text-[#ff9f1c]">{h.score}</span>
              </span>
            </span>
            <Play className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-white" />
          </button>
        </li>
      ))}
    </ol>
  );
}
