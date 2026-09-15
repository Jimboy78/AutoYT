// Content analytics computed from the local library: what was analyzed, where the moments are,
// how people talk in the videos and what got produced from them.

import type { Project, Render, RenderKind } from "../library";
import { validate } from "../publish/metadata";
import { keywords, transcriptStats } from "../transcribe/format";

export interface ProjectRow {
  id: string;
  name: string;
  duration: number;
  moments: number;
  perMinute: number;
  best: number;
  words: number;
  wpm: number;
  coverage: number;
  renders: number;
  bytes: number;
  /** null when no publish draft exists yet. */
  publishReady: boolean | null;
}

export function publishReady(project: Project): boolean | null {
  const draft = project.publish;
  if (!draft?.title) return null;
  return validate({ title: draft.title, description: draft.description, tags: draft.tags })
    .filter((c) => c.id !== "hook")
    .every((c) => c.ok);
}

export function projectRows(projects: Project[], renders: Render[]): ProjectRow[] {
  return projects.map((p) => {
    const own = renders.filter((r) => r.projectId === p.id);
    const stats = p.transcript ? transcriptStats(p.transcript, p.duration) : null;
    return {
      id: p.id,
      name: p.name,
      duration: p.duration,
      moments: p.highlights.length,
      perMinute: p.duration > 0 ? p.highlights.length / (p.duration / 60) : 0,
      best: p.highlights.reduce((m, h) => Math.max(m, h.score), 0),
      words: stats?.words ?? 0,
      wpm: stats?.wpm ?? 0,
      coverage: stats?.coverage ?? 0,
      renders: own.length,
      bytes: own.reduce((acc, r) => acc + r.size, 0),
      publishReady: publishReady(p),
    };
  });
}

export function libraryTotals(projects: Project[], renders: Render[]) {
  const seconds = projects.reduce((acc, p) => acc + p.duration, 0);
  const moments = projects.reduce((acc, p) => acc + p.highlights.length, 0);
  const transcribed = projects.filter((p) => p.transcript);
  const words = transcribed.reduce((acc, p) => acc + transcriptStats(p.transcript!, p.duration).words, 0);
  return {
    projects: projects.length,
    seconds,
    moments,
    momentsPerMinute: seconds > 0 ? moments / (seconds / 60) : 0,
    transcribed: transcribed.length,
    transcribedSeconds: transcribed.reduce((acc, p) => acc + p.duration, 0),
    words,
    renders: renders.length,
    renderBytes: renders.reduce((acc, r) => acc + r.size, 0),
    renderSeconds: renders.reduce((acc, r) => acc + (r.duration ?? 0), 0),
    sourceBytes: projects.reduce((acc, p) => acc + p.size, 0),
  };
}

/** Where moments fall inside their videos, as counts per equal slice of the runtime (peak time). */
export function momentPositions(projects: Project[], bins = 10) {
  const counts = new Array<number>(bins).fill(0);
  for (const p of projects) {
    if (p.duration <= 0) continue;
    for (const h of p.highlights) counts[Math.min(bins - 1, Math.floor((h.peakTime / p.duration) * bins))]++;
  }
  return counts;
}

export function scoreHistogram(projects: Project[], bins = 10) {
  const counts = new Array<number>(bins).fill(0);
  for (const p of projects) for (const h of p.highlights) counts[Math.min(bins - 1, Math.floor((h.score / 100) * bins))]++;
  return counts;
}

export function rendersByKind(renders: Render[]) {
  const map = new Map<RenderKind, { kind: RenderKind; count: number; bytes: number; seconds: number }>();
  for (const r of renders) {
    const entry = map.get(r.kind) ?? { kind: r.kind, count: 0, bytes: 0, seconds: 0 };
    entry.count++;
    entry.bytes += r.size;
    entry.seconds += r.duration ?? 0;
    map.set(r.kind, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Projects analyzed and renders produced per local calendar day, oldest first. */
export function dailyActivity(projects: Project[], renders: Render[], days = 14, now = Date.now()) {
  const today = new Date(now);
  const out: { day: string; label: string; projects: number; renders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push({ day: dayKey(d.getTime()), label: `${d.getDate()}/${d.getMonth() + 1}`, projects: 0, renders: 0 });
  }
  const index = new Map(out.map((d, i) => [d.day, i]));
  for (const p of projects) {
    const i = index.get(dayKey(p.createdAt));
    if (i !== undefined) out[i].projects++;
  }
  for (const r of renders) {
    const i = index.get(dayKey(r.createdAt));
    if (i !== undefined) out[i].renders++;
  }
  return out;
}

export function topKeywords(projects: Project[], limit = 24) {
  const text = projects.flatMap((p) => p.transcript?.segments.map((s) => s.text) ?? []).join(" ");
  return keywords(text, limit);
}
