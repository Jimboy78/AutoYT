// In-app task registry: long-running browser work (analysis, transcription, renders) reports real
// progress here so the Procesamiento page can monitor it. History persists in localStorage.

import { useSyncExternalStore } from "react";

export type TaskKind = "analysis" | "transcription" | "short" | "conversion" | "montage" | "thumbnail";
export type TaskStatus = "running" | "done" | "error" | "cancelled";

export interface TaskRecord {
  id: string;
  kind: TaskKind;
  title: string;
  projectId?: string | null;
  status: TaskStatus;
  /** 0..1 */
  progress: number;
  stage?: string;
  detail?: string;
  result?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

const KEY = "autoyt.tasks.v1";
const MAX = 40;
const EMPTY: TaskRecord[] = [];

let tasks: TaskRecord[] | null = null;
const listeners = new Set<() => void>();
const cancels = new Map<string, () => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function load(): TaskRecord[] {
  if (tasks) return tasks;
  tasks = [];
  if (typeof window === "undefined") return tasks;
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as TaskRecord[];
    // Work can't survive a reload: anything still "running" was interrupted.
    tasks = stored.map((t) =>
      t.status === "running" ? { ...t, status: "error", error: "Interrumpida al recargar la página", endedAt: t.endedAt ?? Date.now() } : t,
    );
  } catch {
    tasks = [];
  }
  return tasks;
}

function persist(immediate = false) {
  const write = () => {
    persistTimer = null;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(load().slice(0, MAX)));
    } catch {
      // History is best-effort.
    }
  };
  if (immediate) {
    if (persistTimer) clearTimeout(persistTimer);
    write();
  } else if (!persistTimer) {
    persistTimer = setTimeout(write, 1000);
  }
}

function set(next: TaskRecord[], immediate = false) {
  tasks = next.slice(0, MAX);
  listeners.forEach((l) => l());
  persist(immediate);
}

function patch(id: string, change: Partial<TaskRecord>, immediate = false) {
  set(
    load().map((t) => (t.id === id ? { ...t, ...change } : t)),
    immediate,
  );
}

export interface TaskHandle {
  id: string;
  update: (change: Pick<Partial<TaskRecord>, "progress" | "stage" | "detail" | "projectId">) => void;
  done: (result?: string) => void;
  fail: (error: unknown) => void;
  cancelled: () => void;
}

export function startTask(init: { kind: TaskKind; title: string; projectId?: string | null; cancel?: () => void }): TaskHandle {
  const id = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const record: TaskRecord = { id, kind: init.kind, title: init.title, projectId: init.projectId, status: "running", progress: 0, startedAt: Date.now() };
  if (init.cancel) cancels.set(id, init.cancel);
  set([record, ...load()], true);
  const finish = (change: Partial<TaskRecord>) => {
    // First outcome wins: a late error from work that was already cancelled must not rewrite history.
    if (load().find((t) => t.id === id)?.status !== "running") return;
    cancels.delete(id);
    patch(id, { ...change, endedAt: Date.now() }, true);
  };
  return {
    id,
    update: (change) => patch(id, change),
    done: (result) => finish({ status: "done", progress: 1, result }),
    fail: (error) => finish({ status: "error", error: error instanceof Error ? error.message : String(error) }),
    cancelled: () => finish({ status: "cancelled" }),
  };
}

export const canCancel = (id: string) => cancels.has(id);

export function cancelTask(id: string) {
  cancels.get(id)?.();
}

export function clearFinishedTasks() {
  set(
    load().filter((t) => t.status === "running"),
    true,
  );
}

export function subscribeTasks(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useTasks() {
  return useSyncExternalStore(subscribeTasks, load, () => EMPTY);
}
