"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Eye, Gamepad2, GraduationCap, MessageSquare, Mic, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { EmptyLibrary, MomentTimeline, PageHeader, Panel, ProjectPicker } from "@/components/studio/common";
import { useActiveProject } from "@/lib/library/hooks";
import { choiceFromPreset, PRESETS, presetById, usePresetChoice, type PresetChoice, type PresetIcon } from "@/lib/presets";
import { detectMoments, thresholdFor, type DetectOptions } from "@/lib/studio/analyze";
import { cn } from "@/lib/utils";

const ICONS: Record<PresetIcon, LucideIcon> = { chat: MessageSquare, gamepad: Gamepad2, eye: Eye, mic: Mic, graduation: GraduationCap };

const PARAMS: { key: keyof DetectOptions; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "mergeGap", label: "Unir ráfagas separadas por", min: 0.5, max: 8, step: 0.5, unit: "s" },
  { key: "padBefore", label: "Contexto antes", min: 0, max: 6, step: 0.5, unit: "s" },
  { key: "padAfter", label: "Contexto después", min: 0, max: 6, step: 0.5, unit: "s" },
  { key: "minLength", label: "Duración mínima", min: 0.5, max: 10, step: 0.5, unit: "s" },
  { key: "maxHighlights", label: "Máximo de momentos", min: 3, max: 24, step: 1, unit: "" },
];

export default function EditTypePage() {
  const [saved, save] = usePresetChoice();
  const [draft, setDraft] = useState<PresetChoice | null>(null);
  const choice = draft ?? saved;
  const preset = presetById(choice.id);
  const { projects, project, select, loading } = useActiveProject();
  const dirty = JSON.stringify(choice) !== JSON.stringify(saved);

  const results = useMemo(() => {
    if (!project) return null;
    const run = (c: PresetChoice) => detectMoments(project.db, project.duration, c.sensitivity, c.detect);
    return {
      current: run(choice),
      perPreset: PRESETS.map((p) => {
        const m = run(p.id === choice.id ? choice : choiceFromPreset(p));
        return { preset: p, count: m.highlights.length, covered: m.highlights.reduce((acc, h) => acc + h.end - h.start, 0) };
      }),
    };
  }, [project, choice]);

  const setParam = (key: keyof DetectOptions, value: number) => setDraft({ ...choice, detect: { ...choice.detect, [key]: value } });
  const current = results?.current;
  const covered = current ? current.highlights.reduce((acc, h) => acc + h.end - h.start, 0) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Detección"
        title="TIPO DE EDICIÓN"
        description="Cada tipo de contenido usa parámetros distintos para encontrar momentos. El preset activo se aplica al analizar en el Studio y define los valores iniciales de los Shorts."
        actions={
          <div className="flex flex-wrap gap-2">
            {dirty && (
              <Button variant="outline" onClick={() => setDraft(null)} className="border-white/15 bg-transparent">
                Descartar cambios
              </Button>
            )}
            <Button
              onClick={() => {
                save(choice);
                setDraft(null);
              }}
              disabled={!dirty}
              className="bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] text-white disabled:opacity-40"
            >
              <Check className="mr-2 h-4 w-4" /> {dirty ? "Usar este preset" : "Preset activo"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {PRESETS.map((p) => {
          const Icon = ICONS[p.icon];
          const on = p.id === choice.id;
          const count = results?.perPreset.find((r) => r.preset.id === p.id)?.count;
          return (
            <button
              key={p.id}
              onClick={() => setDraft(p.id === saved.id ? saved : choiceFromPreset(p))}
              aria-pressed={on}
              className={cn(
                "relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
                on ? "border-[#ff2e63] bg-[#ff2e63]/[0.07] shadow-[0_14px_40px_-20px_#ff2e63]" : "border-white/10 bg-white/[0.03] hover:border-white/25",
              )}
            >
              {p.id === saved.id && (
                <span className="absolute right-3 top-3 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Activo
                </span>
              )}
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", on ? "bg-gradient-to-br from-[#ff2e63] to-[#ff9f1c]" : "bg-white/5")}>
                <Icon className="h-5 w-5 text-white" />
              </span>
              <span>
                <span className="block font-display text-xl tracking-wide">{p.title.toUpperCase()}</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{p.tagline}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {p.features.map((f) => (
                  <span key={f} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">
                    {f}
                  </span>
                ))}
              </span>
              {count !== undefined && (
                <span className="mt-auto font-mono text-[11px] text-[#ff9f1c]" data-testid={`count-${p.id}`}>
                  {count} momentos en este video
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl tracking-wide">AJUSTE FINO</h2>
            <Button size="sm" variant="ghost" onClick={() => setDraft(choiceFromPreset(preset))} className="text-zinc-400">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar
            </Button>
          </div>
          <Param label="Sensibilidad" display={`${choice.sensitivity} · z ≥ ${thresholdFor(choice.sensitivity).toFixed(2)}`}>
            <Slider value={[choice.sensitivity]} min={0} max={100} step={1} onValueChange={([v]) => setDraft({ ...choice, sensitivity: v })} />
          </Param>
          {PARAMS.map((param) => (
            <Param key={param.key} label={param.label} display={`${choice.detect[param.key]}${param.unit && ` ${param.unit}`}`}>
              <Slider value={[choice.detect[param.key]]} min={param.min} max={param.max} step={param.step} onValueChange={([v]) => setParam(param.key, v)} />
            </Param>
          ))}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-400">
            Shorts por defecto: gancho “{preset.shorts.hook}” · reencuadre {preset.shorts.reframe ? "sí" : "no"} · punch-in{" "}
            {preset.shorts.punch ? "sí" : "no"} · espectro {preset.shorts.bars ? "sí" : "no"} · margen ±{preset.shorts.pad}s
          </div>
        </Panel>

        <Panel className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl tracking-wide">PROBALO CON TUS VIDEOS</h2>
            {project && (
              <Link href={`/studio?p=${encodeURIComponent(project.id)}`} className="inline-flex items-center gap-1.5 text-sm text-[#ff9f1c] hover:underline">
                <Sparkles className="h-4 w-4" /> Abrir en Studio
              </Link>
            )}
          </div>
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-white/5" />
          ) : !project || !current || !results ? (
            <EmptyLibrary text="Analizá un video en el Studio y vas a poder comparar cuántos momentos encuentra cada preset sobre tu propio audio." />
          ) : (
            <>
              <ProjectPicker projects={projects} value={project.id} onChange={select} />
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Momentos" value={String(current.highlights.length)} />
                <Metric label="Cubre" value={`${Math.round((covered / project.duration) * 100)}%`} />
                <Metric label="Duración media" value={current.highlights.length ? `${(covered / current.highlights.length).toFixed(1)} s` : "—"} />
              </div>
              <MomentTimeline db={project.db} duration={project.duration} highlights={current.highlights} height={72} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="py-2 font-medium">Preset</th>
                      <th className="py-2 font-medium">Momentos</th>
                      <th className="py-2 font-medium">Tiempo cubierto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.perPreset.map((r) => (
                      <tr key={r.preset.id} className={cn("border-t border-white/5", r.preset.id === choice.id && "text-[#ff9f1c]")}>
                        <td className="py-2">{r.preset.title}</td>
                        <td className="py-2 font-mono">{r.count}</td>
                        <td className="py-2 font-mono">{r.covered.toFixed(1)} s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Param({ label, display, children }: { label: string; display: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-xs text-[#ff9f1c]">{display}</span>
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-display text-2xl tracking-wide">{value}</div>
    </div>
  );
}
