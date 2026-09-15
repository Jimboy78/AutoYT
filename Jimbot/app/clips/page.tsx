"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Captions, Clapperboard, Download, Film, Flame, HardDrive, Music, Scissors, Server, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EmptyLibrary, PageHeader, Panel, StatCard } from "@/components/studio/common";
import { API_CONFIGURED, apiAsset, listClips, listVideos, type Clip as ApiClip, type Video as ApiVideo } from "@/lib/api";
import { deleteRender, getProjectFile, type Project, type Render, type RenderKind } from "@/lib/library";
import { useProjects, useRenderFileUrl, useRenders } from "@/lib/library/hooks";
import type { Highlight } from "@/lib/studio/analyze";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

type Tab = "moments" | "renders" | "server";
type Sort = "score" | "recent" | "length";

const KIND: Record<RenderKind, { label: string; className: string }> = {
  short: { label: "Short", className: "bg-[#ff2e63] text-white" },
  conversion: { label: "Conversión", className: "bg-violet-500 text-white" },
  montage: { label: "Montaje", className: "bg-amber-400 text-black" },
  audio: { label: "Audio", className: "bg-sky-400 text-black" },
  thumbnail: { label: "Miniatura", className: "bg-emerald-400 text-black" },
};

function thumbFor(p: Project, h: Highlight) {
  const exact = p.thumbs.find((t) => t.highlightId === h.id);
  if (exact) return exact.dataUrl;
  const nearest = [...p.thumbs].sort((a, b) => Math.abs(a.time - h.peakTime) - Math.abs(b.time - h.peakTime))[0];
  return nearest?.dataUrl ?? p.poster;
}

function quoteFor(p: Project, h: Highlight) {
  const words = p.transcript?.segments.flatMap((s) => s.words).filter((w) => w.end > h.start && w.start < h.end) ?? [];
  return words.map((w) => w.text).join(" ");
}

export default function ClipsPage() {
  const { data: projects = [], loading } = useProjects();
  const { data: renders = [] } = useRenders();
  const [tab, setTab] = useState<Tab>("moments");
  const [projectId, setProjectId] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<Sort>("score");
  const urls = useProjectUrls();

  const moments = useMemo(() => {
    const list = projects
      .filter((p) => projectId === "all" || p.id === projectId)
      .flatMap((p) => p.highlights.map((h) => ({ project: p, h })))
      .filter(({ h }) => h.score >= minScore);
    return list.sort((a, b) =>
      sort === "score"
        ? b.h.score - a.h.score
        : sort === "length"
          ? b.h.end - b.h.start - (a.h.end - a.h.start)
          : b.project.updatedAt - a.project.updatedAt || a.h.start - b.h.start,
    );
  }, [projects, projectId, minScore, sort]);

  // Nothing local yet but a backend is connected: open on its clips instead of an empty tab.
  const localEmpty = !loading && projects.length === 0 && renders.length === 0;
  useEffect(() => {
    if (localEmpty && API_CONFIGURED) setTab("server");
  }, [localEmpty]);

  const visibleRenders = renders.filter((r) => projectId === "all" || r.projectId === projectId);
  const renderBytes = renders.reduce((acc, r) => acc + r.size, 0);
  const totalMoments = projects.reduce((acc, p) => acc + p.highlights.length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="GALERÍA DE CLIPS"
        description="Todos los momentos detectados en tus videos y todo lo que renderizaste: Shorts, conversiones y audio, guardados en este navegador."
      />

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      ) : projects.length === 0 && renders.length === 0 && !API_CONFIGURED ? (
        <EmptyLibrary />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Flame} label="Momentos" value={String(totalMoments)} accent />
            <StatCard icon={Film} label="Videos" value={String(projects.length)} />
            <StatCard icon={Clapperboard} label="Renders" value={String(renders.length)} />
            <StatCard icon={HardDrive} label="Espacio en renders" value={formatBytes(renderBytes)} />
          </div>

          <Panel className="flex flex-wrap items-center gap-4">
            <div className="flex rounded-lg border border-white/10 p-0.5" role="tablist">
              {(
                [
                  ["moments", `Momentos (${totalMoments})`],
                  ["renders", `Renders (${renders.length})`],
                  ...(API_CONFIGURED ? [["server", "Servidor"]] : []),
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", tab === id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white")}
                >
                  {label}
                </button>
              ))}
            </div>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 max-w-[220px] rounded-md border border-white/10 bg-zinc-950 px-3 text-sm" aria-label="Filtrar por video">
              <option value="all">Todos los videos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {tab === "moments" && (
              <>
                <div className="flex min-w-[220px] items-center gap-3">
                  <span className="text-sm text-zinc-400">Score ≥</span>
                  <Slider value={[minScore]} min={0} max={100} step={5} onValueChange={([v]) => setMinScore(v)} className="w-32" />
                  <span className="w-8 font-mono text-sm text-[#ff9f1c]">{minScore}</span>
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm" aria-label="Ordenar">
                  <option value="score">Mejor score</option>
                  <option value="length">Más largos</option>
                  <option value="recent">Video más reciente</option>
                </select>
              </>
            )}
          </Panel>

          {tab === "moments" &&
            (moments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Ningún momento con esos filtros.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="moments-grid">
                {moments.map(({ project, h }, i) => (
                  <MomentCard key={`${project.id}-${h.id}`} project={project} h={h} index={i} urls={urls} />
                ))}
              </div>
            ))}

          {tab === "renders" &&
            (visibleRenders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                Todavía no renderizaste nada. Creá un Short desde el{" "}
                <Link href="/studio" className="text-[#ff9f1c] hover:underline">
                  Studio
                </Link>{" "}
                o convertí un video en{" "}
                <Link href="/conversion" className="text-[#ff9f1c] hover:underline">
                  Conversión
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="renders-grid">
                {visibleRenders.map((r) => (
                  <RenderCard key={r.id} render={r} project={projects.find((p) => p.id === r.projectId)} />
                ))}
              </div>
            ))}

          {tab === "server" && API_CONFIGURED && <ServerClips />}
        </>
      )}
    </div>
  );
}

