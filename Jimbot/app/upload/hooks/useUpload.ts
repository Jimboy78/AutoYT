"use client";

import { useCallback, useRef, useState } from "react";
import { confirmUpload, initUpload, processVideo } from "@/lib/api";

export type UploadStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "confirming"
  | "processing"
  | "done"
  | "error";

/**
 * Hook para manejar la subida de **un** archivo con progreso,
 * confirmación y posterior procesamiento en el backend.
 */
export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setUploadId(null);
    setVideoId(null);
    setTaskId(null);
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
      setStatus("idle");
    }
  }, []);

  const start = useCallback(async (file: File) => {
    try {
      setError(null);
      setStatus("preparing");
      setProgress(0);

      // 1) Pedimos URL firmada (o endpoint de subida) al backend
      const { uploadId, url } = await initUpload({
        filename: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });
      if (!url) throw new Error("La API no devolvió URL de subida");
      setUploadId(uploadId);

      // 2) Subimos el archivo con XHR para trackear progreso
      setStatus("uploading");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", url);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream"
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onerror = () => reject(new Error("Error de red durante la subida"));
        xhr.onabort = () => reject(new Error("Subida cancelada"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Error HTTP ${xhr.status} al subir archivo`));
        };
        xhr.send(file);
      });

      // 3) Confirmamos subida en el backend (crea/atacha recurso)
      setStatus("confirming");
      const { videoId } = await confirmUpload(uploadId);
      setVideoId(videoId);

      // 4) Disparamos el procesamiento y guardamos taskId
      setStatus("processing");
      const tId = await processVideo(videoId);
      setTaskId(tId);

      setStatus("done");
    } catch (e: any) {
      setError(e?.message || "Error en la subida");
      setStatus("error");
    } finally {
      xhrRef.current = null;
    }
  }, []);

  return {
    status,
    progress,
    error,
    uploadId,
    videoId,
    taskId,
    start,
    cancel,
    reset,
  };
}
