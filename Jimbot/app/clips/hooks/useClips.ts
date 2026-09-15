"use client";

import { useState, useMemo, useEffect } from "react";
import { listClips as apiListClips, type Clip as ApiClip } from "@/lib/api";

export interface Clip {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  type: "gameplay" | "reaction" | "highlight" | "funny";
  tags: string[];
  createdAt: Date;
  views?: number;
  rating?: number;
}

const clips: Clip[] = [
  {
    id: "1",
    title: "Epic Headshot Moment",
    duration: 15,
    thumbnail: "/placeholder.svg?height=180&width=320",
    type: "gameplay",
    tags: ["FPS", "Headshot", "Epic"],
    createdAt: new Date("2024-01-15"),
    views: 1250,
    rating: 4.8,
  },
  {
    id: "2",
    title: "Funny Reaction to Jump Scare",
    duration: 8,
    thumbnail: "/placeholder.svg?height=180&width=320",
    type: "reaction",
    tags: ["Horror", "Funny", "Jump Scare"],
    createdAt: new Date("2024-01-14"),
    views: 890,
    rating: 4.5,
  },
  {
    id: "3",
    title: "Clutch 1v5 Victory",
    duration: 45,
    thumbnail: "/placeholder.svg?height=180&width=320",
    type: "highlight",
    tags: ["Clutch", "Victory", "Skill"],
    createdAt: new Date("2024-01-13"),
    views: 2100,
    rating: 4.9,
  },
  {
    id: "4",
    title: "Chat Roasting Streamer",
    duration: 22,
    thumbnail: "/placeholder.svg?height=180&width=320",
    type: "funny",
    tags: ["Chat", "Roast", "Comedy"],
    createdAt: new Date("2024-01-12"),
    views: 1560,
    rating: 4.3,
  },
  {
    id: "5",
    title: "Perfect Speedrun Split",
    duration: 30,
    thumbnail: "/placeholder.svg?height=180&width=320",
    type: "gameplay",
    tags: ["Speedrun", "Perfect", "Record"],
    createdAt: new Date("2024-01-11"),
    views: 3200,
    rating: 4.7,
  },
  {
    id: "6",
    title: "Emotional Story Reaction",
    duration: 60,
    thumbnail: "/placeholder.svg?height=180&width=320",
    type: "reaction",
    tags: ["Emotional", "Story", "Tears"],
    createdAt: new Date("2024-01-10"),
    views: 980,
    rating: 4.6,
  },
];

export const typeColors: Record<Clip["type"], string> = {
  gameplay: "bg-blue-500",
  reaction: "bg-purple-500",
  highlight: "bg-yellow-500",
  funny: "bg-green-500",
};

export const typeLabels: Record<Clip["type"], string> = {
  gameplay: "Gameplay",
  reaction: "Reacción",
  highlight: "Highlight",
  funny: "Divertido",
};

export function useClips() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<Clip["type"] | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "views" | "rating">("recent");
  const [remoteClips, setRemoteClips] = useState<ApiClip[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : undefined;
  const videoId = search?.get("videoId") || "";

  useEffect(() => {
    let cancelled = false;
    let ctrl: AbortController | null = null;

    const load = async () => {
      if (!videoId) {
        ctrl?.abort();
        if (!cancelled) {
          setIsLoading(false);
          setError(null);
          setRemoteClips(null);
        }
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        // cancelar petición previa si aún vive
        ctrl?.abort();
        ctrl = new AbortController();
        const data = await apiListClips(videoId, { signal: ctrl.signal });
        if (cancelled) return;
        setRemoteClips(data);
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;
        setRemoteClips(null);
        setError("No se pudieron cargar los clips.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    const i = setInterval(load, 3000);
    return () => {
      cancelled = true;
      ctrl?.abort();
      clearInterval(i);
    };
  }, [videoId]);

  const baseClips = useMemo(() => {
    if (remoteClips && remoteClips.length > 0) {
      return remoteClips.map((c) => ({
        id: c.id,
        title: `Clip ${Math.round(c.start)}s-${Math.round(c.end)}s`,
        duration: Math.max(1, Math.round(c.end - c.start)),
        thumbnail: c.thumbnail_url || "/placeholder.svg?height=180&width=320",
        type: "highlight" as const,
        tags: ["auto", "mvp"],
        createdAt: new Date(),
        views: undefined,
        rating: undefined,
      }));
    }
    return clips;
  }, [remoteClips]);

  const filteredClips = useMemo(() => {
    return baseClips
      .filter((clip) => {
        const matchesSearch =
          clip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          clip.tags.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          );
        const matchesType = !selectedType || clip.type === selectedType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "views":
            return (b.views || 0) - (a.views || 0);
          case "rating":
            return (b.rating || 0) - (a.rating || 0);
          default:
            return b.createdAt.getTime() - a.createdAt.getTime();
        }
      });
  }, [baseClips, searchTerm, selectedType, sortBy]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
  };

  const formatViews = (views: number) => {
    return views >= 1000 ? `${(views / 1000).toFixed(1)}k` : `${views}`;
  };

  return {
    clips: baseClips,
    filteredClips,
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    formatDuration,
    formatViews,
    typeColors,
    typeLabels,
    isLoading,
    error,
  };
}
