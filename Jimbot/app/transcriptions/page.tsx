"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Captions, Check, Copy, Cpu, Download, Languages, Loader2, Mic, Search, Sparkles, Square, Timer, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyLibrary, PageHeader, Panel, ProjectPicker, StatCard } from "@/components/studio/common";
import { updateProject } from "@/lib/library";
import { useActiveProject, useProjectFileUrl } from "@/lib/library/hooks";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { fold, segmentAt, spreadWords, toSRT, toTXT, toVTT, transcriptStats } from "@/lib/transcribe/format";
import { cancelTranscription, isTranscribing, LANGUAGES, startTranscription, useTranscribeState, WHISPER_MODELS } from "@/lib/transcribe/manager";
import { cn } from "@/lib/utils";

const RUNNING = ["decoding", "loading", "transcribing"];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TranscriptionsPage() {
  const { projects, project, select, loading } = useActiveProject();
  const run = useTranscribeState();
  const fileUrl = useProjectFileUrl(project?.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<string>(WHISPER_MODELS[0].id);
  const [language, setLanguage] = useState("es");
  const [mode, setMode] = useState<"transcribe" | "translate">("transcribe");
  const [time, setTime] = useState(0);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [follow, setFollow] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = !!run && run.projectId === project?.id && RUNNING.includes(run.stage);
  const transcript = project?.transcript;
  const segments = running ? run.segments : (transcript?.segments ?? []);
  const active = segmentAt(segments, time);
  const stats = useMemo(() => (transcript && project ? transcriptStats(transcript, project.duration) : null), [transcript, project]);
  const matches = useMemo(() => {
    const q = fold(query.trim());
    return q ? new Set(segments.flatMap((s, i) => (fold(s.text).includes(q) ? [i] : []))) : null;
  }, [segments, query]);

  useEffect(() => {
    if (!follow || active < 0 || editing !== null) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active, follow, editing]);

  useEffect(() => {
    if (run?.stage === "error" && run.projectId === project?.id) setError(run.error ?? "La transcripción falló.");
  }, [run?.stage, run?.error, run?.projectId, project?.id]);

  const start = async () => {
    if (!project) return;
    setError(null);
    try {
      await startTranscription(project.id, { model, language, task: mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t + 0.01;
    void v.play();
  };

  const saveEdit = (index: number) => {
    const text = draft.replace(/\s+/g, " ").trim();
    setEditing(null);
    if (!project || !text) return;
    void updateProject(project.id, (p) =>
      p.transcript
        ? {
            transcript: {
              ...p.transcript,
              segments: p.transcript.segments.map((s, i) => (i === index ? { ...s, text, words: spreadWords(text, s.start, s.end) } : s)),
            },
          }
        : {},
    );
  };

  const base = project?.name.replace(/\.[^.]+$/, "") ?? "transcripcion";
  const caption = active >= 0 ? segments[active]?.text : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Whisper en tu navegador"
        title="TRANSCRIPCIONES"
        description="Reconocimiento de voz con Whisper corriendo en WebAssembly: el audio no sale de tu computadora. El modelo se descarga una sola vez y queda en caché."
      />

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      ) : !project ? (
        <EmptyLibrary text="Analizá un video en el Studio y transcribilo acá: subtítulos SRT/VTT, búsqueda por palabra y subtítulos animados para tus Shorts." />
      ) : (
        <>
          <ProjectPicker projects={projects} value={project.id} onChange={(id) => (setEditing(null), select(id))} disabled={running} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                {fileUrl && (
                  <video
                    ref={videoRef}
                    src={fileUrl}
                    controls
                    playsInline
                    className="aspect-video w-full object-contain"
                    onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                    onSeeked={(e) => setTime(e.currentTarget.currentTime)}
                  />
                )}
                {caption && (
                  <div className="pointer-events-none absolute inset-x-6 bottom-14 text-center">
                    <span className="rounded-lg bg-black/75 px-3 py-1 text-base font-medium leading-relaxed text-white [box-decoration-break:clone]">{caption}</span>
                  </div>
                )}
              </div>

              <Panel className="space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                    <Cpu className="h-3.5 w-3.5" /> Modelo
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {WHISPER_MODELS.map((m) => (
                      <button
                        key={m.id}
                        disabled={running}
                        onClick={() => setModel(m.id)}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition-colors disabled:opacity-60",
                          model === m.id ? "border-sky-400/70 bg-sky-400/10" : "border-white/10 hover:border-white/25",
                        )}
                      >
                        <span className="block font-display text-lg tracking-wide">{m.label.toUpperCase()}</span>
                        <span className="block text-[11px] text-zinc-400">{m.size}</span>
                        <span className="block text-[11px] text-zinc-500">{m.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="space-y-1.5">
                    <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                      <Languages className="h-3.5 w-3.5" /> Idioma del audio
                    </span>
                    <select
                      value={language}
                      disabled={running}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-9 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex rounded-lg border border-white/10 p-0.5">
                    {(["transcribe", "translate"] as const).map((m) => (
                      <button
                        key={m}
                        disabled={running}
                        onClick={() => setMode(m)}
                        className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", mode === m ? "bg-white/10 text-white" : "text-zinc-400")}
                      >
                        {m === "transcribe" ? "Transcribir" : "Traducir al inglés"}
                      </button>
                    ))}
                  </div>
                </div>

                {running ? (
                  <RunProgress />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      data-testid="transcribe-start"
                      onClick={start}
                      disabled={isTranscribing()}
                      className="bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-[0_8px_30px_-12px_#38bdf8] hover:opacity-90"
                    >
                      <Wand2 className="mr-2 h-4 w-4" /> {transcript ? "Volver a transcribir" : "Transcribir"}
                    </Button>
                    {isTranscribing() && run && run.projectId !== project.id && (
                      <span className="text-xs text-amber-300">Hay otra transcripción en curso.</span>
                    )}
                  </div>
                )}
                {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
              </Panel>
            </div>

            <Panel className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl tracking-wide">TRANSCRIPCIÓN</h2>
                {transcript && !running && (
                  <span className="text-xs text-zinc-500">
                    {WHISPER_MODELS.find((m) => m.id === transcript.model)?.label ?? transcript.model} ·{" "}
                    {transcript.task === "translate" ? "traducido al inglés" : (LANGUAGES.find((l) => l.code === transcript.language)?.label ?? transcript.language)} ·{" "}
                    {Math.round(transcript.elapsedMs / 1000)} s
                  </span>
                )}
              </div>

              {stats && !running && (
                <>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <StatCard icon={Mic} label="Palabras" value={String(stats.words)} />
                    <StatCard icon={Timer} label="Palabras/min" value={String(stats.wpm)} accent />
                    <StatCard icon={Captions} label="Habla" value={`${Math.round(stats.coverage * 100)}%`} />
                    <StatCard icon={Sparkles} label="Segmentos" value={String(segments.length)} />
                  </div>
                  {stats.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {stats.keywords.map((k) => (
                        <button
                          key={k.word}
                          onClick={() => setQuery(k.word)}
                          className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-sky-400/60"
                        >
                          {k.word} <span className="text-zinc-500">×{k.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {segments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en lo que se dice…" className="border-white/10 bg-white/5 pl-9" />
                  </div>
                  {matches && <span className="text-xs text-zinc-400">{matches.size} coincidencias</span>}
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Seguir video
                  </label>
                </div>
              )}

              <div ref={listRef} className="max-h-[620px] space-y-1 overflow-auto pr-1" data-testid="segments">
                {segments.length === 0 && !running && (
                  <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                    Todavía no hay transcripción para este video.
                  </div>
                )}
                {running && segments.length === 0 && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-white/5" />)}
                {segments.map((s, i) => {
                  if (matches && !matches.has(i)) return null;
                  return (
                    <div
                      key={`${s.start}-${i}`}
                      data-index={i}
                      className={cn(
                        "animate-fade-in group flex gap-3 rounded-lg border-l-2 px-3 py-2 transition-colors",
                        i === active ? "border-sky-400 bg-sky-400/10" : "border-transparent hover:bg-white/5",
                      )}
                    >
                      <button onClick={() => seek(s.start)} className="w-12 shrink-0 pt-0.5 text-left font-mono text-xs text-sky-300 hover:underline">
                        {formatClock(s.start)}
                      </button>
                      {editing === i ? (
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => saveEdit(i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(i);
                            } else if (e.key === "Escape") setEditing(null);
                          }}
                          rows={2}
                          className="min-w-0 flex-1 resize-none rounded-md border border-sky-400/40 bg-black/40 p-1.5 text-sm"
                        />
                      ) : (
                        <p
                          className={cn("min-w-0 flex-1 text-sm leading-relaxed", !running && "cursor-text")}
                          onDoubleClick={() => {
                            if (running || !transcript) return;
                            setDraft(s.text);
                            setEditing(i);
                          }}
                          title={running ? undefined : "Doble clic para editar"}
                        >
                          <Highlighted text={s.text} query={query} />
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {transcript && !running && segments.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => download(`${base}.srt`, toSRT(segments), "application/x-subrip")}>
                    <Download className="mr-1.5 h-4 w-4" /> SRT
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => download(`${base}.vtt`, toVTT(segments), "text/vtt")}>
                    <Download className="mr-1.5 h-4 w-4" /> VTT
                  </Button>
                  <Button size="sm" variant="outline" className="border-white/15 bg-transparent" onClick={() => download(`${base}.txt`, toTXT(segments), "text/plain")}>
                    <Download className="mr-1.5 h-4 w-4" /> TXT
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-transparent"
                    onClick={async () => {
                      await navigator.clipboard.writeText(toTXT(segments));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="mr-1.5 h-4 w-4 text-emerald-400" /> : <Copy className="mr-1.5 h-4 w-4" />} {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Link href={`/studio?p=${encodeURIComponent(project.id)}`} className="ml-auto inline-flex items-center gap-1.5 text-sm text-[#ff9f1c] hover:underline">
                    <Captions className="h-4 w-4" /> Subtítulos animados en Shorts
                  </Link>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function RunProgress() {
  const run = useTranscribeState();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  if (!run) return null;
  const { stage, download: dl, windowIndex, windowTotal } = run;
  const steps = [
    { key: "decoding", label: "Decodificando audio a 16 kHz" },
    {
      key: "loading",
      label: dl.total > 0 ? `Descargando modelo · ${formatBytes(dl.loaded)} / ${formatBytes(dl.total)}` : "Cargando modelo (caché del navegador)",
    },
    { key: "transcribing", label: `Transcribiendo · ventana ${Math.min(windowIndex + 1, Math.max(1, windowTotal))} de ${windowTotal || "…"}` },
  ];
  const order = steps.findIndex((s) => s.key === stage);
  const fraction = stage === "transcribing" ? windowIndex / Math.max(1, windowTotal) : stage === "loading" && dl.total ? (dl.loaded / dl.total) * 0.99 : 0;

  return (
    <div className="space-y-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] p-3" data-testid="transcribe-progress">
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.key} className={cn("flex items-center gap-2 text-sm", i > order && "opacity-40")}>
            {i < order ? <Check className="h-4 w-4 text-emerald-400" /> : i === order ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : <span className="h-4 w-4" />}
            {s.label}
          </li>
        ))}
      </ol>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500 transition-[width] duration-300" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-mono">{Math.round((now - run.startedAt) / 1000)} s</span>
        <Button size="sm" variant="ghost" onClick={cancelTranscription} className="h-7 text-zinc-300">
          <Square className="mr-1.5 h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  if (!q) return <>{text}</>;
  const folded = fold(text);
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = folded.indexOf(q);
  while (at >= 0) {
    parts.push(text.slice(from, at), <mark key={at} className="rounded bg-sky-400/30 px-0.5 text-white">{text.slice(at, at + q.length)}</mark>);
    from = at + q.length;
    at = folded.indexOf(q, from);
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}
