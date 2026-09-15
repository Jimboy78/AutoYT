"use client";

import { useState, useCallback, useMemo } from "react";
import type { ComponentType } from "react";
import { Monitor, Smartphone, Square } from "lucide-react";

export interface AspectRatio {
  id: string;
  name: string;
  ratio: string;
  width: number;
  height: number;
  icon: ComponentType<any>;
  description: string;
  platforms: string[];
}

export interface ConversionJob {
  id: string;
  aspectRatio: AspectRatio;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  outputUrl?: string;
}

const aspectRatios: AspectRatio[] = [
  {
    id: "16:9",
    name: "Horizontal",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    icon: Monitor,
    description: "Formato estándar para YouTube, Twitch",
    platforms: ["YouTube", "Twitch", "Facebook"],
  },
  {
    id: "9:16",
    name: "Vertical",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    icon: Smartphone,
    description: "Perfecto para TikTok, Instagram Stories",
    platforms: ["TikTok", "Instagram", "YouTube Shorts"],
  },
  {
    id: "1:1",
    name: "Cuadrado",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    icon: Square,
    description: "Ideal para Instagram posts",
    platforms: ["Instagram", "Twitter", "LinkedIn"],
  },
  {
    id: "4:3",
    name: "Clásico",
    ratio: "4:3",
    width: 1024,
    height: 768,
    icon: Monitor,
    description: "Formato tradicional de TV",
    platforms: ["TV", "Presentaciones"],
  },
];

export function useConversion() {
  const [selectedRatios, setSelectedRatios] = useState<string[]>([]);
  const [conversionJobs, setConversionJobs] = useState<ConversionJob[]>([]);
  const [generateMultiple, setGenerateMultiple] = useState(false);
  const [previewRatio, setPreviewRatio] = useState<string>("16:9");

  const toggleRatio = useCallback((ratioId: string) => {
    setSelectedRatios((prev) =>
      prev.includes(ratioId)
        ? prev.filter((id) => id !== ratioId)
        : [...prev, ratioId]
    );
  }, []);

  const startConversion = useCallback(() => {
    const newJobs: ConversionJob[] = selectedRatios.map((ratioId) => ({
      id: `${ratioId}-${Date.now()}`,
      aspectRatio: aspectRatios.find((r) => r.id === ratioId)!,
      status: "pending",
      progress: 0,
    }));
    setConversionJobs(newJobs);

    newJobs.forEach((job, idx) => {
      setTimeout(() => {
        setConversionJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: "processing" } : j
          )
        );
        const interval = setInterval(() => {
          setConversionJobs((prev) =>
            prev.map((j) => {
              if (j.id === job.id && j.status === "processing") {
                const next = Math.min(j.progress + Math.random() * 10, 100);
                if (next >= 100) {
                  clearInterval(interval);
                  return {
                    ...j,
                    progress: 100,
                    status: "completed",
                    outputUrl: `/converted/${j.aspectRatio.id}_video.mp4`,
                  };
                }
                return { ...j, progress: next };
              }
              return j;
            })
          );
        }, 300);
      }, idx * 1000);
    });
  }, [selectedRatios]);

  const previewAspectRatio = useMemo(
    () => aspectRatios.find((r) => r.id === previewRatio)!,
    [previewRatio]
  );

  return {
    aspectRatios,
    selectedRatios,
    conversionJobs,
    generateMultiple,
    previewRatio,
    previewAspectRatio,
    toggleRatio,
    startConversion,
    setGenerateMultiple,
    setPreviewRatio,
  };
}
