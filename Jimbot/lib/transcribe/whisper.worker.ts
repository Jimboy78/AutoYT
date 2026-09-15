// Whisper speech recognition off the main thread (transformers.js + ONNX Runtime Web).

import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { speechActivity, speechSpan, tightenChunk, type RawChunk } from "./format";

env.allowLocalModels = false;

export interface RunMessage {
  type: "run";
  model: string;
  audio: Float32Array;
  windows: { start: number; end: number }[];
  language: string | null;
  task: "transcribe" | "translate";
}

export type WorkerEvent =
  | { type: "download"; file: string; loaded: number; total: number }
  | { type: "ready"; device: string }
  | { type: "window"; index: number; total: number; end: number; chunks: RawChunk[] }
  | { type: "done" }
  | { type: "error"; message: string };

const SAMPLE_RATE = 16000;
const post = (event: WorkerEvent) => (self as unknown as Worker).postMessage(event);

// pipeline()'s overloads are too large for tsc to resolve (TS2590); pin the one signature we use.
const createPipeline = pipeline as unknown as (task: string, model: string, options: object) => Promise<AutomaticSpeechRecognitionPipeline>;

let cached: { model: string; pipe: Promise<AutomaticSpeechRecognitionPipeline> } | null = null;

function load(model: string) {
  if (cached?.model !== model) {
    cached = {
      model,
      pipe: createPipeline("automatic-speech-recognition", model, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === "progress" && p.file) post({ type: "download", file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
        },
      }),
    };
  }
  return cached.pipe;
}

self.onmessage = async (e: MessageEvent<RunMessage>) => {
  const msg = e.data;
  if (msg.type !== "run") return;
  try {
    const asr = await load(msg.model);
    post({ type: "ready", device: "wasm" });
    const activity = speechActivity(msg.audio, SAMPLE_RATE);
    const queue = msg.windows.map((w) => ({ ...w, retry: false }));
    let index = 0;

    while (queue.length) {
      const w = queue.shift()!;
      const audio = msg.audio.subarray(Math.floor(w.start * SAMPLE_RATE), Math.min(msg.audio.length, Math.ceil(w.end * SAMPLE_RATE)));
      const output = await asr(audio, {
        return_timestamps: true,
        chunk_length_s: 30,
        ...(msg.language ? { language: msg.language } : {}),
        task: msg.task,
      });
      const result = (Array.isArray(output) ? output[0] : output) as { text: string; chunks?: { text: string; timestamp: [number | null, number | null] }[] };
      const raw = result.chunks?.length ? result.chunks : result.text.trim() ? [{ text: result.text, timestamp: [0, w.end - w.start] as [number, number] }] : [];
      const chunks = raw.map((c) =>
        tightenChunk({ text: c.text, start: w.start + (c.timestamp[0] ?? 0), end: c.timestamp[1] == null ? null : w.start + c.timestamp[1] }, activity, w.end),
      );

      // Whisper sometimes stops early after noise; if voice remains after the last phrase, transcribe the tail.
      const heard = chunks.reduce((acc, c) => Math.max(acc, c.end ?? c.start), w.start);
      if (!w.retry && w.end - heard > 1.5 && speechSpan(activity, heard + 0.2, w.end).seconds >= 0.5) {
        queue.unshift({ start: heard + 0.1, end: w.end, retry: true });
      }

      post({ type: "window", index, total: index + 1 + queue.length, end: queue[0]?.retry ? queue[0].start : w.end, chunks });
      index++;
    }
    post({ type: "done" });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