/** Object URLs for project files, created on first hover and released when leaving the page. */
function useProjectUrls() {
  const cache = useRef(new Map<string, Promise<string | null>>());
  useEffect(() => {
    const map = cache.current;
    return () => {
      map.forEach((p) => void p.then((url) => url && URL.revokeObjectURL(url)));
      map.clear();
    };
  }, []);
  return (id: string) => {
    let entry = cache.current.get(id);
    if (!entry) {
      entry = getProjectFile(id).then((blob) => (blob ? URL.createObjectURL(blob) : null));
      cache.current.set(id, entry);
    }
    return entry;
  };
}

function MomentCard({ project, h, index, urls }: { project: Project; h: Highlight; index: number; urls: (id: string) => Promise<string | null> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const quote = quoteFor(project, h);
  const thumb = thumbFor(project, h);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (hover) {
      v.currentTime = h.start;
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [hover, src, h.start]);

  return (
    <article
      className="animate-fade-in group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-0.5 hover:border-[#ff2e63]/50 hover:shadow-[0_16px_40px_-20px_#ff2e63]"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      onMouseEnter={() => {
        setHover(true);
        if (project.hasVideo && !src) void urls(project.id).then(setSrc);
      }}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative aspect-video bg-zinc-900">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {src && (
          <video
            ref={videoRef}
            src={src}
            muted
            playsInline
            preload="auto"
            className={cn("absolute inset-0 h-full w-full object-cover transition-opacity", hover ? "opacity-100" : "opacity-0")}
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= h.end) e.currentTarget.currentTime = h.start;
            }}
          />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-2 py-0.5 font-display text-sm tracking-wide text-white">{h.score}</span>
        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 font-mono text-xs text-white">
          {formatClock(h.start)} · {(h.end - h.start).toFixed(1)} s
        </span>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">
            #{h.id} · {project.name}
          </p>
        </div>
        {quote ? (
          <p className="line-clamp-2 text-xs italic text-zinc-400">“{quote}”</p>
        ) : (
          <p className="text-xs text-zinc-600">Pico de energía z {h.peakZ.toFixed(1)}</p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <ActionLink href={`/studio?p=${encodeURIComponent(project.id)}&h=${h.id}`} icon={Wand2} label="Short" />
          <ActionLink href={`/conversion?p=${encodeURIComponent(project.id)}&start=${h.start.toFixed(2)}&end=${h.end.toFixed(2)}`} icon={Scissors} label="Exportar" />
          <ActionLink href={`/transcriptions?p=${encodeURIComponent(project.id)}`} icon={Captions} label="Texto" />
        </div>
      </div>
    </article>
  );
}

