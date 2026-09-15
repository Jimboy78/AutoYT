"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Loader2, RefreshCw, Server, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/studio/common";
import { API_CONFIGURED, listVideos, type Video } from "@/lib/api";
import { formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Subido", className: "bg-zinc-500/20 text-zinc-300" },
  processing: { label: "Procesando", className: "bg-violet-500/20 text-violet-200" },
  processed: { label: "Listo", className: "bg-emerald-500/20 text-emerald-300" },
  error: { label: "Error", className: "bg-red-500/20 text-red-300" },
};

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setVideos(await listVideos());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (API_CONFIGURED) void load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Servidor"
        title="VIDEOS"
        description="Videos subidos al backend FastAPI: ffmpeg los transcodifica, el detector de energía corta cada momento en su propio clip y faster-whisper los transcribe."
        actions={
          API_CONFIGURED && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-white/15 bg-transparent">
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> Actualizar
              </Button>
              <Button asChild size="sm" className="bg-gradient-to-r from-violet-500 to-[#ff2e63] text-white">
                <Link href="/upload">
                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Subir
                </Link>
              </Button>
            </div>
          )
        }
      />

      {!API_CONFIGURED ? (
        <Panel className="flex flex-wrap items-center gap-4">
          <Server className="h-6 w-6 text-yellow-300" />
          <p className="min-w-[220px] flex-1 text-sm text-zinc-300">
            Esta instancia no tiene backend (<code className="font-mono text-zinc-200">NEXT_PUBLIC_API_BASE</code>). Todo lo demás funciona en tu navegador: empezá por el Studio.
          </p>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-3.5 py-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4" /> Abrir Studio
          </Link>
        </Panel>
      ) : error ? (
        <Panel>
          <p className="text-sm text-red-300">No se pudo leer el backend: {error}</p>
        </Panel>
      ) : !videos ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : videos.length === 0 ? (
        <Panel className="text-center text-sm text-zinc-400">
          Todavía no hay videos en el servidor. <Link href="/upload" className="text-[#ff9fb4] underline">Subí el primero</Link>.
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="server-videos">
          {videos.map((v) => {
            const status = STATUS_STYLE[v.status] ?? { label: v.status, className: "bg-zinc-500/20 text-zinc-300" };
            return (
              <li key={v.id}>
                <Link href={`/videos/${encodeURIComponent(v.id)}`} className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/30">
                  <div className="mb-3 flex aspect-video items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-[#ff2e63]/10">
                    <Film className="h-8 w-8 text-zinc-500 transition-transform group-hover:scale-110" />
                  </div>
                  <p className="truncate font-medium">{v.filename}</p>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-400">{v.duration ? formatClock(v.duration) : "—"}</span>
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", status.className)}>{status.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
