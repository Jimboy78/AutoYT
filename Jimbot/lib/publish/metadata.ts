// YouTube publish package built from the project's real material: transcript keywords, moments and chapters.
// Limits follow YouTube's rules (title 100, description 5000, tags 500 chars, no angle brackets, chapter rules).

import type { Project } from "../library";
import { formatClock } from "../studio/format";
import { fold, keywords } from "../transcribe/format";

export const LIMITS = { title: 100, description: 5000, tags: 500 } as const;

export interface PublishMeta {
  title: string;
  description: string;
  tags: string[];
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function cleanName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function projectKeywords(project: Project, limit = 12) {
  const text = project.transcript?.segments.map((s) => s.text).join(" ") ?? "";
  const fromTranscript = keywords(text, limit).map((k) => k.word);
  const fromName = keywords(cleanName(project.name), limit).map((k) => k.word);
  const seen = new Set<string>();
  return [...fromTranscript, ...fromName].filter((w) => {
    const key = fold(w);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const minutes = (seconds: number) => (seconds < 90 ? `${Math.round(seconds)} segundos` : `${Math.round(seconds / 60)} minutos`);

export function titleIdeas(project: Project): string[] {
  const kw = projectKeywords(project);
  const name = cleanName(project.name);
  const n = project.highlights.length;
  const best = [...project.highlights].sort((a, b) => b.score - a.score)[0];
  const ideas = [
    kw[0] && n > 0 ? `${cap(kw[0])}: ${n} momentos que no te podés perder` : null,
    kw.length >= 3 ? `${cap(kw[0])}, ${kw[1]} y ${kw[2]} en ${minutes(project.duration)}` : null,
    `Lo mejor de ${name}${n ? ` en ${n} momentos` : ""}`,
    best ? `El momento más intenso de ${name} (${formatClock(best.peakTime)})` : null,
    kw[1] ? `¡${cap(kw[0])} y ${kw[1]}! Esto pasó en ${name} 😳` : `Esto pasó en ${name} 😳`,
  ];
  const seen = new Set<string>();
  return ideas
    .filter((t): t is string => !!t)
    .map((t) => t.replace(/[<>]/g, "").slice(0, LIMITS.title).trim())
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
}

export function tagsFor(project: Project): string[] {
  const out: string[] = [];
  let used = 0;
  for (const word of projectKeywords(project, 20)) {
    const tag = word.replace(/[<>,]/g, "").trim();
    if (!tag) continue;
    // YouTube counts the comma separators toward the 500-character budget.
    const cost = tag.length + (out.length ? 1 : 0);
    if (used + cost > LIMITS.tags) break;
    out.push(tag);
    used += cost;
  }
  return out;
}

export const hashtags = (tags: string[], count = 3) =>
  tags
    .slice(0, count)
    .map((t) => `#${fold(t).replace(/[^a-z0-9]+/g, "")}`)
    .filter((t) => t.length > 1);

export function summaryFor(project: Project, maxChars = 280) {
  const segments = project.transcript?.segments ?? [];
  let text = "";
  for (const s of segments) {
    const next = text ? `${text} ${s.text}` : s.text;
    if (next.length > maxChars) break;
    text = next;
  }
  return text;
}

export function descriptionFor(project: Project, title: string, tags: string[], opts: { chapters: boolean; summary: boolean; credit: boolean }) {
  const blocks: string[] = [title];
  const summary = opts.summary ? summaryFor(project) : "";
  if (summary) blocks.push(summary);
  if (opts.chapters && project.chapters.length) {
    blocks.push(["Capítulos", ...project.chapters.map((c) => `${formatClock(c.time)} ${c.title}`)].join("\n"));
  }
  const tagsLine = hashtags(tags).join(" ");
  if (tagsLine) blocks.push(tagsLine);
  if (opts.credit) blocks.push("Momentos, capítulos y subtítulos generados con AutoYT.");
  return blocks.join("\n\n").replace(/[<>]/g, "").slice(0, LIMITS.description);
}

export interface Check {
  id: string;
  ok: boolean;
  label: string;
}

/** YouTube chapters: first at 0:00, at least three, each at least 10 s long, in order. */
export function chapterIssues(description: string): string | null {
  const times = [...description.matchAll(/^(?:(\d+):)?(\d{1,2}):(\d{2})\s+\S/gm)].map((m) => Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  if (times.length === 0) return null;
  if (times[0] !== 0) return "El primer capítulo tiene que empezar en 0:00";
  if (times.length < 3) return "YouTube pide al menos 3 capítulos";
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 10) return "Cada capítulo tiene que durar 10 s o más";
  return null;
}

export function validate(meta: PublishMeta): Check[] {
  const tagChars = meta.tags.join(",").length;
  const chapters = chapterIssues(meta.description);
  return [
    { id: "title-length", ok: meta.title.trim().length > 0 && meta.title.length <= LIMITS.title, label: `Título de 1 a ${LIMITS.title} caracteres (${meta.title.length})` },
    { id: "title-brackets", ok: !/[<>]/.test(meta.title), label: "Sin < ni > en el título" },
    { id: "description-length", ok: meta.description.length <= LIMITS.description, label: `Descripción hasta ${LIMITS.description} caracteres (${meta.description.length})` },
    { id: "description-brackets", ok: !/[<>]/.test(meta.description), label: "Sin < ni > en la descripción" },
    { id: "tags-length", ok: tagChars <= LIMITS.tags, label: `Etiquetas hasta ${LIMITS.tags} caracteres (${tagChars})` },
    { id: "chapters", ok: chapters === null, label: chapters ?? "Capítulos válidos para YouTube" },
    { id: "hook", ok: meta.title.length <= 70, label: "Título visible completo en móvil (≤ 70)" },
  ];
}

export function exportText(meta: PublishMeta) {
  return `TÍTULO\n${meta.title}\n\nDESCRIPCIÓN\n${meta.description}\n\nETIQUETAS\n${meta.tags.join(", ")}\n`;
}