function ActionLink({ href, icon: Icon, label }: { href: string; icon: typeof Wand2; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-[#ff9f1c]/60 hover:text-white">
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function RenderCard({ render, project }: { render: Render; project?: Project }) {
  const url = useRenderFileUrl(render.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [confirm, setConfirm] = useState(false);
  const kind = KIND[render.kind];
  const vertical = (render.height ?? 0) > (render.width ?? 0);

  return (
    <article className="animate-fade-in overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]" data-testid="render-card">
      <div className={cn("relative flex items-center justify-center bg-[radial-gradient(circle_at_center,#1a1a2e,#050508)]", "aspect-video")}>
        {render.kind === "audio" ? (
          <div className="flex w-full flex-col items-center gap-3 px-4">
            <Music className="h-10 w-10 text-sky-300" />
            {url && <audio src={url} controls className="w-full" />}
          </div>
        ) : (
          url && (
            <video
              ref={videoRef}
              src={url}
              muted
              playsInline
              preload="metadata"
              className={cn("h-full", vertical ? "w-auto" : "w-full object-contain")}
              onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
              onMouseLeave={(e) => e.currentTarget.pause()}
              controls
            />
          )
        )}
        <span className={cn("absolute left-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-semibold", kind.className)}>{kind.label}</span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate font-mono text-sm">{render.name}</p>
        <p className="text-xs text-zinc-500">
          {render.width && render.height ? `${render.width}×${render.height} · ` : ""}
          {render.duration ? `${render.duration.toFixed(1)} s · ` : ""}
          {formatBytes(render.size)} · {new Date(render.createdAt).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
        {project && <p className="truncate text-xs text-zinc-500">de {project.name}</p>}
        <div className="flex items-center gap-2 pt-1">
          {url && (
            <Button asChild size="sm" className="h-8 bg-emerald-500 text-black hover:bg-emerald-400">
              <a href={url} download={render.name}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Descargar
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn("ml-auto h-8", confirm ? "text-red-400" : "text-zinc-400")}
            onClick={() => (confirm ? void deleteRender(render.id) : setConfirm(true))}
            onBlur={() => setConfirm(false)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {confirm ? "¿Borrar?" : "Borrar"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function ServerClips() {
  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [clips, setClips] = useState<Record<string, ApiClip[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listVideos();
        if (cancelled) return;
        setVideos(list);
        const entries = await Promise.all(list.map(async (v) => [v.id, await listClips(v.id).catch(() => [])] as const));
        if (!cancelled) setClips(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>;
  return (
    <div className="space-y-6">
      {videos.map((v) => (
        <Panel key={v.id} className="space-y-3">
          <p className="flex items-center gap-2 font-medium">
            <Server className="h-4 w-4 text-violet-400" /> {v.filename}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(clips[v.id] ?? []).map((c) => (
              <a key={c.id} href={apiAsset(c.url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-white/10 hover:border-violet-400/60">
                {c.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apiAsset(c.thumbnail_url)} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-xs text-zinc-500">sin miniatura</div>
                )}
                <p className="p-2 font-mono text-xs text-zinc-400">
                  {formatClock(c.start)} → {formatClock(c.end)}
                </p>
              </a>
            ))}
          </div>
        </Panel>
      ))}
      {videos.length === 0 && <p className="text-sm text-zinc-500">El backend no tiene videos todavía.</p>}
    </div>
  );
}
