"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Captions, Check, CheckCircle2, Copy, Download, ImageIcon, RotateCcw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyLibrary, PageHeader, Panel, ProjectPicker } from "@/components/studio/common";
import { updateProject, type Project } from "@/lib/library";
import { useActiveProject, useRenderFileUrl, useRenders } from "@/lib/library/hooks";
import { cleanName, descriptionFor, exportText, LIMITS, tagsFor, titleIdeas, validate, type PublishMeta } from "@/lib/publish/metadata";
import { formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

interface Options {
  chapters: boolean;
  summary: boolean;
  credit: boolean;
}

const DEFAULT_OPTIONS: Options = { chapters: true, summary: true, credit: false };

function generate(project: Project, options: Options, title?: string, tags = tagsFor(project)): PublishMeta {
  const t = title ?? titleIdeas(project)[0] ?? cleanName(project.name);
  return { title: t, description: descriptionFor(project, t, tags, options), tags };
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn("font-mono text-[11px]", value > max ? "text-red-400" : value > max * 0.9 ? "text-amber-300" : "text-zinc-500")}>{value}/{max}</span>;
}

export default function YouTubePage() {
  const { projects, project, select, loading } = useActiveProject();
  const renders = useRenders(project?.id);
  const [meta, setMeta] = useState<PublishMeta | null>(null);
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [tagDraft, setTagDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const projectKey = project?.id;

  // Load the saved draft, or build one from the project's transcript, moments and chapters.
  useEffect(() => {
    if (!project || loadedFor.current === project.id) return;
    loadedFor.current = project.id;
    const draft = project.publish;
    setMeta(draft?.title ? { title: draft.title, description: draft.description, tags: draft.tags } : generate(project, DEFAULT_OPTIONS));
    setOptions(DEFAULT_OPTIONS);
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  // Autosave the draft into the project (keeps thumbTime chosen in the Thumbnail Lab).
  useEffect(() => {
    if (!meta || !projectKey) return;
    const timer = setTimeout(async () => {
      await updateProject(projectKey, (p) => ({ publish: { ...meta, thumbTime: p.publish?.thumbTime } }));
      setSavedAt(Date.now());
    }, 600);
    return () => clearTimeout(timer);
  }, [meta, projectKey]);

  const checks = useMemo(() => (meta ? validate(meta) : []), [meta]);
  const ideas = useMemo(() => (project ? titleIdeas(project) : []), [project]);
  const thumb = (renders.data ?? []).find((r) => r.kind === "thumbnail");
  const thumbUrl = useRenderFileUrl(thumb?.id);

  if (loading) return <div className="mx-auto h-48 max-w-7xl animate-pulse rounded-2xl bg-white/5" />;

  const patch = (change: Partial<PublishMeta>) => setMeta((m) => (m ? { ...m, ...change } : m));

  // Toggles and title ideas rebuild the description but keep the user's tags; "Regenerar" resets all.
  const regenerate = (next: Options, title = meta?.title, tags = meta?.tags) => {
    if (!project) return;
    setOptions(next);
    setMeta(generate(project, next, title, tags));
  };

  const addTag = () => {
    const tag = tagDraft.replace(/[<>,]/g, "").trim();
    if (!tag || !meta || meta.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return setTagDraft("");
    patch({ tags: [...meta.tags, tag] });
    setTagDraft("");
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const txtUrl = meta ? `data:text/plain;charset=utf-8,${encodeURIComponent(exportText(meta))}` : "#";
  const ready = checks.filter((c) => c.id !== "hook").every((c) => c.ok);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Publicación"
        title="PAQUETE PARA YOUTUBE"
        description="Título, descripción con capítulos y etiquetas generados a partir de lo que realmente pasa y se dice en tu video, validados contra los límites de YouTube."
        actions={
          savedAt && (
            <span className="flex items-center gap-1 text-xs text-emerald-300" data-testid="draft-saved">
              <Check className="h-3.5 w-3.5" /> Borrador guardado en el proyecto
            </span>
          )
        }
      />

      {!project || !meta ? (
        <EmptyLibrary text="Analizá (y si querés, transcribí) un video: acá se arma su título, descripción con capítulos y etiquetas." />
      ) : (
        <>
          <ProjectPicker projects={projects} value={project.id} onChange={select} />

          {!project.transcript && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/[0.07] p-3 text-sm text-sky-200">
              <Captions className="h-4 w-4" /> Sin transcripción, las ideas salen solo del nombre y los momentos.
              <Link href={`/transcriptions?p=${project.id}`} className="font-semibold underline">
                Transcribir con Whisper
              </Link>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <Panel className="min-w-0 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="yt-title" className="text-xs uppercase tracking-wider text-zinc-500">
                    Título
                  </label>
                  <Counter value={meta.title.length} max={LIMITS.title} />
                </div>
                <Input id="yt-title" value={meta.title} onChange={(e) => patch({ title: e.target.value })} className="border-white/10 bg-white/5" data-testid="yt-title" />
                <div className="flex flex-wrap gap-1.5" data-testid="title-ideas">
                  {ideas.map((idea) => (
                    <button
                      key={idea}
                      onClick={() => regenerate(options, idea)}
                      className={cn("rounded-full border px-2.5 py-1 text-left text-[11px]", idea === meta.title ? "border-[#ff2e63] text-[#ff9fb4]" : "border-white/10 text-zinc-300 hover:border-white/30")}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="yt-description" className="text-xs uppercase tracking-wider text-zinc-500">
                    Descripción
                  </label>
                  <Counter value={meta.description.length} max={LIMITS.description} />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-300">
                  {(
                    [
                      ["chapters", "Capítulos"],
                      ["summary", "Resumen"],
                      ["credit", "Crédito AutoYT"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <Switch checked={options[key]} onCheckedChange={(on) => regenerate({ ...options, [key]: on })} aria-label={label} />
                      {label}
                    </label>
                  ))}
                  <button onClick={() => project && regenerate(options, undefined, tagsFor(project))} className="flex items-center gap-1 text-zinc-400 hover:text-white">
                    <RotateCcw className="h-3 w-3" /> Regenerar
                  </button>
                </div>
                <Textarea id="yt-description" value={meta.description} onChange={(e) => patch({ description: e.target.value })} rows={12} className="border-white/10 bg-white/5 font-mono text-xs leading-5" data-testid="yt-description" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Etiquetas</span>
                  <Counter value={meta.tags.join(",").length} max={LIMITS.tags} />
                </div>
                <div className="flex flex-wrap gap-1.5" data-testid="yt-tags">
                  {meta.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2.5 pr-1 text-xs">
                      {tag}
                      <button aria-label={`Quitar ${tag}`} onClick={() => patch({ tags: meta.tags.filter((t) => t !== tag) })} className="rounded-full p-0.5 hover:bg-white/20">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTag();
                  }}
                  className="flex gap-2"
                >
                  <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Agregar etiqueta" className="border-white/10 bg-white/5" aria-label="Nueva etiqueta" />
                  <Button type="submit" variant="outline" className="border-white/15 bg-transparent">
                    Agregar
                  </Button>
                </form>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Vista previa</p>
                <div className="overflow-hidden rounded-xl bg-[#0f0f0f]" data-testid="yt-preview">
                  <div className="relative aspect-video bg-zinc-900">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt="Miniatura" className="h-full w-full object-cover" />
                    ) : project.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.poster} alt="Frame del video" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="absolute inset-0 m-auto h-8 w-8 text-zinc-600" />
                    )}
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1 font-mono text-[11px] text-white">{formatClock(project.duration)}</span>
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{meta.title || "Sin título"}</p>
                    <div className="rounded-lg bg-white/[0.06] p-2.5 text-xs leading-5 text-zinc-200">
                      <p className={cn("whitespace-pre-line", !expanded && "line-clamp-3")}>{meta.description}</p>
                      <button onClick={() => setExpanded((v) => !v)} className="mt-1 font-semibold text-white">
                        {expanded ? "Mostrar menos" : "…más"}
                      </button>
                    </div>
                  </div>
                </div>
                {!thumb && (
                  <Link href={`/thumbnails?p=${project.id}`} className="block text-xs text-[#ff9fb4] hover:underline">
                    Diseñá la miniatura en el Thumbnail Lab →
                  </Link>
                )}
              </Panel>

              <Panel className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Checklist</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ready ? "bg-emerald-400 text-black" : "bg-amber-400/20 text-amber-200")} data-testid="yt-ready">
                    {ready ? "Listo para subir" : "Revisar"}
                  </span>
                </div>
                <ul className="space-y-1.5" data-testid="yt-checks">
                  {checks.map((c) => (
                    <li key={c.id} data-check={c.id} data-ok={c.ok} className={cn("flex items-start gap-2 text-xs", c.ok ? "text-emerald-300" : "text-amber-300")}>
                      {c.ok ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />} {c.label}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => copy("title", meta.title)}>
                    {copied === "title" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />} Título
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => copy("description", meta.description)}>
                    {copied === "description" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />} Descripción
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => copy("tags", meta.tags.join(", "))}>
                    {copied === "tags" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />} Etiquetas
                  </Button>
                  <Button asChild size="sm" className="bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] text-white">
                    <a href={txtUrl} download={`${cleanName(project.name).replace(/\s+/g, "_")}_youtube.txt`}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar .txt
                    </a>
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
