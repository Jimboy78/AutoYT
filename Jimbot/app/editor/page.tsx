"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Copy, Database, Download, Film, Loader2, Music, Play, Plus, Square, Trash2, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { EmptyLibrary, PageHeader, Panel } from "@/components/studio/common";
import { FIT_LABELS, type Fit } from "@/lib/convert/presets";
import { getProjectFile, saveRender, type Project, type Render } from "@/lib/library";
import { useProjects } from "@/lib/library/hooks";
import { beatGrid, estimateTempo, onsetEnvelope, planMontage, type Tempo } from "@/lib/montage/beats";
import { renderMontage, TRANSITIONS, type Transition } from "@/lib/montage/render";
import type { Highlight } from "@/lib/studio/analyze";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { canRecord } from "@/lib/studio/recorder";
import { startTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface TimelineClip {
  id: string;
  projectId: string;
  highlightId?: number;
  start: number;
  end: number;
  speed: number;
  transition: Transition;
}

interface MusicTrack {
  name: string;
  buffer: AudioBuffer;
  tempo: Tempo;
  peaks: Float32Array;
}

type Status = "idle" | "preview" | "record";

const STORE_KEY = "autoyt.montage.v1";
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const COLORS = ["#ff2e63", "#8b5cf6", "#38bdf8", "#f59e0b", "#10b981", "#f472b6"];
const OUTPUTS = {
  landscape: { width: 1280, height: 720, label: "16:9" },
  portrait: { width: 720, height: 1280, label: "9:16" },
} as const;

const uid = () => Math.random().toString(36).slice(2, 9);

async function analyzeMusic(blob: Blob, name: string): Promise<MusicTrack> {
  const ctx = new AudioContext();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error("No se pudo leer ese audio.");
  } finally {
    void ctx.close();
  }
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  const analyzed = mono.subarray(0, Math.min(mono.length, buffer.sampleRate * 90));
  const tempo = estimateTempo(onsetEnvelope(analyzed, buffer.sampleRate));
  const bins = 480;
  const peaks = new Float32Array(bins);
  const per = mono.length / bins;
  let max = 1e-6;
  for (let b = 0; b < bins; b++) {
    let m = 0;
    for (let i = Math.floor(b * per); i < Math.min(mono.length, Math.floor((b + 1) * per)); i += 16) m = Math.max(m, Math.abs(mono[i]));
    peaks[b] = m;
    max = Math.max(max, m);
  }
  return { name, buffer, tempo, peaks: peaks.map((p) => p / max) };
}

