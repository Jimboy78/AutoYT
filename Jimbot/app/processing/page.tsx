"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, Clock, Loader2, Server, Square, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatCard } from "@/components/studio/common";
import { API_CONFIGURED, listJobs, type Job } from "@/lib/api";
import { useProjects } from "@/lib/library/hooks";
import { cancelTask, canCancel, clearFinishedTasks, useTasks, type TaskKind, type TaskRecord } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<TaskKind, string> = {
  analysis: "Análisis",
  transcription: "Transcripción",
  short: "Short",
  conversion: "Conversión",
  montage: "Montaje",
  thumbnail: "Miniatura",
};

const KIND_COLOR: Record<TaskKind, string> = {
  analysis: "#a78bfa",
  transcription: "#38bdf8",
  short: "#ff2e63",
  conversion: "#c084fc",
  montage: "#fbbf24",
  thumbnail: "#4ade80",
};

function kindHref(task: TaskRecord) {
  const p = task.projectId ? `?p=${task.projectId}` : "";
  switch (task.kind) {
    case "analysis":
      return `/studio${p}`;
    case "transcription":
      return `/transcriptions${p}`;
    case "thumbnail":
      return `/thumbnails${p}`;
    case "conversion":
      return `/conversion${p}`;
    case "montage":
      return "/editor";
    default:
      return "/clips";
  }
}

function formatDuration(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}

