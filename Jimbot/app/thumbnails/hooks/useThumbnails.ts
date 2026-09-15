"use client";

import { useState, useCallback } from "react";

export interface ThumbnailTemplate {
  id: string;
  name: string;
  style: string;
  preview: string;
  description: string;
}

export interface ThemeOption {
  id: string;
  name: string;
  color: string;
}

export interface GeneratedThumbnail {
  id: string;
  url: string;
  prompt: string;
  style: string;
  timestamp: Date;
  isGenerating?: boolean;
  progress?: number;
}

const templates: ThumbnailTemplate[] = [
  {
    id: "gaming",
    name: "Gaming Epic",
    style: "gaming",
    preview: "/placeholder.svg?height=180&width=320",
    description: "Estilo épico para gaming con efectos dramáticos",
  },
  {
    id: "reaction",
    name: "Reaction Style",
    style: "reaction",
    preview: "/placeholder.svg?height=180&width=320",
    description: "Perfecto para videos de reacción con expresiones",
  },
  {
    id: "tutorial",
    name: "Tutorial Clean",
    style: "tutorial",
    preview: "/placeholder.svg?height=180&width=320",
    description: "Diseño limpio y profesional para tutoriales",
  },
  {
    id: "highlight",
    name: "Highlight Reel",
    style: "highlight",
    preview: "/placeholder.svg?height=180&width=320",
    description: "Dinámico para compilaciones de highlights",
  },
];

const themes: ThemeOption[] = [
  { id: "neon", name: "Neon", color: "from-cyan-500 to-purple-500" },
  { id: "fire", name: "Fire", color: "from-red-500 to-orange-500" },
  { id: "ice", name: "Ice", color: "from-blue-500 to-cyan-500" },
  { id: "nature", name: "Nature", color: "from-green-500 to-emerald-500" },
  { id: "dark", name: "Dark", color: "from-gray-800 to-black" },
  { id: "gold", name: "Gold", color: "from-yellow-500 to-amber-500" },
];

export function useThumbnails() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("neon");
  const [prompt, setPrompt] = useState<string>("");
  const [overlayText, setOverlayText] = useState<string>("");
  const [keyFrame, setKeyFrame] = useState<File | null>(null);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<
    GeneratedThumbnail[]
  >([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) setKeyFrame(e.target.files[0]);
    },
    []
  );

  const generateThumbnail = useCallback(() => {
    if (!selectedTemplate || !prompt) return;

    setIsGenerating(true);
    setGenerationProgress(0);

    const newThumb: GeneratedThumbnail = {
      id: Date.now().toString(),
      url: "",
      prompt,
      style: selectedTemplate,
      timestamp: new Date(),
      isGenerating: true,
      progress: 0,
    };
    setGeneratedThumbnails((prev) => [newThumb, ...prev]);

    const interval = setInterval(() => {
      setGenerationProgress((prevProg) => {
        const next = Math.min(prevProg + Math.random() * 15, 100);
        setGeneratedThumbnails((tList) =>
          tList.map((t) =>
            t.id === newThumb.id ? { ...t, progress: next } : t
          )
        );
        if (next >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setGenerationProgress(0);
          setGeneratedThumbnails((tList) =>
            tList.map((t) =>
              t.id === newThumb.id
                ? {
                    ...t,
                    url: "/placeholder.svg?height=180&width=320",
                    isGenerating: false,
                    progress: undefined,
                  }
                : t
            )
          );
        }
        return next;
      });
    }, 200);
  }, [selectedTemplate, prompt]);

  const regenerateThumbnail = useCallback((thumbnailId: string) => {
    setGeneratedThumbnails((prev) =>
      prev.map((t) =>
        t.id === thumbnailId ? { ...t, isGenerating: true, progress: 0 } : t
      )
    );
    const interval = setInterval(() => {
      setGeneratedThumbnails((prev) =>
        prev.map((t) => {
          if (t.id === thumbnailId && t.isGenerating) {
            const next = Math.min((t.progress || 0) + Math.random() * 20, 100);
            if (next >= 100) {
              clearInterval(interval);
              return {
                ...t,
                url: "/placeholder.svg?height=180&width=320",
                isGenerating: false,
                progress: undefined,
                timestamp: new Date(),
              };
            }
            return { ...t, progress: next };
          }
          return t;
        })
      );
    }, 150);
  }, []);

  return {
    // datos estáticos
    templates,
    themes,
    // estados
    selectedTemplate,
    selectedTheme,
    prompt,
    overlayText,
    keyFrame,
    generatedThumbnails,
    isGenerating,
    generationProgress,
    // setters
    setSelectedTemplate,
    setSelectedTheme,
    setPrompt,
    setOverlayText,
    handleFileUpload,
    // acciones
    generateThumbnail,
    regenerateThumbnail,
  };
}
