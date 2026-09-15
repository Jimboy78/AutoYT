"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Captions, Clapperboard, Clock, Flame, HardDrive, TriangleAlert, CheckCircle2 } from "lucide-react";
import { EmptyLibrary, PageHeader, Panel, StatCard } from "@/components/studio/common";
import { dailyActivity, libraryTotals, momentPositions, projectRows, rendersByKind, scoreHistogram, topKeywords } from "@/lib/analytics/summary";
import type { RenderKind } from "@/lib/library";
import { useProjects, useRenders } from "@/lib/library/hooks";
import { formatBytes, formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

const RENDER_LABEL: Record<RenderKind, string> = {
  short: "Shorts",
  conversion: "Conversiones",
  montage: "Montajes",
  audio: "Audio WAV",
  thumbnail: "Miniaturas",
};

const hours = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : formatClock(s));

function Bars({ values, labels, color, testId }: { values: number[]; labels: string[]; color: string; testId: string }) {
  const max = Math.max(1, ...values);
  return (
    <div data-testid={testId}>
      <div className="flex h-36 items-end gap-1.5">
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" data-value={v}>
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">{v}</span>
            <div className="rounded-t-md transition-all" style={{ height: `${Math.max(v ? 4 : 1, (v / max) * 100)}%`, background: v ? color : "rgba(255,255,255,0.06)" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 truncate text-center font-mono text-[9px] text-zinc-500">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const projects = useProjects();
  const renders = useRenders();
  const list = projects.data ?? [];
  const outputs = renders.data ?? [];

  const totals = useMemo(() => libraryTotals(list, outputs), [list, outputs]);
  const rows = useMemo(() => projectRows(list, outputs), [list, outputs]);
  const positions = useMemo(() => momentPositions(list, 10), [list]);
  const scores = useMemo(() => scoreHistogram(list, 10), [list]);
  const kinds = useMemo(() => rendersByKind(outputs), [outputs]);
  const days = useMemo(() => dailyActivity(list, outputs, 14), [list, outputs]);
  const words = useMemo(() => topKeywords(list, 24), [list]);

  const totalMoments = positions.reduce((a, b) => a + b, 0);
  const lastThird = positions.slice(7).reduce((a, b) => a + b, 0);
  const firstThird = positions.slice(0, 3).reduce((a, b) => a + b, 0);
  const insight =
    totalMoments < 3
      ? null
      : lastThird > firstThird * 1.5
        ? "Tus momentos más intensos se concentran en el final: probá adelantar un teaser al inicio."
        : firstThird > lastThird * 1.5
          ? "La energía se va apagando: los mejores momentos están en el primer tercio."
          : "Los momentos están bien repartidos a lo largo de tus videos.";
  const maxKind = Math.max(1, ...kinds.map((k) => k.count));
  const maxWord = Math.max(1, ...words.map((w) => w.count));

  if (projects.loading) return <div className="mx-auto h-48 max-w-7xl animate-pulse rounded-2xl bg-white/5" />;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Métricas"
        title="ANALYTICS"
        description="Estadísticas reales de tu biblioteca: cuánto analizaste, dónde aparecen los momentos, cómo se habla en tus videos y qué produjiste a partir de ellos."
      />

      {list.length === 0 ? (
        <EmptyLibrary text="Cuando analices videos en el Studio, acá vas a ver sus métricas: densidad de momentos, palabras por minuto, renders y más." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="analytics-totals">
            <StatCard icon={Clock} label="Analizado" value={hours(totals.seconds)} hint={`${totals.projects} video${totals.projects === 1 ? "" : "s"} · ${formatBytes(totals.sourceBytes)}`} />
            <StatCard icon={Flame} label="Momentos" value={String(totals.moments)} hint={`${totals.momentsPerMinute.toFixed(1)} por minuto`} accent />
            <StatCard icon={Captions} label="Palabras transcriptas" value={totals.words.toLocaleString("es")} hint={`${totals.transcribed} de ${totals.projects} transcripto${totals.projects === 1 ? "" : "s"}`} />
            <StatCard icon={Clapperboard} label="Renders" value={String(totals.renders)} hint={`${formatBytes(totals.renderBytes)} · ${hours(totals.renderSeconds)} de video`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Dónde caen los momentos (% del video)</p>
              <Bars values={positions} labels={positions.map((_, i) => `${i * 10}%`)} color="linear-gradient(to top, #ff2e63, #ff9f1c)" testId="chart-positions" />
              {insight && <p className="text-xs text-zinc-400">{insight}</p>}
            </Panel>
            <Panel className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Distribución de puntajes</p>
              <Bars values={scores} labels={scores.map((_, i) => `${i * 10}`)} color="linear-gradient(to top, #7c3aed, #38bdf8)" testId="chart-scores" />
              <p className="text-xs text-zinc-400">El puntaje combina cuánto sobresale el pico sobre el ruido de fondo del video.</p>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <Panel className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Actividad · últimos 14 días</p>
              <div data-testid="chart-activity">
                <div className="flex h-32 items-end gap-1.5">
                  {days.map((d) => {
                    const max = Math.max(1, ...days.map((x) => x.projects + x.renders));
                    return (
                      <div key={d.day} className="flex h-full flex-1 flex-col justify-end gap-px" title={`${d.label}: ${d.projects} análisis, ${d.renders} renders`} data-day={d.day} data-projects={d.projects} data-renders={d.renders}>
                        {d.renders > 0 && <div className="rounded-t-sm bg-amber-400" style={{ height: `${(d.renders / max) * 100}%` }} />}
                        {d.projects > 0 && <div className={cn("bg-violet-400", !d.renders && "rounded-t-sm")} style={{ height: `${(d.projects / max) * 100}%` }} />}
                        {!d.projects && !d.renders && <div className="h-px bg-white/10" />}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {days.map((d) => (
                    <span key={d.day} className="flex-1 truncate text-center font-mono text-[9px] text-zinc-500">
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-violet-400" /> Videos analizados
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-amber-400" /> Renders
                </span>
              </div>
            </Panel>

            <Panel className="space-y-3">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                <HardDrive className="h-3.5 w-3.5" /> Producción por tipo
              </p>
              {kinds.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Todavía no hay renders. Creá un Short en el <Link href="/studio" className="text-[#ff9fb4] underline">Studio</Link>.
                </p>
              ) : (
                <ul className="space-y-2.5" data-testid="chart-kinds">
                  {kinds.map((k) => (
                    <li key={k.kind} className="space-y-1" data-kind={k.kind} data-count={k.count}>
                      <div className="flex justify-between text-xs">
                        <span>
                          {RENDER_LABEL[k.kind]} <span className="text-zinc-500">×{k.count}</span>
                        </span>
                        <span className="font-mono text-zinc-400">{formatBytes(k.bytes)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-[#ff2e63]" style={{ width: `${(k.count / maxKind) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {words.length > 0 && (
            <Panel className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">De qué hablás · palabras clave de tus transcripciones</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-testid="keyword-cloud">
                {words.map((w) => (
                  <span key={w.word} className="font-display tracking-wide" style={{ fontSize: `${0.85 + (w.count / maxWord) * 1.4}rem`, opacity: 0.45 + (w.count / maxWord) * 0.55 }} title={`${w.count} veces`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          <Panel className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Por video</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm" data-testid="project-table">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-2 font-medium">Video</th>
                    <th className="pb-2 text-right font-medium">Duración</th>
                    <th className="pb-2 text-right font-medium">Momentos</th>
                    <th className="pb-2 text-right font-medium">/min</th>
                    <th className="pb-2 text-right font-medium">Mejor</th>
                    <th className="pb-2 text-right font-medium">Palabras</th>
                    <th className="pb-2 text-right font-medium">PPM</th>
                    <th className="pb-2 text-right font-medium">Renders</th>
                    <th className="pb-2 text-right font-medium">Publicación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((r) => (
                    <tr key={r.id} data-project={r.id}>
                      <td className="max-w-[240px] truncate py-2.5">
                        <Link href={`/studio?p=${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs">{formatClock(r.duration)}</td>
                      <td className="py-2.5 text-right font-mono text-xs" data-cell="moments">{r.moments}</td>
                      <td className="py-2.5 text-right font-mono text-xs">{r.perMinute.toFixed(1)}</td>
                      <td className="py-2.5 text-right font-mono text-xs">{r.best || "—"}</td>
                      <td className="py-2.5 text-right font-mono text-xs" data-cell="words">
                        {r.words ? r.words : <Link href={`/transcriptions?p=${r.id}`} className="text-sky-300 hover:underline">transcribir</Link>}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs">{r.wpm || "—"}</td>
                      <td className="py-2.5 text-right font-mono text-xs" data-cell="renders">
                        {r.renders} <span className="text-zinc-500">{r.bytes ? formatBytes(r.bytes) : ""}</span>
                      </td>
                      <td className="py-2.5 text-right text-xs">
                        {r.publishReady === null ? (
                          <Link href={`/youtube?p=${r.id}`} className="text-zinc-400 hover:underline">armar</Link>
                        ) : r.publishReady ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> lista</span>
                        ) : (
                          <Link href={`/youtube?p=${r.id}`} className="inline-flex items-center gap-1 text-amber-300 hover:underline"><TriangleAlert className="h-3.5 w-3.5" /> revisar</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
