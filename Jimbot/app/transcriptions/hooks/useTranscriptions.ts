"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  createTranscription,
  getTranscription,
  listVideos,
  type Segment as ApiSegment,
  type Video,
} from "@/lib/api";

export interface TranscriptionSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
  confidence: number;
  isEditing?: boolean;
}

export interface TranslationJob {
  id: string;
  language: string;
  status: "pending" | "processing" | "completed";
  progress: number;
  segments?: TranscriptionSegment[];
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

const initialSegments: TranscriptionSegment[] = [];

const languages: LanguageOption[] = [
  { code: "en", name: "Inglés", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Francés", flag: "🇫🇷" },
  { code: "de", name: "Alemán", flag: "🇩🇪" },
  { code: "pt", name: "Portugués", flag: "🇧🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "ja", name: "Japonés", flag: "🇯🇵" },
  { code: "ko", name: "Coreano", flag: "🇰🇷" },
];

export function useTranscriptions() {
  const [segments, setSegments] =
    useState<TranscriptionSegment[]>(initialSegments);
  const [video, setVideo] = useState<Video | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [translations, setTranslations] = useState<TranslationJob[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await listVideos();
        setVideos(list);
        setVideo(list[0] ?? null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!video) return;
    (async () => {
      try {
        const tr = await getTranscription(video.id);
        setSegments(
          tr.segments.map((s: ApiSegment) => ({
            id: s.id,
            startTime: s.start,
            endTime: s.end,
            text: s.text,
            speaker: s.speaker ?? undefined,
            confidence: s.confidence,
          }))
        );
      } catch {
        // si no existe, crearlo
        const tr = await createTranscription(video.id, "es");
        setSegments([]);
      }
    })();
  }, [video?.id]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }, []);

  const editSegment = useCallback((id: string, newText: string) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, text: newText, isEditing: false } : s
      )
    );
  }, []);

  const toggleEdit = useCallback((id: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isEditing: !s.isEditing } : s))
    );
  }, []);

  const jumpToTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const exportSRT = useCallback(() => {
    let srt = "";
    segments.forEach((seg, i) => {
      const start = formatTime(seg.startTime).replace(".", ",");
      const end = formatTime(seg.endTime).replace(".", ",");
      srt += `${i + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
    });
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitulos.srt";
    a.click();
  }, [segments, formatTime]);

  const startTranslation = useCallback(
    (languageCode: string) => {
      if (!video) return;
      const newJob: TranslationJob = {
        id: `${languageCode}-${Date.now()}`,
        language: languageCode,
        status: "pending",
        progress: 0,
      };
      setTranslations((prev) => [...prev, newJob]);

      setTimeout(() => {
        setTranslations((prev) =>
          prev.map((t) =>
            t.id === newJob.id ? { ...t, status: "processing" } : t
          )
        );
        const interval = setInterval(() => {
          setTranslations((prev) =>
            prev.map((t) => {
              if (t.id === newJob.id && t.status === "processing") {
                const p = Math.min(t.progress + Math.random() * 15, 100);
                if (p >= 100) {
                  clearInterval(interval);
                  return {
                    ...t,
                    progress: 100,
                    status: "completed",
                    segments: segments.map((s) => ({
                      ...s,
                      text: `[${
                        languages.find((l) => l.code === languageCode)?.name
                      }] ${s.text}`,
                    })),
                  };
                }
                return { ...t, progress: p };
              }
              return t;
            })
          );
        }, 300);
      }, 1000);
    },
    [segments, video]
  );

  const filteredSegments = useMemo(
    () =>
      segments.filter(
        (s) =>
          s.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.speaker?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [segments, searchTerm]
  );

  const totalDuration = useMemo(
    () => Math.max(...segments.map((s) => s.endTime)),
    [segments]
  );

  const averageConfidence = useMemo(
    () => segments.reduce((acc, s) => acc + s.confidence, 0) / segments.length,
    [segments]
  );

  return {
    segments,
    video,
    videos,
    currentTime,
    isPlaying,
    searchTerm,
    translations,
    languages,
    filteredSegments,
    totalDuration,
    averageConfidence,
    setIsPlaying,
    setSearchTerm,
    setVideo,
    editSegment,
    toggleEdit,
    jumpToTime,
    exportSRT,
    startTranslation,
  };
}
