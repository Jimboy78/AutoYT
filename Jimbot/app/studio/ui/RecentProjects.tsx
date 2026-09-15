"use client";

import { useEffect, useState } from "react";
import { Captions, Film, Flame, HardDrive, Trash2 } from "lucide-react";
import { deleteProject, storageEstimate } from "@/lib/library";
import { useProjects } from "@/lib/library/hooks";
import { formatBytes, formatClock } from "@/lib/studio/format";

export function RecentProjects({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: projects = [], loading } = useProjects();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, [projects.length]);

  if (loading || projects.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl tracking-wide">TU BIBLIOTECA</h2>
        {usage && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <HardDrive className="h-3.5 w-3.5" /> {formatBytes(usage.usage)} usados en este navegador
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-[#ff2e63]/50">
            <button onClick={() => onOpen(p.id)} className="block w-full text-left" aria-label={`Abrir ${p.name}`}>
              <div className="relative aspect-video bg-zinc-900">
                {p.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-600">
                    <Film className="h-8 w-8" />
                  </div>
                )}
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 font-mono text-xs text-white">{formatClock(p.duration)}</span>
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate font-medium">{p.name}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-[#ff6b8b]" /> {p.highlights.length} momentos
                  </span>
                  {p.transcript && (
                    <span className="flex items-center gap-1 text-sky-300">
                      <Captions className="h-3.5 w-3.5" /> transcripto
                    </span>
                  )}
                  <span className="ml-auto">{new Date(p.updatedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
                </div>
              </div>
            </button>
            <button
              onClick={() => void deleteProject(p.id)}
              aria-label={`Borrar ${p.name}`}
              className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-zinc-300 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
