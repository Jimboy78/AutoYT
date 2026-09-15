// Transcription runs as a module-level job so it keeps going while you navigate the app.

import { useSyncExternalStore } from "react";
import { getProject, getProjectFile, updateProject, type Transcript, type TranscriptSegment } from "../library";
import { HOP } from "../studio/analyze";
import { startTask, type TaskHandle } from "../tasks";
import { SAMPLE_RATE, speechWindows, toSegments } from "./format";
import type { RunMessage, WorkerEvent } from "./whisper.worker";

export const WHISPER_MODELS = [
  { id: "Xenova/whisper-tiny", label: "Tiny", size: "≈ 41 MB", hint: "El más rápido" },
  { id: "Xenova/whisper-base", label: "Base", size: "≈ 77 MB", hint: "Equilibrado" },
  { id: "Xenova/whisper-small", label: "Small", size: "≈ 250 MB", hint: "Más preciso, más lento" },
] as const;

export const LANGUAGES = [
  { code: "auto", label: "Detectar" },
  { code: "es", label: "Español" },
  { code: "en", label: "Inglés" },
  { code: "pt", label: "Portugués" },
  { code: "fr", label: "Francés" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Alemán" },
] as const;

export type TranscribeStage = "decoding" | "loading" | "transcribing" | "done" | "error" | "cancelled";

export interface TranscribeState {
  projectId: string;
  model: string;
  stage: TranscribeStage;
  download: { loaded: number; total: number };
  windowIndex: number;
  windowTotal: number;
  /** Seconds of audio already transcribed. */
  covered: number;
  segments: TranscriptSegment[];
  startedAt: number;
  error?: string;
}

let state: TranscribeState | null = null;
let worker: Worker | null = null;
let task: TaskHandle | null = null;
const listeners = new Set<() => void>();

function setState(next: TranscribeState | null) {
  state = next;
  listeners.forEach((l) => l());
}

const patch = (change: Partial<TranscribeState>) => state && setState({ ...state, ...change });

export const isTranscribing = () => !!state && ["decoding", "loading", "transcribing"].includes(state.stage);

export function useTranscribeState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => state,
    () => null,
  );
}

/** Decode any audio/video blob to 16 kHz mono, the input Whisper expects. */
async function decodeTo16k(blob: Blob) {
  const ctx = new AudioContext();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error("No encontramos una pista de audio legible en el archivo.");
  } finally {
    void ctx.close();
  }
  const offline = new OfflineAudioContext(1, Math.ceil(buffer.duration * SAMPLE_RATE), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

function stopWorker() {
  worker?.terminate();
  worker = null;
}

export function cancelTranscription() {
  if (!isTranscribing()) return;
  stopWorker();
  patch({ stage: "cancelled" });
  task?.cancelled();
  task = null;
}

export async function startTranscription(projectId: string, opts: { model: string; language: string; task: "transcribe" | "translate" }) {
  if (isTranscribing()) throw new Error("Ya hay una transcripción en curso.");
  const project = await getProject(projectId);
  if (!project) throw new Error("Proyecto no encontrado.");

  const startedAt = Date.now();
  setState({ projectId, model: opts.model, stage: "decoding", download: { loaded: 0, total: 0 }, windowIndex: 0, windowTotal: 0, covered: 0, segments: [], startedAt });
  task = startTask({ kind: "transcription", title: `Transcripción · ${project.name}`, projectId, cancel: cancelTranscription });
  task.update({ stage: "Decodificando audio a 16 kHz" });
  const current = task;

  const fail = (err: unknown) => {
    stopWorker();
    const message = err instanceof Error ? err.message : String(err);
    patch({ stage: "error", error: message });
    current.fail(message);
    if (task === current) task = null;
  };

  try {
    const file = await getProjectFile(projectId);
    if (!file) throw new Error("El archivo original no está en la biblioteca.");
    const audio = await decodeTo16k(file);
    if (state?.stage === "cancelled") return;
    const windows = speechWindows(project.db, HOP, project.duration);
    patch({ stage: "loading", windowTotal: windows.length });
    current.update({ stage: "Cargando modelo Whisper", progress: 0.02 });

    const downloads = new Map<string, { loaded: number; total: number }>();
    const segments: TranscriptSegment[] = [];
    worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onerror = (e) => fail(new Error(e.message || "El worker de Whisper falló."));
    worker.onmessage = async (e: MessageEvent<WorkerEvent>) => {
      const event = e.data;
      if (event.type === "download") {
        downloads.set(event.file, { loaded: event.loaded, total: event.total });
        let loaded = 0;
        let total = 0;
        downloads.forEach((d) => {
          loaded += d.loaded;
          total += d.total;
        });
        patch({ download: { loaded, total } });
      } else if (event.type === "ready") {
        patch({ stage: "transcribing" });
        current.update({ stage: `Transcribiendo (${windows.length} ventanas)` });
      } else if (event.type === "window") {
        if (process.env.NODE_ENV !== "production") console.debug("[whisper] window", event.index, windows[event.index], JSON.stringify(event.chunks));
        segments.push(...toSegments(event.chunks, event.end));
        patch({ windowIndex: event.index + 1, covered: event.end, segments: [...segments] });
        current.update({ progress: 0.05 + 0.95 * ((event.index + 1) / event.total), detail: `${Math.round(event.end)} de ${Math.round(project.duration)} s` });
      } else if (event.type === "done") {
        stopWorker();
        const transcript: Transcript = {
          language: opts.language,
          model: opts.model,
          task: opts.task,
          segments,
          createdAt: Date.now(),
          elapsedMs: Date.now() - startedAt,
        };
        await updateProject(projectId, { transcript });
        patch({ stage: "done" });
        current.done(`${segments.length} segmentos en ${Math.round(transcript.elapsedMs / 1000)} s`);
        if (task === current) task = null;
      } else if (event.type === "error") {
        fail(new Error(event.message));
      }
    };
    const message: RunMessage = { type: "run", model: opts.model, audio, windows, language: opts.language === "auto" ? null : opts.language, task: opts.task };
    worker.postMessage(message, [audio.buffer]);
  } catch (err) {
    fail(err);
  }
}
