"use client";

import { useState, useCallback } from "react";
import { Eye, MessageSquare, Gamepad2 } from "lucide-react";

export interface EditType {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  features: string[];
  recommended: boolean;
}

export interface EditTypeConfig {
  type: string;
  zoomLevel: number;
  targetDuration: number;
  silenceThreshold: number;
  speechThreshold: number;
}

const editTypes: EditType[] = [
  {
    id: "chatting-gameplay",
    title: "Chatting + Gameplay",
    description:
      "Detecta momentos de silencio y picos emocionales durante streams de juego",
    icon: MessageSquare,
    features: [
      "Detección de silencio",
      "Análisis emocional",
      "Momentos de chat activo",
      "Highlights de gameplay",
    ],
    recommended: true,
  },
  {
    id: "lets-play",
    title: "Let's Play Puro",
    description:
      "Enfocado en picos de audio y cambios de escena durante gameplay",
    icon: Gamepad2,
    features: [
      "Picos de audio",
      "Cambios de escena",
      "Momentos de acción",
      "Reacciones del jugador",
    ],
    recommended: false,
  },
  {
    id: "reaction",
    title: "Reacción a Video",
    description:
      "Captura ganchos de audio y reacciones durante videos de reacción",
    icon: Eye,
    features: [
      "Ganchos de audio",
      "Reacciones faciales",
      "Momentos de sorpresa",
      "Comentarios destacados",
    ],
    recommended: false,
  },
];

export function useEditType() {
  const [selectedType, setSelectedType] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(75);
  const [targetDuration, setTargetDuration] = useState<number>(300);
  const [silenceThreshold, setSilenceThreshold] = useState<number>(30);
  const [speechThreshold, setSpeechThreshold] = useState<number>(70);

  const handleContinue = useCallback(() => {
    if (!selectedType) return;
    const config: EditTypeConfig = {
      type: selectedType,
      zoomLevel,
      targetDuration,
      silenceThreshold,
      speechThreshold,
    };
    console.log("Configuración seleccionada:", config);
    // aquí podrías navegar o emitir el evento con la config
  }, [
    selectedType,
    zoomLevel,
    targetDuration,
    silenceThreshold,
    speechThreshold,
  ]);

  return {
    // datos estáticos
    editTypes,
    // estados
    selectedType,
    zoomLevel,
    targetDuration,
    silenceThreshold,
    speechThreshold,
    // setters
    setSelectedType,
    setZoomLevel,
    setTargetDuration,
    setSilenceThreshold,
    setSpeechThreshold,
    // acciones
    handleContinue,
  };
}
