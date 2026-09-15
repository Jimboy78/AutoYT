"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Download, ImageIcon, Loader2, RefreshCw, Save, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { EmptyLibrary, PageHeader, Panel, ProjectPicker } from "@/components/studio/common";
import { deleteRender, saveRender, updateProject, type Project, type ProjectThumb, type Render } from "@/lib/library";
import { useActiveProject, useProjectFileUrl, useRenderFileUrl, useRenders } from "@/lib/library/hooks";
import { cleanName } from "@/lib/publish/metadata";
import { pickFrameTimes } from "@/lib/studio/analyze";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { captureFrame, extractFrames } from "@/lib/studio/frames";
import { startTask } from "@/lib/tasks";
import { DEFAULT_DESIGN, drawThumbnail, LAYOUTS, THUMB_COLORS, THUMB_H, THUMB_W, thumbnailChecks, type ThumbDesign } from "@/lib/thumbs/render";
import { keywords } from "@/lib/transcribe/format";
import { cn } from "@/lib/utils";

const EMOJIS = ["", "😳", "🔥", "😱", "🤯", "💀", "🏆"];

function displayFont() {
  const family = getComputedStyle(document.body).getPropertyValue("--font-display").trim();
  return family || "Impact, sans-serif";
}

/** Short all-caps hooks from what is actually said in the video. */
function textIdeas(project: Project) {
  const text = project.transcript?.segments.map((s) => s.text).join(" ") ?? "";
  const words = keywords(text || cleanName(project.name), 6).map((k) => k.word.toUpperCase());
  const ideas = new Set<string>();
  if (words[0]) ideas.add(`¡${words[0]}!`);
  if (words[1]) ideas.add(`${words[0]} ${words[1]}`);
  if (words[0]) ideas.add(`ESTO ES ${words[0]}`);
  ideas.add("NO VAS A CREER ESTO");
  if (project.highlights.length) ideas.add(`TOP ${Math.min(project.highlights.length, 10)} MOMENTOS`);
  return [...ideas].slice(0, 5);
}

