"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, CheckCircle2, Clapperboard, Database, Film, Flame, Gauge, ImageIcon, ListVideo, Loader2, RotateCcw, Scissors, SlidersHorizontal, Smartphone, Terminal, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProject, projectAsFile, projectIdFor, saveProject, updateProject } from "@/lib/library";
import { presetById, usePresetChoice } from "@/lib/presets";
import {
  buildChapters,
  decodeAudio,
  DEFAULT_DETECT,
  detectMoments,
  measureEnergy,
  pickFrameTimes,
  type DetectOptions,
  type Energy,
  type Highlight,
} from "@/lib/studio/analyze";
import { extractFrames, type FrameCandidate } from "@/lib/studio/frames";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";
import { Dropzone } from "./ui/Dropzone";
import { ChaptersPanel, defaultChapterTitle, ExportPanel } from "./ui/ExportPanels";
import { MomentList } from "./ui/MomentList";
import { RecentProjects } from "./ui/RecentProjects";
import { ShortsForge } from "./ui/ShortsForge";
import { ThumbnailMaker } from "./ui/ThumbnailMaker";
import { Waveform } from "./ui/Waveform";

type Phase = "idle" | "working" | "ready" | "error";

const STEPS = [
  { label: "Decodificando audio", icon: AudioLines },
  { label: "Midiendo energía (ventanas de 50 ms)", icon: Gauge },
  { label: "Detectando momentos", icon: Flame },
  { label: "Extrayendo frames", icon: Film },
  { label: "Puntuando miniaturas", icon: ImageIcon },
];

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export default function StudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [frameProgress, setFrameProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [sensitivity, setSensitivity] = useState(55);
  const [frames, setFrames] = useState<FrameCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shorts, setShorts] = useState(false);
  const [makerFrame, setMakerFrame] = useState<FrameCandidate | null>(null);
  const [chapterTitles, setChapterTitles] = useState<Record<number, string>>({});
  const [detect, setDetect] = useState<DetectOptions>(DEFAULT_DETECT);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preset] = usePresetChoice();
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopAtRef = useRef<number | null>(null);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const moments = useMemo(
    () => (energy ? detectMoments(energy.db, energy.duration, sensitivity, detect) : null),
    [energy, sensitivity, detect],
  );
  const chapters = useMemo(
    () => (energy && moments ? buildChapters(energy.duration, moments.highlights) : []),
    [energy, moments],
  );

  const analyze = useCallback(
    async (f: File) => {
      const url = URL.createObjectURL(f);
      setFile(f);
      setSrc(url);
      setPhase("working");
      setError(null);
      setEnergy(null);
      setFrames([]);
      setSelectedId(null);
      setChapterTitles({});
      setProjectId(null);
      setSaveError(null);
      setStep(0);
      setFrameProgress(0);
      try {
        const id = projectIdFor(f);
        const previous = await getProject(id).catch(() => undefined);
        const choice = presetRef.current;
        const sens = previous?.sensitivity ?? choice.sensitivity;
        const previousTitles: Record<number, string> = Object.fromEntries((previous?.chapters ?? []).map((c) => [c.time, c.title]));
        setSensitivity(sens);
        setDetect(choice.detect);
        setChapterTitles(previousTitles);

        await nextFrame();
        const buffer = await decodeAudio(f);
        setStep(1);
        await nextFrame();
        const measured = measureEnergy(buffer);
        setStep(2);
        await nextFrame();
        const detected = detectMoments(measured.db, measured.duration, sens, choice.detect);
        setEnergy(measured);
        setStep(3);
        const extracted = f.type.startsWith("video/")
          ? await extractFrames(url, pickFrameTimes(measured.duration, detected.highlights), (done, total) =>
              setFrameProgress(Math.round((done / total) * 100)),
            )
          : [];
        setStep(4);
        await nextFrame();
        const sorted = extracted.sort((a, b) => b.score - a.score);
        setFrames(sorted);
        setPhase("ready");

        try {
          const now = Date.now();
          await saveProject(
            {
              id,
              name: f.name,
              mime: f.type,
              size: f.size,
              lastModified: f.lastModified,
              createdAt: previous?.createdAt ?? now,
              updatedAt: now,
              duration: measured.duration,
              width: videoRef.current?.videoWidth ?? previous?.width ?? 0,
              height: videoRef.current?.videoHeight ?? previous?.height ?? 0,
              hasVideo: f.type.startsWith("video/"),
              db: measured.db,
              waveform: measured.waveform,
              sensitivity: sens,
              presetId: choice.id,
              highlights: detected.highlights,
              chapters: buildChapters(measured.duration, detected.highlights).map((c, i) => ({
                time: c.time,
                title: previousTitles[c.time] ?? defaultChapterTitle(c, i),
              })),
              thumbs: sorted.slice(0, 12).map(({ time, score, highlightId, dataUrl }) => ({ time, score, highlightId, dataUrl })),
              poster: sorted[0]?.dataUrl ?? previous?.poster,
              transcript: previous?.transcript,
              publish: previous?.publish,
            },
            previous ? undefined : f,
          );
          setProjectId(id);
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : "No se pudo guardar en la biblioteca.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo analizar el archivo.");
        setPhase("error");
      }
    },
    [],
  );

  // Keep the library in sync with sensitivity and chapter edits.
  useEffect(() => {
    if (!projectId || !energy || !moments || phase !== "ready") return;
    const timer = setTimeout(() => {
      void updateProject(projectId, {
        sensitivity,
        highlights: moments.highlights,
        chapters: buildChapters(energy.duration, moments.highlights).map((c, i) => ({
          time: c.time,
          title: chapterTitles[c.time] ?? defaultChapterTitle(c, i),
        })),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [projectId, energy, moments, sensitivity, chapterTitles, phase]);

  const openProject = useCallback(
    async (id: string) => {
      try {
        const project = await getProject(id);
        if (!project) throw new Error("Ese proyecto ya no existe en la biblioteca.");
        await analyze(await projectAsFile(project));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo abrir el proyecto.");
      }
    },
    [analyze],
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("p");
    if (id) void openProject(id);
  }, [openProject]);

  const seek = (time: number) => {
    const v = videoRef.current;
    if (!v) return;
    stopAtRef.current = null;
    v.currentTime = time;
  };

  const playMoment = (h: Highlight) => {
    const v = videoRef.current;
    if (!v) return;
    setSelectedId(h.id);
    v.currentTime = h.start;
    stopAtRef.current = h.end;
    void v.play();
  };

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setSrc(null);
    setEnergy(null);
    setFrames([]);
  };

  if (phase === "idle" || !file || !src) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 py-6">
        <StudioHeader />
        <PresetChip id={preset.id} className="mx-auto" />
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        <Dropzone onFile={analyze} />
        <RecentProjects onOpen={openProject} />
      </div>
    );
  }

  const best = frames[0];
  const highlights = moments?.highlights ?? [];
  const isVideo = file.type.startsWith("video/");
  const defaultTab = isVideo && highlights.length ? "shorts" : frames.length ? "thumbs" : "chapters";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Studio · análisis local</p>
          <h1 className="truncate font-display text-3xl tracking-wide md:text-4xl">{file.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span>
              {formatBytes(file.size)}
              {energy && ` · ${formatClock(energy.duration)}`}
            </span>
            <PresetChip id={preset.id} />
            {projectId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                <Database className="h-3 w-3" /> Guardado en la biblioteca
              </span>
            )}
            {saveError && <span className="text-xs text-amber-300">{saveError}</span>}
          </div>
        </div>
        <Button variant="outline" onClick={reset} className="border-white/15 bg-transparent">
          <RotateCcw className="mr-2 h-4 w-4" /> Otro archivo
        </Button>
      </div>

      {phase === "error" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">{error}</div>
      )}

      {moments && energy && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat icon={Clapperboard} label="Duración" value={formatClock(energy.duration)} />
          <Stat icon={Flame} label="Momentos" value={String(highlights.length)} accent />
          <Stat icon={ListVideo} label="Capítulos" value={String(chapters.length)} />
          <Stat icon={VolumeX} label="Silencio" value={`${Math.round(moments.silenceRatio * 100)}%`} />
          <Stat icon={ImageIcon} label="Mejor miniatura" value={best ? `${best.score}/100` : "—"} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div className="flex items-center justify-center bg-[radial-gradient(circle_at_center,#1a1a2e,#050508)]">
              <div className={cn("relative transition-all duration-500", shorts ? "aspect-[9/16] h-[520px]" : "aspect-video w-full")}>
                <video
                  ref={videoRef}
                  src={src}
                  controls
                  playsInline
                  className={cn("h-full w-full", shorts ? "object-cover" : "object-contain")}
                  onTimeUpdate={(e) => {
                    const stopAt = stopAtRef.current;
                    if (stopAt !== null && e.currentTarget.currentTime >= stopAt) {
                      e.currentTarget.pause();
                      stopAtRef.current = null;
                    }
                  }}
                />
                {shorts && (
                  <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-[#ff2e63] px-2 py-0.5 font-display text-sm tracking-wide text-white">
                    SHORTS 9:16
                  </span>
                )}
              </div>
            </div>
            {phase === "working" && <Progress step={step} frameProgress={frameProgress} />}
          </div>

          {energy && moments && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                  <Legend className="bg-[#ff6b8b]" label="Highlight" />
                  <Legend className="bg-violet-400" label="Energía (z-score)" />
                  <Legend className="bg-slate-500/40" label="Silencio" />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShorts((s) => !s)}
                  className={cn("border-white/15 bg-transparent", shorts && "border-[#ff2e63] text-[#ff2e63]")}
                >
                  <Smartphone className="mr-1.5 h-4 w-4" /> Vista Shorts
                </Button>
              </div>
              <Waveform
                waveform={energy.waveform}
                z={moments.z}
                duration={energy.duration}
                highlights={highlights}
                silences={moments.silences}
                selectedId={selectedId}
                videoRef={videoRef}
                onSeek={seek}
              />
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="text-sm text-zinc-400">Sensibilidad</span>
                <Slider
                  value={[sensitivity]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setSensitivity(v)}
                  className="max-w-xs flex-1 [&_[role=slider]]:border-[#ff2e63] [&>span:first-child>span]:bg-gradient-to-r [&>span:first-child>span]:from-[#ff2e63] [&>span:first-child>span]:to-[#ff9f1c]"
                />
                <span className="font-mono text-sm text-[#ff9f1c]">{sensitivity}</span>
                <span className="text-xs text-zinc-500">
                  umbral z ≥ {(4 - (sensitivity / 100) * 3).toFixed(2)} · base {moments.medianDb.toFixed(1)} dBFS · pico{" "}
                  {moments.peakDb.toFixed(1)} dBFS
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-wide">MOMENTOS</h2>
            <span className="rounded-full bg-[#ff2e63]/15 px-2.5 py-0.5 text-xs text-[#ff6b8b]">
              {highlights.length} detectados
            </span>
          </div>
          {moments ? (
            <div className="max-h-[640px] overflow-auto pr-1">
              <MomentList highlights={highlights} selectedId={selectedId} onPlay={playMoment} />
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          )}
        </aside>
      </div>

      {phase === "ready" && energy && moments && (
        <Tabs defaultValue={defaultTab} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <TabsList className="mb-4 bg-black/40">
            {isVideo && (
              <TabsTrigger value="shorts">
                <Scissors className="mr-1.5 h-4 w-4" /> Shorts
              </TabsTrigger>
            )}
            {frames.length > 0 && (
              <TabsTrigger value="thumbs">
                <ImageIcon className="mr-1.5 h-4 w-4" /> Miniaturas
              </TabsTrigger>
            )}
            <TabsTrigger value="chapters">
              <ListVideo className="mr-1.5 h-4 w-4" /> Capítulos
            </TabsTrigger>
            <TabsTrigger value="export">
              <Terminal className="mr-1.5 h-4 w-4" /> Exportar
            </TabsTrigger>
          </TabsList>

          {isVideo && (
            <TabsContent value="shorts">
              <ShortsForge
                key={projectId ?? file.name}
                src={src}
                fileName={file.name}
                duration={energy.duration}
                highlights={highlights}
                z={moments.z}
                projectId={projectId}
                defaults={presetById(preset.id).shorts}
              />
            </TabsContent>
          )}

          {frames.length > 0 && (
            <TabsContent value="thumbs">
              <p className="mb-4 text-sm text-zinc-400">
                Frames de los picos + muestreo uniforme, ordenados por brillo, contraste y colorido. Tocá uno para diseñar la miniatura.
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {frames.map((f, i) => (
                  <button
                    key={`${f.time}-${i}`}
                    onClick={() => setMakerFrame(f)}
                    className="animate-fade-in group relative overflow-hidden rounded-xl border border-white/10 text-left transition-all hover:-translate-y-1 hover:border-[#ff2e63]/60 hover:shadow-[0_12px_40px_-12px_#ff2e63]"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.dataUrl} alt={`Frame en ${formatClock(f.time)}`} className="aspect-video w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-6">
                      <span className="font-mono text-xs text-white">{formatClock(f.time)}</span>
                      <span className="flex items-center gap-1.5">
                        {f.highlightId && (
                          <span className="rounded bg-[#ff2e63] px-1.5 text-[10px] font-semibold text-white">#{f.highlightId}</span>
                        )}
                        <span className="font-mono text-xs text-[#ffe14d]">{f.score}</span>
                      </span>
                    </div>
                    {i === 0 && (
                      <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-2 py-0.5 font-display text-xs tracking-wide text-white">
                        MEJOR
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="chapters">
            <ChaptersPanel
              chapters={chapters}
              titles={chapterTitles}
              onTitle={(time, title) => setChapterTitles((t) => ({ ...t, [time]: title }))}
              onSeek={seek}
            />
          </TabsContent>

          <TabsContent value="export">
            <ExportPanel
              fileName={file.name}
              duration={energy.duration}
              highlights={highlights}
              sensitivity={sensitivity}
              chapters={chapters.map((c, i) => ({ time: c.time, title: chapterTitles[c.time] ?? defaultChapterTitle(c, i) }))}
            />
          </TabsContent>
        </Tabs>
      )}

      <ThumbnailMaker frame={makerFrame} src={src} onClose={() => setMakerFrame(null)} />
    </div>
  );
}

function StudioHeader() {
  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Funciona sin backend
      </span>
      <h1 className="mt-4 font-display text-5xl tracking-wide md:text-6xl">
        AUTOYT <span className="text-gradient">STUDIO</span>
      </h1>
    </div>
  );
}

function PresetChip({ id, className }: { id: string; className?: string }) {
  return (
    <Link
      href="/edit-type"
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300 transition-colors hover:border-[#ff9f1c]/60",
        className,
      )}
    >
      <SlidersHorizontal className="h-3 w-3 text-[#ff9f1c]" /> Preset: {presetById(id).title}
    </Link>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Flame; label: string; value: string; accent?: boolean }) {
  return (
    <div className="animate-fade-in rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("mt-1 font-display text-3xl tracking-wide", accent && "text-gradient")}>{value}</div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} /> {label}
    </span>
  );
}

function Progress({ step, frameProgress }: { step: number; frameProgress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <ol className="w-full max-w-sm space-y-3 p-6">
        {STEPS.map(({ label, icon: Icon }, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 text-sm transition-opacity",
              i > step ? "opacity-35" : "opacity-100",
            )}
          >
            {i < step ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : i === step ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#ff2e63]" />
            ) : (
              <Icon className="h-5 w-5 text-zinc-500" />
            )}
            <span className="flex-1">{label}</span>
            {i === 3 && step === 3 && <span className="font-mono text-xs text-[#ff9f1c]">{frameProgress}%</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
