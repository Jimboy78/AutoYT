"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Check, Copy, Database, Download, Loader2, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EmptyLibrary, PageHeader, Panel, ProjectPicker } from "@/components/studio/common";
import { drawFramed } from "@/lib/convert/draw";
import { estimateBytes, ffmpegCommand, FIT_LABELS, FORMATS, outputSize, type Fit } from "@/lib/convert/presets";
import { encodeWav, sliceChannels } from "@/lib/convert/wav";
import { getProjectFile, saveRender, type Render } from "@/lib/library";
import { useActiveProject, useProjectFileUrl } from "@/lib/library/hooks";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { canRecord, recordSegment, seekVideo } from "@/lib/studio/recorder";
import { startTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Status = "idle" | "video" | "audio";

interface Output {
  render: Render;
  url: string;
}

export default function ConversionPage() {
  const { projects, project, select, loading } = useActiveProject();
  const fileUrl = useProjectFileUrl(project?.id);
  const sourceRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [formatId, setFormatId] = useState(FORMATS[2].id);
  const [fit, setFit] = useState<Fit>("blur");
  const [focus, setFocus] = useState(0.5);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [container, setContainer] = useState<"mp4" | "webm">("mp4");
  const [mbps, setMbps] = useState(6);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState<Output | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [support, setSupport] = useState({ mp4: true, webm: true });

  const format = FORMATS.find((f) => f.id === formatId) ?? FORMATS[0];
  const duration = project?.duration ?? 0;
  const [start, end] = range;
  const size = project ? outputSize(format, project.width || 1280, project.height || 720) : { width: format.width, height: format.height };

  useEffect(() => {
    const s = { mp4: canRecord("mp4"), webm: canRecord("webm") };
    setSupport(s);
    if (!s.mp4 && s.webm) setContainer("webm");
  }, []);

  // New project: full range, or the ?start=&end= handed over from the clip gallery. Keyed by id: the
  // project object is re-read on every library change (e.g. saving this very render).
  const projectKey = project?.id;
  const projectDuration = project?.duration ?? 0;
  useEffect(() => {
    if (!projectKey) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("p") === projectKey;
    const a = fromUrl ? Number(params.get("start")) : NaN;
    const b = fromUrl ? Number(params.get("end")) : NaN;
    setRange(Number.isFinite(a) && Number.isFinite(b) && b > a ? [Math.max(0, a), Math.min(projectDuration, b)] : [0, projectDuration]);
    setOutput(null);
  }, [projectKey, projectDuration]);

  useEffect(() => () => void (output && URL.revokeObjectURL(output.url)), [output]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Live framing preview of the first frame of the range.
  useEffect(() => {
    const video = sourceRef.current;
    const canvas = previewRef.current;
    if (!video || !canvas || !fileUrl || status !== "idle" || !project?.hasVideo) return;
    let cancelled = false;
    const draw = async () => {
      if (video.readyState < 2) await new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
      await seekVideo(video, Math.min(start + 0.05, Math.max(0, duration - 0.05)));
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (ctx) drawFramed(ctx, video, canvas.width, canvas.height, fit, focus);
    };
    const timer = setTimeout(() => void draw(), 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fileUrl, start, fit, focus, formatId, status, duration, project?.hasVideo]);

  const previewSize = useMemo(() => {
    const max = 360;
    const k = max / Math.max(format.width, format.height);
    return { width: Math.round(format.width * k), height: Math.round(format.height * k) };
  }, [format]);

  const base = project?.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_") ?? "video";

  const finish = (render: Render, blob: Blob) => setOutput({ render, url: URL.createObjectURL(blob) });

  const convertVideo = async () => {
    if (!project || !fileUrl) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("video");
    setProgress(0);
    setError(null);
    setOutput(null);
    const task = startTask({ kind: "conversion", title: `${format.label} · ${project.name}`, projectId: project.id, cancel: () => controller.abort() });
    task.update({ stage: `${size.width}×${size.height} · ${FIT_LABELS[fit]}` });
    try {
      const result = await recordSegment({
        src: fileUrl,
        start,
        end,
        width: size.width,
        height: size.height,
        fps: 30,
        videoBitsPerSecond: mbps * 1_000_000,
        prefer: container,
        preview: previewRef.current,
        draw: (ctx, video) => drawFramed(ctx, video, size.width, size.height, fit, focus),
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(Math.round(p * 100));
          task.update({ progress: p });
        },
      });
      if (!result.blob) {
        task.cancelled();
        return;
      }
      const ext = result.mime.includes("mp4") ? "mp4" : "webm";
      const render = await saveRender(
        {
          projectId: project.id,
          kind: "conversion",
          name: `${base}_${format.id}_${fit}.${ext}`,
          mime: result.mime.split(";")[0],
          duration: end - start,
          width: size.width,
          height: size.height,
          settings: { format: format.id, fit, focus, start, end, mbps },
        },
        result.blob,
      );
      finish(render, result.blob);
      task.done(`${formatBytes(result.blob.size)} en ${(result.elapsed / 1000).toFixed(1)} s`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      task.fail(err);
    } finally {
      abortRef.current = null;
      setStatus("idle");
    }
  };

  const exportAudio = async () => {
    if (!project) return;
    setStatus("audio");
    setError(null);
    setOutput(null);
    const task = startTask({ kind: "conversion", title: `Audio WAV · ${project.name}`, projectId: project.id });
    try {
      const file = await getProjectFile(project.id);
      if (!file) throw new Error("El archivo original no está en la biblioteca.");
      const ctx = new AudioContext();
      let buffer: AudioBuffer;
      try {
        buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      } finally {
        void ctx.close();
      }
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
      const wav = new Blob([encodeWav(sliceChannels(channels, buffer.sampleRate, start, end), buffer.sampleRate)], { type: "audio/wav" });
      const render = await saveRender(
        { projectId: project.id, kind: "audio", name: `${base}_${Math.round(start)}-${Math.round(end)}.wav`, mime: "audio/wav", duration: end - start, settings: { start, end, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels } },
        wav,
      );
      finish(render, wav);
      task.done(formatBytes(wav.size));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      task.fail(err);
    } finally {
      setStatus("idle");
    }
  };

  const command = project ? ffmpegCommand(project.name, `${base}_${format.id}.mp4`, { ...format, ...size }, fit, start, end, focus) : "";
  const busy = status !== "idle";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Exportación"
        title="CONVERSIÓN"
        description="Reencuadrá y recodificá para cada plataforma directamente en el navegador (Canvas + MediaRecorder), o exportá el audio en WAV sin pérdida."
      />

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/5" />
      ) : !project ? (
        <EmptyLibrary text="Analizá un video en el Studio y convertilo acá a 9:16, 1:1, 4:5 o 16:9, o extraé su audio." />
      ) : (
        <>
          <ProjectPicker projects={projects} value={project.id} onChange={select} disabled={busy} />
          {fileUrl && <video ref={sourceRef} src={fileUrl} muted playsInline preload="auto" className="hidden" />}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <Panel className="min-w-0 space-y-5">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Formato de salida</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5" role="radiogroup">
                  {FORMATS.map((f) => {
                    const on = f.id === formatId;
                    const k = 34 / Math.max(f.width, f.height);
                    return (
                      <button
                        key={f.id}
                        role="radio"
                        aria-checked={on}
                        disabled={busy}
                        onClick={() => setFormatId(f.id)}
                        className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors", on ? "border-violet-400/70 bg-violet-400/10" : "border-white/10 hover:border-white/25")}
                      >
                        <span className="flex h-10 items-center">
                          <span className={cn("rounded-[4px] border-2", on ? "border-violet-300" : "border-zinc-500")} style={{ width: f.width * k, height: f.height * k }} />
                        </span>
                        <span className="text-xs font-medium leading-tight">{f.label}</span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {f.platform} · {f.width}×{f.height}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex rounded-lg border border-white/10 p-0.5">
                  {(Object.keys(FIT_LABELS) as Fit[]).map((f) => (
                    <button key={f} disabled={busy} onClick={() => setFit(f)} className={cn("rounded-md px-3 py-1.5 text-sm", fit === f ? "bg-white/10 text-white" : "text-zinc-400")}>
                      {FIT_LABELS[f]}
                    </button>
                  ))}
                </div>
                {fit === "crop" && (
                  <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    <span className="text-sm text-zinc-400">Encuadre</span>
                    <Slider value={[focus * 100]} min={0} max={100} step={1} disabled={busy} onValueChange={([v]) => setFocus(v / 100)} />
                    <span className="w-10 font-mono text-xs text-violet-300">{Math.round(focus * 100)}%</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Rango</span>
                  <span className="font-mono text-xs text-violet-300" data-testid="range-label">
                    {formatClock(start)} → {formatClock(end)} · {(end - start).toFixed(1)} s
                  </span>
                </div>
                <RangeRow label="Inicio" value={start} max={duration} disabled={busy} onChange={(v) => setRange([Math.min(v, end - 0.5), end])} />
                <RangeRow label="Fin" value={end} max={duration} disabled={busy} onChange={(v) => setRange([start, Math.max(v, start + 0.5)])} />
                {project.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button disabled={busy} onClick={() => setRange([0, duration])} className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-violet-400/60">
                      Video completo
                    </button>
                    {project.highlights.map((h) => (
                      <button
                        key={h.id}
                        disabled={busy}
                        onClick={() => setRange([h.start, h.end])}
                        className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-[#ff2e63]/60"
                      >
                        Momento #{h.id} · {formatClock(h.start)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {project.hasVideo && (
                <div className="flex justify-center rounded-xl bg-[repeating-conic-gradient(#18181b_0_25%,#0f0f12_0_50%)] bg-[length:24px_24px] p-4">
                  <canvas
                    ref={previewRef}
                    width={previewSize.width}
                    height={previewSize.height}
                    data-testid="conversion-preview"
                    className="rounded-lg shadow-2xl ring-1 ring-white/10"
                    style={{ width: previewSize.width, height: previewSize.height, maxWidth: "100%" }}
                  />
                </div>
              )}
            </Panel>

            <Panel className="space-y-5 self-start">
              <h2 className="font-display text-2xl tracking-wide">SALIDA</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Resolución" value={`${size.width}×${size.height}`} />
                <Info label="Duración" value={`${(end - start).toFixed(1)} s`} />
                <Info label="Tamaño estimado" value={`≈ ${formatBytes(estimateBytes(mbps * 1_000_000, end - start))}`} />
                <Info label="Velocidad" value="Tiempo real" />
              </dl>
              {(size.width < format.width || size.height < format.height) && (
                <p className="text-xs text-amber-300">La fuente es chica: se limita a 2× su resolución para no inventar píxeles.</p>
              )}
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-white/10 p-0.5">
                  {(["mp4", "webm"] as const).map((c) => (
                    <button
                      key={c}
                      disabled={busy || !support[c]}
                      onClick={() => setContainer(c)}
                      className={cn("rounded-md px-3 py-1.5 font-mono text-xs uppercase disabled:opacity-40", container === c ? "bg-white/10 text-white" : "text-zinc-400")}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <Slider value={[mbps]} min={1} max={16} step={1} disabled={busy} onValueChange={([v]) => setMbps(v)} />
                  <span className="w-16 text-right font-mono text-xs text-violet-300">{mbps} Mbps</span>
                </div>
              </div>

              {busy ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
                    {status === "video" ? `Convirtiendo en tiempo real · ${progress}%` : "Decodificando y escribiendo WAV…"}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-[#ff2e63] transition-[width]" style={{ width: `${status === "video" ? progress : 60}%` }} />
                  </div>
                  {status === "video" && (
                    <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()} className="border-white/15 bg-transparent">
                      <Square className="mr-1.5 h-3.5 w-3.5" /> Detener
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={convertVideo} disabled={!project.hasVideo || !support[container]} className="bg-gradient-to-r from-violet-500 to-[#ff2e63] text-white hover:opacity-90">
                    <Wand2 className="mr-2 h-4 w-4" /> Convertir video
                  </Button>
                  <Button variant="outline" onClick={exportAudio} className="border-white/15 bg-transparent">
                    <AudioLines className="mr-2 h-4 w-4" /> Audio WAV
                  </Button>
                </div>
              )}

              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

              {output && (
                <div className="animate-fade-in space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3" data-testid="conversion-result">
                  {output.render.kind === "audio" ? (
                    <audio src={output.url} controls className="w-full" />
                  ) : (
                    <video src={output.url} controls playsInline className="max-h-72 w-full rounded-lg bg-black object-contain" />
                  )}
                  <p className="truncate font-mono text-xs text-emerald-300">{output.render.name}</p>
                  <p className="text-xs text-zinc-400">
                    {output.render.mime} · {formatBytes(output.render.size)}
                  </p>
                  <div className="flex items-center gap-3">
                    <Button asChild size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400">
                      <a href={output.url} download={output.render.name}>
                        <Download className="mr-1.5 h-4 w-4" /> Descargar
                      </a>
                    </Button>
                    <Link href="/clips" className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline">
                      <Database className="h-3.5 w-3.5" /> En la Galería
                    </Link>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Equivalente en ffmpeg</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-zinc-300"
                    onClick={async () => {
                      await navigator.clipboard.writeText(command);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" /> : <Copy className="mr-1 h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-emerald-300">{command}</pre>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function RangeRow({ label, value, max, disabled, onChange }: { label: string; value: number; max: number; disabled: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-xs text-zinc-500">{label}</span>
      <Slider value={[value]} min={0} max={Math.max(0.5, max)} step={0.1} disabled={disabled} onValueChange={([v]) => onChange(v)} />
      <span className="w-12 text-right font-mono text-xs text-zinc-400">{formatClock(value)}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