export default function EditorPage() {
  const { data: projects = [], loading } = useProjects();
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [music, setMusic] = useState<MusicTrack | null>(null);
  const [musicBusy, setMusicBusy] = useState(false);
  const [snap, setSnap] = useState(true);
  const [pulse, setPulse] = useState(true);
  const [orientation, setOrientation] = useState<keyof typeof OUTPUTS>("landscape");
  const [fit, setFit] = useState<Fit>("blur");
  const [musicVolume, setMusicVolume] = useState(80);
  const [clipVolume, setClipVolume] = useState(60);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(-1);
  const [result, setResult] = useState<{ render: Render; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [recordable, setRecordable] = useState(true);
  const urls = useRef(new Map<string, string>());
  const previewRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) setClips(JSON.parse(raw) as TimelineClip[]);
    } catch {
      // Start with an empty timeline.
    }
    restored.current = true;
    setRecordable(canRecord("mp4") || canRecord("webm"));
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(clips));
    } catch {
      // Timeline persistence is a convenience.
    }
  }, [clips]);

  useEffect(() => {
    if (loading) return;
    setClips((cs) => {
      const kept = cs.filter((c) => projects.some((p) => p.id === c.projectId));
      return kept.length === cs.length ? cs : kept;
    });
  }, [loading, projects]);

  useEffect(() => {
    const map = urls.current;
    return () => {
      abortRef.current?.abort();
      map.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const beat = music && music.tempo.bpm > 0 ? 60 / music.tempo.bpm : null;
  const plan = useMemo(
    () =>
      planMontage(
        clips.map((c) => ({ id: c.id, projectId: c.projectId, start: c.start, end: c.end, speed: c.speed, sourceDuration: byId.get(c.projectId)?.duration ?? c.end })),
        snap ? beat : null,
      ),
    [clips, byId, snap, beat],
  );
  const total = plan.length ? plan[plan.length - 1].timelineEnd : 0;
  const output = OUTPUTS[orientation];
  const selectedClip = clips.find((c) => c.id === selected) ?? null;
  const selectedIndex = clips.findIndex((c) => c.id === selected);
  const busy = status !== "idle";
  const colorFor = (projectId: string) => COLORS[Math.max(0, projects.findIndex((p) => p.id === projectId)) % COLORS.length];

  const newClip = (p: Project, h: Highlight, first: boolean): TimelineClip => ({
    id: uid(),
    projectId: p.id,
    highlightId: h.id,
    start: h.start,
    end: h.end,
    speed: 1,
    transition: first ? "fade" : "flash",
  });
  const addHighlight = (p: Project, h: Highlight) => setClips((cs) => [...cs, newClip(p, h, cs.length === 0)]);
  const addAll = (p: Project) => setClips((cs) => [...cs, ...p.highlights.map((h, i) => newClip(p, h, cs.length + i === 0))]);
  const update = (id: string, change: Partial<TimelineClip>) => setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...change } : c)));
  const move = (from: number, to: number) =>
    setClips((cs) => {
      if (to < 0 || to >= cs.length || from === to) return cs;
      const next = [...cs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const remove = (id: string) => {
    setClips((cs) => cs.filter((c) => c.id !== id));
    if (selected === id) setSelected(null);
  };
  const duplicate = (id: string) =>
    setClips((cs) => {
      const i = cs.findIndex((c) => c.id === id);
      return i < 0 ? cs : [...cs.slice(0, i + 1), { ...cs[i], id: uid() }, ...cs.slice(i + 1)];
    });

  const srcFor = async (projectId: string) => {
    let url = urls.current.get(projectId);
    if (!url) {
      const blob = await getProjectFile(projectId);
      if (!blob) throw new Error("Falta el archivo de un video de la línea de tiempo.");
      url = URL.createObjectURL(blob);
      urls.current.set(projectId, url);
    }
    return url;
  };

  const loadMusic = async (load: () => Promise<MusicTrack>) => {
    setMusicBusy(true);
    setError(null);
    try {
      setMusic(await load());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMusicBusy(false);
    }
  };

  const run = async (mode: "preview" | "record") => {
    if (!plan.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus(mode);
    setProgress(0);
    setError(null);
    if (mode === "record") setResult(null);
    const task = mode === "record" ? startTask({ kind: "montage", title: `Montaje · ${clips.length} clips`, projectId: clips[0]?.projectId, cancel: () => controller.abort() }) : null;
    try {
      const items = await Promise.all(
        plan.map(async (planned, i) => ({ ...planned, src: await srcFor(clips[i].projectId), speed: clips[i].speed, transition: clips[i].transition })),
      );
      const res = await renderMontage({
        items,
        width: output.width,
        height: output.height,
        fit,
        music: music?.buffer ?? null,
        musicOffset: music?.tempo.offset ?? 0,
        musicVolume: musicVolume / 100,
        clipVolume: clipVolume / 100,
        beat,
        beatPulse: pulse && !!beat,
        mode,
        preview: previewRef.current,
        signal: controller.signal,
        onProgress: (fraction, index) => {
          setProgress(Math.round(fraction * 100));
          setPlaying(index);
          task?.update({ progress: fraction, detail: `clip ${index + 1} de ${items.length}` });
        },
      });
      if (task) {
        if (!res.blob) {
          task.cancelled();
        } else {
          const ext = res.mime.includes("mp4") ? "mp4" : "webm";
          const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
          const render = await saveRender(
            {
              projectId: clips[0].projectId,
              kind: "montage",
              name: `montaje_${stamp}.${ext}`,
              mime: res.mime.split(";")[0],
              duration: total,
              width: output.width,
              height: output.height,
              settings: { clips: clips.length, bpm: music ? Number(music.tempo.bpm.toFixed(1)) : null, snap, fit, orientation },
            },
            res.blob,
          );
          setResult({ render, url: URL.createObjectURL(res.blob) });
          task.done(`${formatBytes(res.blob.size)} · ${total.toFixed(1)} s`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      task?.fail(err);
    } finally {
      abortRef.current = null;
      setStatus("idle");
      setPlaying(-1);
    }
  };

  const pxPerSecond = Math.min(80, Math.max(14, 900 / Math.max(1, total)));
  const grid = beat && music ? beatGrid(music.tempo.bpm, 0, total) : [];
  const previewBox = orientation === "landscape" ? { width: 640, height: 360 } : { width: 270, height: 480 };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Montaje"
        title="EDITOR DE RITMO"
        description="Armá un montaje con los mejores momentos de tus videos, sincronizá los cortes con el BPM de tu música y renderizalo en el navegador."
        actions={
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {(Object.keys(OUTPUTS) as (keyof typeof OUTPUTS)[]).map((o) => (
              <button key={o} disabled={busy} onClick={() => setOrientation(o)} className={cn("rounded-md px-3 py-1.5 font-mono text-xs", orientation === o ? "bg-white/10 text-white" : "text-zinc-400")}>
                {OUTPUTS[o].label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      ) : projects.length === 0 ? (
        <EmptyLibrary text="Analizá videos en el Studio: sus momentos aparecen acá para armar un montaje al ritmo de la música." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Panel className="space-y-4 self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
            <h2 className="font-display text-2xl tracking-wide">MATERIAL</h2>
            {projects.map((p) => (
              <div key={p.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(p.id) }} />
                    <span className="truncate">{p.name}</span>
                  </p>
                  <Button size="sm" variant="ghost" disabled={busy || !p.highlights.length} onClick={() => addAll(p)} className="h-7 shrink-0 px-2 text-xs text-zinc-400">
                    Agregar todos
                  </Button>
                </div>
                {p.highlights.map((h) => {
                  const thumb = p.thumbs.find((t) => t.highlightId === h.id)?.dataUrl ?? p.poster;
                  return (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-1.5">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-9 w-16 rounded object-cover" />
                      ) : (
                        <div className="flex h-9 w-16 items-center justify-center rounded bg-zinc-900">
                          <Film className="h-4 w-4 text-zinc-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">#{h.id} · score {h.score}</p>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {formatClock(h.start)} · {(h.end - h.start).toFixed(1)} s
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" disabled={busy} onClick={() => addHighlight(p, h)} aria-label={`Agregar momento ${h.id} de ${p.name}`} className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))}
          </Panel>

          <div className="min-w-0 space-y-6">
            <Panel className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex rounded-lg border border-white/10 p-0.5">
                  {(Object.keys(FIT_LABELS) as Fit[]).map((f) => (
                    <button key={f} disabled={busy} onClick={() => setFit(f)} className={cn("rounded-md px-3 py-1.5 text-xs", fit === f ? "bg-white/10 text-white" : "text-zinc-400")}>
                      {FIT_LABELS[f]}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-xs text-zinc-400" data-testid="montage-total">
                  {clips.length} clips · {total.toFixed(1)} s · {output.width}×{output.height}
                </span>
              </div>
              <div className="flex justify-center rounded-xl bg-black p-3">
                <canvas
                  ref={previewRef}
                  width={previewBox.width}
                  height={previewBox.height}
                  className="max-w-full rounded-lg bg-zinc-950 ring-1 ring-white/10"
                  style={{ width: previewBox.width, aspectRatio: `${previewBox.width} / ${previewBox.height}` }}
                  data-testid="montage-canvas"
                />
              </div>
              {busy && (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-[#ff2e63] transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {busy ? (
                  <>
                    <Button variant="outline" onClick={() => abortRef.current?.abort()} className="border-white/15 bg-transparent">
                      <Square className="mr-2 h-4 w-4" /> Detener
                    </Button>
                    <span className="flex items-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                      {status === "record" ? `Renderizando ${progress}% — dejá la pestaña visible` : `Preview ${progress}%`}
                    </span>
                  </>
                ) : (
                  <>
                    <Button variant="outline" disabled={!clips.length} onClick={() => run("preview")} className="border-white/15 bg-transparent">
                      <Play className="mr-2 h-4 w-4" /> Preview
                    </Button>
                    <Button disabled={!clips.length || !recordable} onClick={() => run("record")} className="bg-gradient-to-r from-amber-400 to-[#ff2e63] text-black hover:opacity-90">
                      <Wand2 className="mr-2 h-4 w-4" /> Renderizar montaje
                    </Button>
                  </>
                )}
              </div>
              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
              {result && (
                <div className="animate-fade-in flex flex-wrap items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3" data-testid="montage-result">
                  <video src={result.url} controls playsInline className="h-28 rounded-lg bg-black" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-emerald-300">{result.render.name}</p>
                    <p className="text-xs text-zinc-400">
                      {result.render.width}×{result.render.height} · {formatBytes(result.render.size)} · {result.render.duration?.toFixed(1)} s
                    </p>
                    <Link href="/clips" className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline">
                      <Database className="h-3 w-3" /> Guardado en la Galería
                    </Link>
                  </div>
                  <Button asChild size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400">
                    <a href={result.url} download={result.render.name}>
                      <Download className="mr-1.5 h-4 w-4" /> Descargar
                    </a>
                  </Button>
                </div>
              )}
            </Panel>

            <Panel className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
                  <Music className="h-5 w-5 text-amber-300" /> MÚSICA
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm hover:border-amber-300/60", (busy || musicBusy) && "pointer-events-none opacity-50")}>
                    <Upload className="h-4 w-4" /> Subir audio
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      className="hidden"
                      data-testid="music-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void loadMusic(() => analyzeMusic(file, file.name));
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <select
                    value=""
                    disabled={busy || musicBusy}
                    onChange={(e) => {
                      const p = byId.get(e.target.value);
                      if (p)
                        void loadMusic(async () => {
                          const blob = await getProjectFile(p.id);
                          if (!blob) throw new Error("Falta el archivo de ese video.");
                          return analyzeMusic(blob, p.name);
                        });
                    }}
                    className="h-9 max-w-[220px] rounded-md border border-white/10 bg-zinc-950 px-2 text-sm"
                    aria-label="Usar el audio de un video"
                  >
                    <option value="">Usar audio de un video…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {music && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMusic(null)} className="text-zinc-400">
                      Quitar
                    </Button>
                  )}
                </div>
              </div>

              {musicBusy ? (
                <p className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Decodificando y detectando el tempo…
                </p>
              ) : music ? (
                <>
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-zinc-500">Tempo</p>
                      <p className="font-display text-5xl leading-none tracking-wide text-amber-300" data-testid="bpm">
                        {music.tempo.bpm > 0 ? `${music.tempo.bpm.toFixed(1)} BPM` : "—"}
                      </p>
                    </div>
                    <div className="text-sm text-zinc-400">
                      <p className="truncate">{music.name}</p>
                      <p className="font-mono text-xs">
                        confianza {Math.round(music.tempo.confidence * 100)}% · primer beat {music.tempo.offset.toFixed(2)} s · {formatClock(music.buffer.duration)}
                      </p>
                    </div>
                  </div>
                  <MusicWave track={music} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm">
                      <span>
                        <span className="block font-medium">Cortes al ritmo</span>
                        <span className="text-xs text-zinc-500">Cada clip dura beats enteros</span>
                      </span>
                      <Switch checked={snap} onCheckedChange={setSnap} disabled={busy} aria-label="Cortes al ritmo" />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm">
                      <span>
                        <span className="block font-medium">Pulso en cada beat</span>
                        <span className="text-xs text-zinc-500">Micro zoom al golpe</span>
                      </span>
                      <Switch checked={pulse} onCheckedChange={setPulse} disabled={busy} aria-label="Pulso en cada beat" />
                    </label>
                    <VolumeRow label="Música" value={musicVolume} onChange={setMusicVolume} disabled={busy} />
                    <VolumeRow label="Audio de los clips" value={clipVolume} onChange={setClipVolume} disabled={busy} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-500">Sin música: el montaje usa el audio original de cada clip. Subí un tema para sincronizar los cortes con su BPM.</p>
              )}
            </Panel>

            <Panel className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl tracking-wide">LÍNEA DE TIEMPO</h2>
                {clips.length > 0 && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => (setClips([]), setSelected(null))} className="text-zinc-400">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Vaciar
                  </Button>
                )}
              </div>
              {clips.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Agregá momentos desde el panel de material.</p>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="relative" style={{ width: Math.max(total * pxPerSecond, 200) }}>
                    {grid.length > 0 && (
                      <div className="pointer-events-none absolute inset-x-0 -top-1 h-3">
                        {grid.map((t, i) => (
                          <span key={i} className={cn("absolute top-0 w-px", i % 4 === 0 ? "h-3 bg-amber-300/80" : "h-1.5 bg-amber-300/30")} style={{ left: t * pxPerSecond }} />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex">
                      {plan.map((planned, i) => {
                        const clip = clips[i];
                        const p = byId.get(clip.projectId);
                        const on = clip.id === selected;
                        return (
                          <button
                            key={clip.id}
                            draggable={!busy}
                            onDragStart={() => setDragIndex(i)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragIndex !== null) move(dragIndex, i);
                              setDragIndex(null);
                            }}
                            onClick={() => setSelected(on ? null : clip.id)}
                            data-testid="timeline-block"
                            className={cn(
                              "relative h-20 shrink-0 overflow-hidden rounded-lg border-2 px-2 py-1.5 text-left text-white transition-all",
                              on ? "border-white" : "border-black/40",
                              playing === i && "ring-2 ring-amber-300",
                            )}
                            style={{ width: (planned.timelineEnd - planned.timelineStart) * pxPerSecond, background: `linear-gradient(160deg, ${colorFor(clip.projectId)}, #111)` }}
                            title={p?.name}
                          >
                            <span className="block truncate text-xs font-semibold">#{clip.highlightId ?? "?"}</span>
                            <span className="block font-mono text-[10px] opacity-80">{(planned.timelineEnd - planned.timelineStart).toFixed(2)} s</span>
                            {planned.beats !== null && <span className="block font-mono text-[10px] text-amber-200">{planned.beats} beats</span>}
                            <span className="absolute bottom-1 right-1.5 text-[10px] opacity-70">{TRANSITIONS.find((t) => t.id === clip.transition)?.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedClip && byId.get(selectedClip.projectId) && (
                <Inspector
                  clip={selectedClip}
                  index={selectedIndex}
                  count={clips.length}
                  project={byId.get(selectedClip.projectId)!}
                  disabled={busy}
                  onChange={(change) => update(selectedClip.id, change)}
                  onMove={(delta) => move(selectedIndex, selectedIndex + delta)}
                  onDuplicate={() => duplicate(selectedClip.id)}
                  onRemove={() => remove(selectedClip.id)}
                />
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Inspector({
  clip,
  index,
  count,
  project,
  disabled,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  clip: TimelineClip;
  index: number;
  count: number;
  project: Project;
  disabled: boolean;
  onChange: (change: Partial<TimelineClip>) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="animate-fade-in grid gap-4 rounded-xl border border-white/10 bg-black/30 p-4 md:grid-cols-2" data-testid="inspector">
      <div className="space-y-3">
        <p className="truncate text-sm font-medium">
          Clip {index + 1} · {project.name}
        </p>
        <TrimRow label="Entrada" value={clip.start} max={project.duration} disabled={disabled} onChange={(v) => onChange({ start: Math.min(v, clip.end - 0.3) })} />
        <TrimRow label="Salida" value={clip.end} max={project.duration} disabled={disabled} onChange={(v) => onChange({ end: Math.max(v, clip.start + 0.3) })} />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-xs text-zinc-500">Velocidad</span>
          {SPEEDS.map((s) => (
            <button key={s} disabled={disabled} onClick={() => onChange({ speed: s })} className={cn("rounded-md border px-2 py-1 font-mono text-xs", clip.speed === s ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 text-zinc-400")}>
              {s}×
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-xs text-zinc-500">Entrada con</span>
          {TRANSITIONS.map((t) => (
            <button key={t.id} disabled={disabled} onClick={() => onChange({ transition: t.id })} className={cn("rounded-md border px-2 py-1 text-xs", clip.transition === t.id ? "border-[#ff2e63] bg-[#ff2e63]/15 text-white" : "border-white/10 text-zinc-400")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={disabled || index === 0} onClick={() => onMove(-1)} className="border-white/15 bg-transparent" aria-label="Mover a la izquierda">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={disabled || index === count - 1} onClick={() => onMove(1)} className="border-white/15 bg-transparent" aria-label="Mover a la derecha">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={onDuplicate} className="border-white/15 bg-transparent">
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicar
          </Button>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onRemove} className="text-red-300">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Quitar
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrimRow({ label, value, max, disabled, onChange }: { label: string; value: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-xs text-zinc-500">{label}</span>
      <Slider value={[value]} min={0} max={Math.max(0.5, max)} step={0.05} disabled={disabled} onValueChange={([v]) => onChange(v)} />
      <span className="w-14 text-right font-mono text-xs text-zinc-300">{value.toFixed(2)}</span>
    </div>
  );
}

function VolumeRow({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
      <span className="w-32 text-sm">{label}</span>
      <Slider value={[value]} min={0} max={100} step={1} disabled={disabled} onValueChange={([v]) => onChange(v)} />
      <span className="w-10 text-right font-mono text-xs text-zinc-400">{value}%</span>
    </div>
  );
}

function MusicWave({ track }: { track: MusicTrack }) {
  const W = 960;
  const H = 64;
  const beats = track.tempo.bpm > 0 ? beatGrid(track.tempo.bpm, track.tempo.offset, track.buffer.duration) : [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full rounded-lg bg-black/40">
      {Array.from(track.peaks).map((p, i) => {
        const x = (i / track.peaks.length) * W;
        const h = Math.max(1, p * (H - 6));
        return <rect key={i} x={x} y={(H - h) / 2} width={W / track.peaks.length - 0.5} height={h} fill="rgba(251,191,36,0.55)" />;
      })}
      {beats.map((t, i) => (
        <line key={i} x1={(t / track.buffer.duration) * W} x2={(t / track.buffer.duration) * W} y1={0} y2={H} stroke={i % 4 === 0 ? "rgba(255,46,99,0.9)" : "rgba(255,255,255,0.15)"} strokeWidth={i % 4 === 0 ? 1.5 : 1} />
      ))}
    </svg>
  );
}