export default function ThumbnailsPage() {
  const { projects, project, select, loading } = useActiveProject();
  const fileUrl = useProjectFileUrl(project?.id);
  const renders = useRenders(project?.id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<ProjectThumb[]>([]);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [frameTime, setFrameTime] = useState<number | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [design, setDesign] = useState<ThumbDesign>(DEFAULT_DESIGN);
  const [font, setFont] = useState("Impact, sans-serif");
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState<Render | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectKey = project?.id;
  const set = <K extends keyof ThumbDesign>(key: K, value: ThumbDesign[K]) => setDesign((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    void document.fonts.ready.then(() => setFont(displayFont()));
  }, []);

  // New project: its stored candidates, best first, and the best one selected.
  useEffect(() => {
    if (!project) return;
    const sorted = [...project.thumbs].sort((a, b) => b.score - a.score);
    setFrames(sorted);
    setFrameTime(project.publish?.thumbTime ?? sorted[0]?.time ?? 0);
    setSaved(null);
    setError(null);
    setDesign((d) => ({ ...d, title: textIdeas(project)[0] ?? d.title }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  useEffect(() => {
    setSource(null);
    if (!fileUrl || frameTime === null || !project?.hasVideo) return;
    let cancelled = false;
    captureFrame(fileUrl, frameTime)
      .then((c) => !cancelled && setSource(c))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [fileUrl, frameTime, project?.hasVideo]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !source) return;
    drawThumbnail(ctx, source, design, font);
    const timer = setTimeout(() => setPreview(canvasRef.current?.toDataURL("image/jpeg", 0.8) ?? null), 150);
    return () => clearTimeout(timer);
  }, [source, design, font]);

  const rescan = async () => {
    if (!project || !fileUrl) return;
    const task = startTask({ kind: "thumbnail", title: `Frames · ${project.name}`, projectId: project.id });
    const known = pickFrameTimes(project.duration, project.highlights);
    // A denser pass than the analysis: 24 evenly spaced frames plus every moment peak.
    const targets = [...known.filter((t) => t.highlightId), ...Array.from({ length: 24 }, (_, i) => ({ time: ((i + 0.5) / 24) * project.duration }))];
    setScan({ done: 0, total: targets.length });
    try {
      const found = await extractFrames(fileUrl, targets, (done, total) => {
        setScan({ done, total });
        task.update({ progress: done / total });
      });
      const merged = [...found.map(({ time, score, highlightId, dataUrl }) => ({ time, score, highlightId, dataUrl }))]
        .sort((a, b) => b.score - a.score)
        .filter((f, i, all) => all.findIndex((g) => Math.abs(g.time - f.time) < 1) === i);
      setFrames(merged);
      await updateProject(project.id, { thumbs: merged.slice(0, 12) });
      task.done(`${merged.length} frames · mejor ${merged[0]?.score ?? 0}/100`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      task.fail(err);
    } finally {
      setScan(null);
    }
  };

  const save = async () => {
    if (!project || !canvasRef.current || frameTime === null) return;
    setSaving(true);
    setError(null);
    const task = startTask({ kind: "thumbnail", title: `Miniatura · ${project.name}`, projectId: project.id });
    try {
      const blob = await new Promise<Blob | null>((r) => canvasRef.current?.toBlob(r, "image/png"));
      if (!blob) throw new Error("No se pudo exportar el canvas.");
      const base = project.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_");
      const render = await saveRender(
        { projectId: project.id, kind: "thumbnail", name: `${base}_thumb_${Math.round(frameTime)}s.png`, mime: "image/png", width: THUMB_W, height: THUMB_H, settings: { ...design, time: frameTime } },
        blob,
      );
      await updateProject(project.id, (p) => ({ publish: { title: p.publish?.title ?? "", description: p.publish?.description ?? "", tags: p.publish?.tags ?? [], thumbTime: frameTime } }));
      setSaved(render);
      task.done(formatBytes(blob.size));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      task.fail(err);
    } finally {
      setSaving(false);
    }
  };

  const currentFrame = frames.find((f) => f.time === frameTime);
  const checks = useMemo(() => thumbnailChecks(design, currentFrame?.score ?? null), [design, currentFrame?.score]);
  const ideas = useMemo(() => (project ? textIdeas(project) : []), [project]);
  const thumbs = (renders.data ?? []).filter((r) => r.kind === "thumbnail");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Miniaturas"
        title="THUMBNAIL LAB"
        description="Elegí el frame con mejor brillo, contraste y color de tu video, componé la miniatura y mirá cómo se ve en el feed antes de subirla."
      />

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      ) : !project ? (
        <EmptyLibrary text="Analizá un video en el Studio: sus mejores frames aparecen acá listos para convertirse en miniatura." />
      ) : !project.hasVideo ? (
        <>
          <ProjectPicker projects={projects} value={project.id} onChange={select} />
          <Panel>
            <p className="text-sm text-zinc-400">Este proyecto es solo audio: no tiene frames para una miniatura.</p>
          </Panel>
        </>
      ) : (
        <>
          <ProjectPicker projects={projects} value={project.id} onChange={select} disabled={!!scan || saving} />

          <Panel className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Frames candidatos · ordenados por puntaje</p>
              <Button size="sm" variant="outline" onClick={rescan} disabled={!!scan || !fileUrl} className="border-white/15 bg-transparent" data-testid="rescan">
                {scan ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                {scan ? `Escaneando ${scan.done}/${scan.total}` : "Escanear más frames"}
              </Button>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" data-testid="frames">
              {frames.map((f) => (
                <button
                  key={f.time}
                  onClick={() => setFrameTime(f.time)}
                  aria-pressed={f.time === frameTime}
                  aria-label={`Frame en ${formatClock(f.time)}, puntaje ${f.score}`}
                  className={cn("relative w-40 shrink-0 overflow-hidden rounded-lg border-2 transition-all", f.time === frameTime ? "border-[#ffe14d]" : "border-transparent opacity-80 hover:opacity-100")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.dataUrl} alt="" className="aspect-video w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/75 px-1 font-mono text-[10px] text-white">{formatClock(f.time)}</span>
                  <span className={cn("absolute right-1 top-1 rounded px-1 font-mono text-[10px] font-bold", f.score >= 55 ? "bg-emerald-400 text-black" : "bg-zinc-700 text-white")}>{f.score}</span>
                  {f.highlightId && <span className="absolute bottom-1 left-1 rounded bg-[#ff2e63] px-1 text-[10px] font-semibold text-white">#{f.highlightId}</span>}
                </button>
              ))}
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                <canvas ref={canvasRef} width={THUMB_W} height={THUMB_H} className="h-full w-full" data-testid="thumb-canvas" />
                {!source && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                  </div>
                )}
              </div>

              <Panel className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Así se ve en YouTube</p>
                <div className="flex flex-wrap items-start gap-6" data-testid="feed-preview">
                  <FeedCard preview={preview} project={project} width={320} label="Inicio (escritorio)" />
                  <FeedCard preview={preview} project={project} width={168} label="Sugeridos (móvil)" compact />
                </div>
              </Panel>
            </div>

            <Panel className="space-y-5">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Layout</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      role="radio"
                      aria-checked={design.layout === l.id}
                      onClick={() => set("layout", l.id)}
                      className={cn("rounded-lg border px-2 py-2 text-sm", design.layout === l.id ? "border-[#ffe14d] bg-[#ffe14d]/10 text-[#ffe14d]" : "border-white/10 hover:border-white/25")}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Texto</p>
                <Input value={design.title} maxLength={48} onChange={(e) => set("title", e.target.value)} className="border-white/10 bg-white/5" aria-label="Texto de la miniatura" />
                <div className="flex flex-wrap gap-1.5">
                  {ideas.map((idea) => (
                    <button key={idea} onClick={() => set("title", idea)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-[#ffe14d]/60">
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {THUMB_COLORS.map((c) => (
                  <button key={c} aria-label={`Color ${c}`} onClick={() => set("color", c)} className={cn("h-8 w-8 rounded-full border-2", design.color === c ? "border-white" : "border-transparent")} style={{ background: c }} />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs text-zinc-500">
                  Sello
                  <Input value={design.badge} maxLength={16} onChange={(e) => set("badge", e.target.value.toUpperCase())} className="border-white/10 bg-white/5" />
                </label>
                <div className="space-y-1 text-xs text-zinc-500">
                  Emoji
                  <div className="flex flex-wrap gap-1">
                    {EMOJIS.map((e) => (
                      <button key={e || "none"} onClick={() => set("emoji", e)} className={cn("h-8 w-8 rounded-md border text-base", design.emoji === e ? "border-white/60 bg-white/10" : "border-white/10")}>
                        {e || "∅"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <SliderRow label="Zoom" value={design.zoom} min={1} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => set("zoom", v)} />
                <SliderRow label="Foco X" value={design.focusX} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("focusX", v)} />
                <SliderRow label="Foco Y" value={design.focusY} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("focusY", v)} />
              </div>

              <ul className="space-y-1.5" data-testid="thumb-checks">
                {checks.map((c) => (
                  <li key={c.label} className={cn("flex items-center gap-2 text-xs", c.ok ? "text-emerald-300" : "text-amber-300")}>
                    {c.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />} {c.label}
                  </li>
                ))}
              </ul>

              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <Button onClick={save} disabled={!source || saving} className="bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] text-white" data-testid="thumb-save">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Guardar PNG
                </Button>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300" data-testid="thumb-saved">
                    <Check className="h-3.5 w-3.5" /> Guardada · <Link href={`/youtube?p=${project.id}`} className="underline">armar publicación</Link>
                  </span>
                )}
              </div>
            </Panel>
          </div>

          {thumbs.length > 0 && (
            <Panel className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Miniaturas guardadas ({thumbs.length})</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {thumbs.map((r) => (
                  <SavedThumb key={r.id} render={r} />
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

function FeedCard({ preview, project, width, label, compact }: { preview: string | null; project: Project; width: number; label: string; compact?: boolean }) {
  const title = project.publish?.title || cleanName(project.name);
  return (
    <figure style={{ width }} className="space-y-1.5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="h-full w-full object-cover" />}
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 font-mono text-[10px] text-white">{formatClock(project.duration)}</span>
      </div>
      <p className={cn("line-clamp-2 font-medium leading-snug", compact ? "text-[11px]" : "text-sm")}>{title}</p>
      <figcaption className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</figcaption>
    </figure>
  );
}

function SliderRow({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-xs text-zinc-500">{label}</span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
      <span className="w-12 text-right font-mono text-xs text-zinc-400">{format(value)}</span>
    </div>
  );
}

function SavedThumb({ render }: { render: Render }) {
  const url = useRenderFileUrl(render.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30" data-testid="saved-thumb">
      <div className="aspect-video bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={render.name} className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-6 w-6 text-zinc-600" />}
      </div>
      <div className="flex items-center justify-between gap-2 p-2">
        <span className="truncate font-mono text-[10px] text-zinc-400">{formatBytes(render.size)}</span>
        <div className="flex gap-1">
          {url && (
            <Button asChild size="icon" variant="ghost" className="h-7 w-7">
              <a href={url} download={render.name} aria-label="Descargar miniatura">
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-7 w-7", confirm && "text-red-400")}
            aria-label={confirm ? "Confirmar borrado" : "Borrar miniatura"}
            onClick={() => (confirm ? void deleteRender(render.id) : setConfirm(true))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
