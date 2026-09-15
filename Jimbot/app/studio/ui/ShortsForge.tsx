"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Captions, Crosshair, Database, Download, Loader2, Play, Square, Wand2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { saveRender } from "@/lib/library";
import { useProject } from "@/lib/library/hooks";
import type { ShortsDefaults } from "@/lib/presets";
import type { Highlight } from "@/lib/studio/analyze";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { recordingMime, renderShort, SHORT_STYLES, type TrackSample } from "@/lib/studio/shorts";
import { startTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const HOOKS = ["Esperá al final 😳", "No puedo creer esto", "El mejor momento 🔥", "Esto se descontroló"];
const MAX_CLIP = 60;

type Status = "idle" | "preview" | "record";

interface Result {
  url: string;
  name: string;
  size: number;
  mime: string;
  elapsed: number;
  saved: boolean;
}

interface Props {
  src: string;
  fileName: string;
  duration: number;
  highlights: Highlight[];
  z: Float32Array;
  /** When set, finished renders are stored in the library's clip gallery. */
  projectId?: string | null;
  defaults?: ShortsDefaults;
  initialHighlightId?: number | null;
}

export function ShortsForge({ src, fileName, duration, highlights, z, projectId, defaults, initialHighlightId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(
    highlights.find((h) => h.id === initialHighlightId)?.id ?? highlights[0]?.id ?? null,
  );
  const [hook, setHook] = useState(defaults?.hook ?? HOOKS[0]);
  const [styleId, setStyleId] = useState(SHORT_STYLES[0].id);
  const [reframe, setReframe] = useState(defaults?.reframe ?? true);
  const [punch, setPunch] = useState(defaults?.punch ?? true);
  const [bars, setBars] = useState(defaults?.bars ?? true);
  const [pad, setPad] = useState(defaults?.pad ?? 1);
  const [captions, setCaptions] = useState(true);
  const { data: project } = useProject(projectId);
  const transcript = project?.transcript;
  const words = useMemo(() => transcript?.segments.flatMap((s) => s.words) ?? null, [transcript]);
  const hasWords = !!words?.length;
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<TrackSample[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRecord, setCanRecord] = useState(true);

  useEffect(() => setCanRecord(recordingMime() !== null), []);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  const highlight = highlights.find((h) => h.id === selectedId) ?? highlights[0];
  const start = highlight ? Math.max(0, highlight.start - pad) : 0;
  const end = highlight ? Math.min(duration, highlight.end + pad, start + MAX_CLIP) : 0;
  const style = SHORT_STYLES.find((s) => s.id === styleId) ?? SHORT_STYLES[0];
  const options = useMemo(
    () => ({ hook, style, reframe, punch, bars, captions: captions && hasWords ? words : null }),
    [hook, style, reframe, punch, bars, captions, hasWords, words],
  );

  // Redraw the first frame whenever the look changes, so the phone always shows the current design.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (status !== "idle" || !highlight || !canvas) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      renderShort({ src, start, end, z, options, canvas, mode: "still", signal: controller.signal }).catch(() => undefined);
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [src, start, end, z, options, status, highlight]);

  const run = async (mode: "preview" | "record") => {
    const canvas = canvasRef.current;
    if (!highlight || !canvas) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus(mode);
    setProgress(0);
    setError(null);
    setSamples([]);
    const task = mode === "record" ? startTask({ kind: "short", title: `Short #${highlight.id} · ${fileName}`, projectId, cancel: () => controller.abort() }) : null;
    task?.update({ stage: `${style.label} · ${formatClock(start)}–${formatClock(end)}` });
    try {
      const out = await renderShort({
        src,
        start,
        end,
        z,
        options,
        canvas,
        mode,
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(Math.round(p * 100));
          task?.update({ progress: p });
        },
      });
      if (task) {
        if (out.blob) task.done(`${formatBytes(out.blob.size)} en ${(out.elapsed / 1000).toFixed(1)} s`);
        else task.cancelled();
      }
      setSamples(out.samples);
      if (out.blob) {
        const base = fileName.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_");
        const name = `${base}_short${String(highlight.id).padStart(2, "0")}.${out.mime.includes("mp4") ? "mp4" : "webm"}`;
        const mime = out.mime.split(";")[0];
        let saved = false;
        if (projectId) {
          try {
            await saveRender(
              {
                projectId,
                kind: "short",
                name,
                mime,
                duration: end - start,
                width: 720,
                height: 1280,
                settings: { highlightId: highlight.id, start, end, hook, style: style.id, reframe, punch, bars, captions: !!options.captions },
              },
              out.blob,
            );
            saved = true;
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar el render en la biblioteca.");
          }
        }
        setResult({ url: URL.createObjectURL(out.blob), name, size: out.blob.size, mime, elapsed: out.elapsed, saved });
      }
    } catch (err) {
      task?.fail(err);
      setError(err instanceof Error ? err.message : "No se pudo renderizar el clip.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStatus("idle");
      }
    }
  };

  if (!highlight) {
    return <p className="text-sm text-zinc-400">Subí la sensibilidad para detectar momentos y convertirlos en Shorts.</p>;
  }

  const busy = status !== "idle";

  return (
    <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="mx-auto flex w-[286px] flex-col items-center gap-3 sm:w-[316px]">
        <div
          className="relative rounded-[36px] border border-white/15 bg-black p-2 transition-shadow duration-500"
          style={{ boxShadow: `0 30px 90px -30px ${style.accent}` }}
        >
          <canvas ref={canvasRef} width={720} height={1280} className="block aspect-[9/16] w-[270px] rounded-[28px] bg-zinc-950 sm:w-[300px]" />
          {busy && (
            <span className="absolute left-5 top-[4.5rem] flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
              <span className={cn("h-2 w-2 rounded-full", status === "record" ? "animate-pulse bg-red-500" : "bg-emerald-400")} />
              {status === "record" ? `REC ${progress}%` : "PREVIEW"}
            </span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        {samples.length > 2 && <TrackChart samples={samples} />}
      </div>

      <div className="min-w-0 space-y-6">
        <Section step="1" title="Momento">
          <div className="flex flex-wrap gap-2">
            {highlights.map((h) => (
              <button
                key={h.id}
                disabled={busy}
                onClick={() => setSelectedId(h.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition-all disabled:opacity-50",
                  h.id === highlight.id
                    ? "border-[#ff2e63] bg-[#ff2e63]/15 shadow-[0_8px_30px_-12px_#ff2e63]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25",
                )}
              >
                <span className="block font-display text-lg leading-none tracking-wide">#{h.id}</span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {formatClock(h.start)} · {h.score}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="text-sm text-zinc-400">Margen</span>
            <Slider value={[pad]} min={0} max={4} step={0.5} disabled={busy} onValueChange={([v]) => setPad(v)} className="max-w-[200px] flex-1" />
            <span className="font-mono text-sm text-[#ff9f1c]">±{pad}s</span>
            <span className="text-xs text-zinc-500">
              clip {formatClock(start)} → {formatClock(end)} · {(end - start).toFixed(1)} s
            </span>
          </div>
        </Section>

        <Section step="2" title="Gancho">
          <Input value={hook} maxLength={48} disabled={busy} onChange={(e) => setHook(e.target.value)} className="border-white/10 bg-white/5 font-display text-lg tracking-wide" />
          <div className="mt-2 flex flex-wrap gap-2">
            {HOOKS.map((h) => (
              <button
                key={h}
                disabled={busy}
                onClick={() => setHook(h)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-[#ff9f1c]/60 hover:text-white"
              >
                {h}
              </button>
            ))}
          </div>
        </Section>

        <Section step="3" title="Estilo y efectos">
          <div className="flex flex-wrap gap-3">
            {SHORT_STYLES.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => setStyleId(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
                  s.id === style.id ? "border-white/60 bg-white/10" : "border-white/10 hover:border-white/30",
                )}
              >
                <span className="h-5 w-5 rounded-md" style={{ background: `linear-gradient(135deg, ${s.accent}, ${s.accent2})` }} />
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <Toggle icon={Crosshair} label="Auto-reencuadre" hint="Sigue el movimiento" checked={reframe} onChange={setReframe} disabled={busy} />
            <Toggle icon={Zap} label="Punch-in" hint="Zoom y temblor en picos" checked={punch} onChange={setPunch} disabled={busy} />
            <Toggle icon={AudioLines} label="Espectro" hint="Barras del audio real" checked={bars} onChange={setBars} disabled={busy} />
            <Toggle
              icon={Captions}
              label="Subtítulos"
              hint={hasWords ? `Karaoke con ${words!.length} palabras` : "Transcribí el video primero"}
              checked={captions && hasWords}
              onChange={setCaptions}
              disabled={busy || !hasWords}
            />
          </div>
          {!hasWords && projectId && (
            <Link href={`/transcriptions?p=${encodeURIComponent(projectId)}`} className="mt-2 inline-flex items-center gap-1.5 text-xs text-sky-300 hover:underline">
              <Captions className="h-3.5 w-3.5" /> Transcribir con Whisper para agregar subtítulos
            </Link>
          )}
        </Section>

        <div className="flex flex-wrap items-center gap-3">
          {busy ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()} className="border-white/15 bg-transparent">
              <Square className="mr-2 h-4 w-4" /> Detener
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => run("preview")} className="border-white/15 bg-transparent">
                <Play className="mr-2 h-4 w-4" /> Preview
              </Button>
              <Button
                onClick={() => run("record")}
                disabled={!canRecord}
                className="bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] text-white shadow-[0_8px_30px_-10px_#ff2e63] hover:opacity-90"
              >
                <Wand2 className="mr-2 h-4 w-4" /> Renderizar Short
              </Button>
            </>
          )}
          {status === "record" && (
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-[#ff2e63]" /> Grabando en tiempo real — dejá la pestaña visible
            </span>
          )}
          {!canRecord && <span className="text-xs text-amber-300">Este navegador no soporta MediaRecorder: solo preview.</span>}
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        {result && (
          <div className="animate-fade-in flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
            <video src={result.url} controls playsInline className="aspect-[9/16] w-24 rounded-lg bg-black object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm text-emerald-300">{result.name}</p>
              <p className="text-xs text-zinc-400">
                720×1280 · {result.mime} · {formatBytes(result.size)} · render {(result.elapsed / 1000).toFixed(1)} s
              </p>
              {result.saved && (
                <Link href="/clips" className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline">
                  <Database className="h-3 w-3" /> Guardado en la Galería de clips
                </Link>
              )}
            </div>
            <Button asChild className="bg-emerald-500 text-black hover:bg-emerald-400">
              <a href={result.url} download={result.name}>
                <Download className="mr-2 h-4 w-4" /> Descargar
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-display text-xl tracking-wide">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 font-sans text-xs">{step}</span>
        {title.toUpperCase()}
      </h3>
      {children}
    </section>
  );
}

function Toggle({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  icon: typeof Zap;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors", checked ? "border-[#ff2e63]/50 bg-[#ff2e63]/[0.06]" : "border-white/10")}>
      <Icon className={cn("h-5 w-5 shrink-0", checked ? "text-[#ff6b8b]" : "text-zinc-500")} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-zinc-500">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

/** Where the virtual camera pointed during the last run (crop center over time) and how hard it punched in. */
function TrackChart({ samples }: { samples: TrackSample[] }) {
  const accent = "#7dd3fc";
  const W = 300;
  const H = 72;
  const maxT = samples[samples.length - 1].t || 1;
  const path = (y: (s: TrackSample) => number) => samples.map((s) => `${((s.t / maxT) * W).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
  return (
    <div className="w-full rounded-xl border border-white/10 bg-black/40 p-2">
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span style={{ color: accent }}>Cámara izq ↔ der</span>
        <span className="text-[#ffe14d]">Zoom</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" preserveAspectRatio="none">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
        <polyline points={path((s) => 4 + s.x * (H - 8))} fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={path((s) => H - 4 - (s.zoom - 1) * 5.5 * (H - 8))} fill="none" stroke="#ffe14d" strokeWidth="1.5" strokeOpacity="0.8" />
      </svg>
    </div>
  );
}
