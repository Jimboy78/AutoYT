// Local project library: every analyzed video, its analysis, transcript and rendered outputs live in
// IndexedDB so each tool in the app works on the same real material, across reloads and tabs.

import type { Highlight } from "../studio/analyze";
import { idbAll, idbDelete, idbGet, idbPut } from "./db";

export interface ProjectThumb {
  time: number;
  score: number;
  highlightId?: number;
  dataUrl: string;
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

export interface Transcript {
  language: string;
  model: string;
  task: "transcribe" | "translate";
  segments: TranscriptSegment[];
  createdAt: number;
  elapsedMs: number;
}

export interface PublishDraft {
  title: string;
  description: string;
  tags: string[];
  thumbTime?: number;
}

export interface Project {
  id: string;
  name: string;
  mime: string;
  size: number;
  lastModified: number;
  createdAt: number;
  updatedAt: number;
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  /** RMS level per 50 ms window, kept so any page can re-run detection with other settings. */
  db: Float32Array;
  waveform: Float32Array;
  sensitivity: number;
  presetId: string;
  highlights: Highlight[];
  chapters: { time: number; title: string }[];
  thumbs: ProjectThumb[];
  poster?: string;
  transcript?: Transcript;
  publish?: PublishDraft;
}

export type RenderKind = "short" | "conversion" | "montage" | "audio" | "thumbnail";

export interface Render {
  id: string;
  projectId: string | null;
  kind: RenderKind;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  duration?: number;
  width?: number;
  height?: number;
  settings?: Record<string, unknown>;
}

// ---------- change notifications (same tab + other tabs) ----------

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function ensureChannel() {
  if (channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  channel = new BroadcastChannel("autoyt-library");
  channel.onmessage = () => listeners.forEach((l) => l());
}

function notify() {
  listeners.forEach((l) => l());
  channel?.postMessage("changed");
}

export function subscribeLibrary(listener: () => void) {
  ensureChannel();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

// ---------- projects ----------

/** Stable id per file, so analyzing the same video again updates its project instead of duplicating it. */
export function projectIdFor(file: { name: string; size: number; lastModified: number }) {
  const key = `${file.name}|${file.size}|${file.lastModified}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    h1 = Math.imul(h1 ^ key.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 + key.charCodeAt(i), 2654435761);
  }
  return `p_${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

export async function listProjects() {
  const all = await idbAll<Project>("projects");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const getProject = (id: string) => idbGet<Project>("projects", id);
export const getProjectFile = (id: string) => idbGet<Blob>("files", id);

export async function saveProject(project: Project, file?: Blob) {
  if (file) await idbPut("files", project.id, file);
  await idbPut("projects", project.id, project);
  notify();
  return project;
}

export async function updateProject(id: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) {
  const current = await getProject(id);
  if (!current) return undefined;
  const next: Project = { ...current, ...(typeof patch === "function" ? patch(current) : patch), id, updatedAt: Date.now() };
  await idbPut("projects", id, next);
  notify();
  return next;
}

export async function deleteProject(id: string) {
  for (const r of await listRenders(id)) await removeRender(r.id);
  await idbDelete("files", id);
  await idbDelete("projects", id);
  notify();
}

export async function projectAsFile(project: Project) {
  const blob = await getProjectFile(project.id);
  if (!blob) throw new Error("El archivo original ya no está en la biblioteca.");
  return new File([blob], project.name, { type: project.mime, lastModified: project.lastModified });
}

// ---------- renders ----------

export async function listRenders(projectId?: string | null) {
  const all = await idbAll<Render>("renders");
  return all.filter((r) => projectId === undefined || r.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
}

export const getRenderFile = (id: string) => idbGet<Blob>("renderFiles", id);

export async function saveRender(meta: Omit<Render, "id" | "createdAt" | "size">, blob: Blob) {
  const render: Render = { ...meta, id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now(), size: blob.size };
  await idbPut("renderFiles", render.id, blob);
  await idbPut("renders", render.id, render);
  notify();
  return render;
}

async function removeRender(id: string) {
  await idbDelete("renderFiles", id);
  await idbDelete("renders", id);
}

export async function deleteRender(id: string) {
  await removeRender(id);
  notify();
}

export async function storageEstimate() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
