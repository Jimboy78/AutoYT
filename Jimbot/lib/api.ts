// Archivo de utilidades de API. Sin React, sin "use client".
// Cliente del router legacy del backend FastAPI (`/api/v1/legacy/*`).

const BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";
// Seteá NEXT_PUBLIC_API_BASE (ej. http://localhost:8000) para apuntar al backend.
const LEGACY = "/api/v1/legacy";

export const API_CONFIGURED = BASE !== "";

/** Backend returns media as "/uploads/…"; make it absolute against the API origin. */
export const apiAsset = (url?: string | null) => (!url ? "" : url.startsWith("http") ? url : `${BASE}${url}`);

// ---------- Tipos (espejo de backend/app/schemas/legacy.py) ----------

export interface Video {
  id: string;
  filename: string;
  status: string;
  url: string;
  duration?: number | null;
}

export interface Clip {
  id: string;
  video_id?: string;
  start: number;
  end: number;
  url?: string;
  thumbnail_url?: string | null;
}

export type JobType = "transcoding" | "clipping" | "thumbnails" | "upload";
export type JobStatus = "pending" | "processing" | "completed" | "error";

export interface Job {
  id: string;
  video_id: string;
  name: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  error?: string | null;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
  confidence: number;
}

export interface Transcription {
  id: string;
  video_id: string;
  language: string;
  status: JobStatus;
  segments: Segment[];
}

export interface InitUploadRequest {
  filename: string;
  size: number;
  contentType: string;
}

export interface InitUploadResponse {
  uploadId: string;
  url: string; // URL firmada/presignada o endpoint de subida
}

// Estado normalizado de un job para el polling de /processing.
export interface TaskStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: number; // 0..100
  message?: string | null;
}

// ---------- Helpers ----------

function apiUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${BASE}${LEGACY}${path}`;
}

// Helper para fetch JSON con manejo de errores consistente
async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${url} → ${res.status} ${msg}`);
  }
  // 204 No Content
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

const id = (value: string) => encodeURIComponent(value);

// ---------- Upload ----------

// 1) Inicializa subida y devuelve uploadId + URL de subida
export async function initUpload(body: InitUploadRequest): Promise<InitUploadResponse> {
  const out = await jsonFetch<InitUploadResponse>("/upload/init", {
    method: "POST",
    body: JSON.stringify(body),
  });
  // El backend puede devolver una ruta relativa para el PUT directo.
  return { ...out, url: out.url.startsWith("http") ? out.url : `${BASE}${out.url}` };
}

// 2) Confirma la subida (el backend crea/atacha el recurso) y devuelve videoId
export async function confirmUpload(uploadId: string): Promise<{ videoId: string }> {
  return jsonFetch<{ videoId: string }>("/upload/confirm", {
    method: "POST",
    body: JSON.stringify({ uploadId }),
  });
}

// 3) Dispara el procesamiento del video y devuelve el id del primer job
export async function processVideo(videoId: string): Promise<string> {
  const data = await jsonFetch<{ jobIds?: string[]; taskId?: string }>(`/videos/${id(videoId)}/process`, {
    method: "POST",
  });
  const taskId = data.jobIds?.[0] ?? data.taskId;
  if (!taskId) throw new Error("La API no devolvió jobIds");
  return taskId;
}

// ---------- Videos / clips ----------

export function listVideos(): Promise<Video[]> {
  return jsonFetch<Video[]>("/videos");
}

export function getVideo(videoId: string): Promise<Video> {
  return jsonFetch<Video>(`/videos/${id(videoId)}`);
}

export function listClips(videoId: string, opts?: { signal?: AbortSignal }): Promise<Clip[]> {
  return jsonFetch<Clip[]>(`/videos/${id(videoId)}/clips`, { signal: opts?.signal });
}

// ---------- Jobs ----------

export function listJobs(): Promise<Job[]> {
  return jsonFetch<Job[]>("/jobs");
}

const JOB_STATE: Record<string, TaskStatus["status"]> = {
  queued: "queued",
  pending: "queued",
  running: "running",
  processing: "running",
  success: "done",
  done: "done",
  completed: "done",
  failed: "error",
  error: "error",
};

export async function getTaskStatus(taskId: string, opts?: { signal?: AbortSignal }): Promise<TaskStatus> {
  const job = await jsonFetch<Partial<Job> & { id: string; state?: string; message?: string | null }>(
    `/jobs/${id(taskId)}`,
    { signal: opts?.signal },
  );
  const status = JOB_STATE[(job.status ?? job.state ?? "pending").toLowerCase()] ?? "queued";
  return {
    id: String(job.id),
    status,
    progress: job.progress ?? (status === "done" ? 100 : 0),
    message: job.error ?? job.message,
  };
}

// ---------- Transcriptions ----------

export function createTranscription(videoId: string, language = "es"): Promise<Transcription> {
  return jsonFetch<Transcription>(`/transcriptions/${id(videoId)}?language=${id(language)}`, { method: "POST" });
}

export function getTranscription(videoId: string): Promise<Transcription> {
  return jsonFetch<Transcription>(`/transcriptions/${id(videoId)}`);
}

async function downloadText(path: string, filename: string) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSRT(videoId: string) {
  return downloadText(`/transcriptions/${id(videoId)}/srt`, `${videoId}.srt`);
}

export function downloadVTT(videoId: string) {
  return downloadText(`/transcriptions/${id(videoId)}/vtt`, `${videoId}.vtt`);
}

/**
 * (Opcional) Subir usando fetch en vez de XHR.
 */
export async function uploadToBackend(
  url: string,
  file: Blob | File,
  opts?: { method?: string; headers?: Record<string, string> },
): Promise<Response> {
  const res = await fetch(url, {
    method: opts?.method ?? "PUT",
    headers: {
      "Content-Type": (file as File).type || "application/octet-stream",
      ...(opts?.headers ?? {}),
    },
    body: file,
  });
  if (!res.ok) throw new Error(`uploadToBackend → ${res.status}`);
  return res;
}
