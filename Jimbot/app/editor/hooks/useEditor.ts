"use client";

import { useState, useMemo, useCallback } from "react";

export type ClipType = "video" | "transition" | "music";
export type TransitionType = "fade" | "slide" | "cut";

export interface TimelineClip {
  id: string;
  title: string;
  startTime: number;
  duration: number;
  type: ClipType;
  speed: number;
  transition?: TransitionType;
}

export interface MusicTrack {
  id: string;
  name: string;
  bpm: number;
  duration: number;
}

export const initialClips: TimelineClip[] = [
  {
    id: "1",
    title: "Epic Headshot",
    startTime: 0,
    duration: 15,
    type: "video",
    speed: 1,
    transition: "fade",
  },
  {
    id: "2",
    title: "Transition",
    startTime: 15,
    duration: 1,
    type: "transition",
    speed: 1,
    transition: "slide",
  },
  {
    id: "3",
    title: "Clutch Moment",
    startTime: 16,
    duration: 30,
    type: "video",
    speed: 1.2,
    transition: "cut",
  },
  {
    id: "4",
    title: "Funny Reaction",
    startTime: 46,
    duration: 12,
    type: "video",
    speed: 0.8,
    transition: "fade",
  },
];

export const musicTracks: MusicTrack[] = [
  { id: "1", name: "Epic Gaming Beat", bpm: 128, duration: 180 },
  { id: "2", name: "Chill Vibes", bpm: 90, duration: 200 },
  { id: "3", name: "Intense Action", bpm: 140, duration: 150 },
  { id: "4", name: "Emotional Journey", bpm: 75, duration: 240 },
];

export const transitionTypes: {
  id: TransitionType;
  name: string;
  iconId: string;
}[] = [
  { id: "cut", name: "Corte", iconId: "Scissors" },
  { id: "fade", name: "Fade", iconId: "Zap" },
  { id: "slide", name: "Slide", iconId: "Move" },
];

export function useEditor() {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedMusic, setSelectedMusic] = useState<string>("");
  const [musicVolume, setMusicVolume] = useState<number[]>([50]);
  const [bpmSync, setBpmSync] = useState(false);

  const totalDuration = useMemo(
    () => clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0),
    [clips]
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const updateClipSpeed = useCallback((clipId: string, speed: number) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, speed } : c))
    );
  }, []);

  const updateClipTransition = useCallback(
    (clipId: string, transition: TransitionType) => {
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, transition } : c))
      );
    },
    []
  );

  const addTransition = useCallback(() => {
    const newTransition: TimelineClip = {
      id: Date.now().toString(),
      title: "Nueva Transición",
      startTime: totalDuration,
      duration: 1,
      type: "transition",
      speed: 1,
      transition: "fade",
    };
    setClips((prev) => [...prev, newTransition]);
  }, [totalDuration]);

  const removeClip = useCallback((clipId: string) => {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
    setSelectedClip((prev) => (prev === clipId ? null : prev));
  }, []);

  const selectedClipData = useMemo(
    () => clips.find((c) => c.id === selectedClip) ?? null,
    [clips, selectedClip]
  );

  return {
    // state
    clips,
    selectedClip,
    isPlaying,
    currentTime,
    selectedMusic,
    musicVolume,
    bpmSync,
    // setters
    setIsPlaying,
    setCurrentTime,
    setSelectedClip,
    setSelectedMusic,
    setMusicVolume,
    setBpmSync,
    // computed & helpers
    totalDuration,
    formatTime,
    updateClipSpeed,
    updateClipTransition,
    addTransition,
    removeClip,
    selectedClipData,
    // static data
    musicTracks,
    transitionTypes,
  };
}