function relative(ts: number, now: number) {
  const s = Math.round((now - ts) / 1000);
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(ts).toLocaleDateString("es");
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), active ? 500 : 15000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export default function ProcessingPage() {
  const tasks = useTasks();
  const projects = useProjects();
  const [filter, setFilter] = useState<TaskKind | "all">("all");
  const running = tasks.filter((t) => t.status === "running");
  const now = useNow(running.length > 0);
  const names = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);

  const finished = tasks.filter((t) => t.status !== "running");
  const done = finished.filter((t) => t.status === "done");
  const failed = finished.filter((t) => t.status === "error");
  const busyMs = done.reduce((acc, t) => acc + ((t.endedAt ?? t.startedAt) - t.startedAt), 0);

  const byKind = useMemo(() => {
    const stats = new Map<TaskKind, { count: number; ms: number; failed: number }>();
    for (const t of finished) {
      const s = stats.get(t.kind) ?? { count: 0, ms: 0, failed: 0 };
      if (t.status === "done") {
        s.count++;
        s.ms += (t.endedAt ?? t.startedAt) - t.startedAt;
      } else if (t.status === "error") s.failed++;
      stats.set(t.kind, s);
    }
    return [...stats.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [finished]);
  const maxAvg = Math.max(1, ...byKind.map(([, s]) => (s.count ? s.ms / s.count : 0)));

  const history = finished.filter((t) => filter === "all" || t.kind === filter);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Monitor"
        title="PROCESAMIENTO"
        description="Todo el trabajo pesado (análisis, Whisper, renders, conversiones) corre en tu navegador y reporta su progreso real acá. Podés cancelar lo que esté en curso."
        actions={
          finished.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearFinishedTasks} className="border-white/15 bg-transparent">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpiar historial
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="processing-stats">
        <StatCard icon={Activity} label="En curso" value={String(running.length)} accent={running.length > 0} />
        <StatCard icon={CheckCircle2} label="Completadas" value={String(done.length)} />
        <StatCard icon={XCircle} label="Con error" value={String(failed.length)} hint={failed.length ? "incluye interrumpidas" : undefined} />
        <StatCard icon={Clock} label="Tiempo de cómputo" value={formatDuration(busyMs)} hint="suma de tareas completadas" />
      </div>

      <Panel className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-zinc-500">En curso</p>
        {running.length === 0 ? (
          <p className="text-sm text-zinc-500" data-testid="no-running">
            Nada corriendo. Empezá un análisis en el <Link href="/studio" className="text-[#ff9fb4] underline">Studio</Link>, una transcripción o un render y seguilo desde acá, incluso cambiando de página.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="running-tasks">
            {running.map((t) => (
              <li key={t.id} className="animate-fade-in space-y-2 rounded-xl border border-white/10 bg-black/30 p-3" data-testid="running-task">
                <div className="flex flex-wrap items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: KIND_COLOR[t.kind] }} />
                  <span className="rounded px-1.5 text-[11px] font-semibold text-black" style={{ background: KIND_COLOR[t.kind] }}>
                    {KIND_LABEL[t.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  <span className="font-mono text-xs text-zinc-400">{formatDuration(now - t.startedAt)}</span>
                  {canCancel(t.id) && (
                    <Button size="sm" variant="outline" onClick={() => cancelTask(t.id)} className="h-7 border-white/15 bg-transparent" aria-label={`Cancelar ${t.title}`}>
                      <Square className="mr-1 h-3 w-3" /> Cancelar
                    </Button>
                  )}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(t.progress * 100)}%`, background: KIND_COLOR[t.kind] }} />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>{t.stage ?? t.detail ?? "Procesando…"}</span>
                  <span className="font-mono" data-testid="running-progress">
                    {Math.round(t.progress * 100)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Historial ({history.length})</p>
            <div className="flex flex-wrap gap-1" role="tablist">
              {(["all", ...Object.keys(KIND_LABEL)] as (TaskKind | "all")[]).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => setFilter(k)}
                  className={cn("rounded-full px-2.5 py-1 text-[11px]", filter === k ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:text-white")}
                >
                  {k === "all" ? "Todas" : KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-zinc-500">Todavía no hay tareas terminadas{filter !== "all" ? " de este tipo" : ""}.</p>
          ) : (
            <ul className="divide-y divide-white/5" data-testid="task-history">
              {history.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm" data-testid="history-item" data-kind={t.kind} data-status={t.status}>
                  {t.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : t.status === "cancelled" ? (
                    <Square className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className="w-24 text-[11px] font-semibold uppercase tracking-wider" style={{ color: KIND_COLOR[t.kind] }}>
                    {KIND_LABEL[t.kind]}
                  </span>
                  <Link href={kindHref(t)} className="min-w-0 flex-1 truncate hover:underline">
                    {t.title}
                    {t.projectId && names.has(t.projectId) && !t.title.includes(names.get(t.projectId)!) && <span className="text-zinc-500"> · {names.get(t.projectId)}</span>}
                  </Link>
                  <span className={cn("text-xs", t.status === "error" ? "text-red-300" : "text-zinc-400")}>{t.status === "error" ? t.error : t.status === "cancelled" ? "Cancelada" : t.result}</span>
                  <span className="w-20 text-right font-mono text-[11px] text-zinc-500">{formatDuration((t.endedAt ?? t.startedAt) - t.startedAt)}</span>
                  <span className="w-20 text-right text-[11px] text-zinc-600">{relative(t.endedAt ?? t.startedAt, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Duración media por tipo</p>
            {byKind.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin datos todavía.</p>
            ) : (
              <ul className="space-y-2.5" data-testid="kind-stats">
                {byKind.map(([kind, s]) => {
                  const avg = s.count ? s.ms / s.count : 0;
                  return (
                    <li key={kind} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>
                          {KIND_LABEL[kind]} <span className="text-zinc-500">×{s.count}</span>
                          {s.failed > 0 && <span className="text-red-400"> · {s.failed} error</span>}
                        </span>
                        <span className="font-mono text-zinc-400">{s.count ? formatDuration(avg) : "—"}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full" style={{ width: `${(avg / maxAvg) * 100}%`, background: KIND_COLOR[kind] }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <BackendJobs />
        </div>
      </div>
    </div>
  );
}

function BackendJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_CONFIGURED) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const list = await listJobs();
        if (!cancelled) {
          setJobs(list);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Panel className="space-y-3">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        <Server className="h-3.5 w-3.5" /> Jobs del backend
      </p>
      {!API_CONFIGURED ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          Sin backend configurado: todo corre en el navegador. Con <code className="text-zinc-300">NEXT_PUBLIC_API_BASE</code> apuntando al FastAPI, sus jobs de Celery aparecen acá.
        </p>
      ) : error ? (
        <p className="text-xs text-red-300">{error}</p>
      ) : !jobs ? (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      ) : jobs.length === 0 ? (
        <p className="text-xs text-zinc-500">No hay jobs.</p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate">{j.name}</span>
                <span className="text-zinc-400">{j.status}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-violet-400" style={{ width: `${j.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
