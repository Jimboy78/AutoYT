// Archivo de utilidades de API. Sin React, sin "use client".
// Exporta funciones puras para que el hook las consuma.

export interface InitUploadRequest {
  filename: string;
  size: number;
  contentType: string;
}

export interface InitUploadResponse {
  uploadId: string;
  url: string; // URL firmada/presignada o endpoint de subida
}

// Agregar el tipo Clip exportado para useClips.ts
export interface Clip {
  id: string;
  start: number;
  end: number;
  thumbnail_url?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";
// Si usás Next con route handlers (app/api/*), podés dejar BASE vacío
// y pegarle a rutas relativas tipo "/api/upload/init".
// Si tenés backend externo, seteá NEXT_PUBLIC_API_BASE.

// Helper para fetch JSON con manejo de errores consistente
async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
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

// 1) Inicializa subida y devuelve uploadId + URL de subida
export async function initUpload(
  body: InitUploadRequest
): Promise<InitUploadResponse> {
  return jsonFetch<InitUploadResponse>("/api/upload/init", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 2) Confirma la subida (el backend crea/atacha el recurso) y devuelve videoId
export async function confirmUpload(
  uploadId: string
): Promise<{ videoId: string }> {
  return jsonFetch<{ videoId: string }>("/api/upload/confirm", {
    method: "POST",
    body: JSON.stringify({ uploadId }),
  });
}

// 3) Dispara el procesamiento del video y devuelve taskId
export async function processVideo(videoId: string): Promise<string> {
  const data = await jsonFetch<{
    taskId?: string;
    id?: string;
    task?: { id?: string };
  }>(`/api/video/${encodeURIComponent(videoId)}/process`, {
    method: "POST",
  });
  const taskId = data.taskId ?? data.id ?? data.task?.id;
  if (!taskId) throw new Error("La API no devolvió taskId");
  return taskId;
}

/**
 * (Opcional) Subir usando fetch en vez de XHR.
 * El hook actual usa XHR para progreso; dejá esto por si lo necesitás server-side o sin progreso.
 */
export async function uploadToBackend(
  url: string,
  file: Blob | File,
  opts?: { method?: string; headers?: Record<string, string> }
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

// Exportar listClips para useClips.ts
export async function listClips(
  videoId: string,
  opts?: { signal?: AbortSignal }
): Promise<Clip[]> {
  return jsonFetch<Clip[]>(`/api/video/${encodeURIComponent(videoId)}/clips`, {
    method: "GET",
    signal: opts?.signal,
  });
}
