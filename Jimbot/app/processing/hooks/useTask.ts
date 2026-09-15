"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTaskStatus, type TaskStatus } from "@/lib/api";

export function useTask(taskId?: string, intervalMs = 2000) {
  const [data, setData] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!taskId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchOnce = async () => {
      try {
        setIsLoading(true);
        setError(null);
        controllerRef.current?.abort();
        controllerRef.current = new AbortController();
        const res = await getTaskStatus(taskId, {
          signal: controllerRef.current.signal,
        });
        if (cancelled) return;
        setData(res);
        if (res.status === "done" || res.status === "error") {
          if (timer) clearInterval(timer);
          timer = null;
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Error al consultar la tarea");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // primera llamada inmediata
    fetchOnce();
    // polling
    timer = setInterval(fetchOnce, intervalMs);

    return () => {
      cancelled = true;
      controllerRef.current?.abort();
      if (timer) clearInterval(timer);
    };
  }, [taskId, intervalMs]);

  const isDone = useMemo(() => data?.status === "done", [data]);
  const isError = useMemo(
    () => data?.status === "error" || !!error,
    [data, error]
  );

  return {
    data,
    isLoading,
    error,
    isDone,
    isError,
    progress: data?.progress ?? 0,
    status: data?.status ?? "queued",
  };
}
