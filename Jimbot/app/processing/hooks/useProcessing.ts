"use client";

import { useState, useEffect, useCallback } from "react";
import { listJobs, type Job } from "@/lib/api";
import { useSearchParams } from "next/navigation";

export interface ProcessingTask {
  id: string;
  name: string;
  type: "transcoding" | "clipping" | "thumbnails" | "upload";
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  startTime: Date;
  estimatedTime?: number;
  error?: string;
}

const initialTasks: ProcessingTask[] = [
  {
    id: "1",
    name: "Video_gameplay_01.mp4",
    type: "transcoding",
    status: "completed",
    progress: 100,
    startTime: new Date(Date.now() - 300000),
  },
  {
    id: "2",
    name: "Video_gameplay_01.mp4",
    type: "clipping",
    status: "processing",
    progress: 65,
    startTime: new Date(Date.now() - 120000),
    estimatedTime: 180,
  },
  {
    id: "3",
    name: "Video_gameplay_01.mp4",
    type: "thumbnails",
    status: "pending",
    progress: 0,
    startTime: new Date(),
    estimatedTime: 60,
  },
  {
    id: "4",
    name: "Reaction_stream_05.mkv",
    type: "transcoding",
    status: "error",
    progress: 45,
    startTime: new Date(Date.now() - 600000),
    error: "Codec no soportado",
  },
];

export function useProcessing() {
  const [tasks, setTasks] = useState<ProcessingTask[]>(initialTasks);
  const [isPaused, setIsPaused] = useState(false);
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : undefined;
  const videoId = search?.get("videoId") || "";

  useEffect(() => {
    if (isPaused) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const jobs = await listJobs();
        if (cancelled) return;
        setTasks(
          jobs.map((j) => ({
            id: j.id,
            name: j.name,
            type: j.type,
            status: j.status,
            progress: j.progress,
            startTime: new Date(),
          }))
        );
      } catch {
        // Fallback: animación local de las tareas iniciales
        setTasks((prev) =>
          prev.map((task) => {
            if (task.status === "processing" && task.progress < 100) {
              const next = Math.min(task.progress + Math.random() * 5, 100);
              return {
                ...task,
                progress: next,
                status: next >= 100 ? "completed" : "processing",
              };
            }
            return task;
          })
        );
      }
    };
    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPaused]);

  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const getElapsedTime = useCallback((start: Date) => {
    return Math.floor((Date.now() - start.getTime()) / 1000);
  }, []);

  const retryTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: "processing", progress: 0, error: undefined }
          : t
      )
    );
  }, []);

  const pauseAll = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const overallProgress = (completedTasks / totalTasks) * 100;

  return {
    tasks,
    isPaused,
    pauseAll,
    retryTask,
    formatTime,
    getElapsedTime,
    completedTasks,
    totalTasks,
    overallProgress,
    videoId,
  };
}
