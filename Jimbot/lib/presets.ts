// Edit presets: each content type maps to real detection parameters and Shorts defaults.
// The active choice lives in localStorage so the Studio, Shorts Forge and Tipo de Edición agree.

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_DETECT, type DetectOptions } from "./studio/analyze";

export type PresetId = "gameplay-chat" | "lets-play" | "reaction" | "podcast" | "tutorial";
export type PresetIcon = "chat" | "gamepad" | "eye" | "mic" | "graduation";

export interface ShortsDefaults {
  hook: string;
  reframe: boolean;
  punch: boolean;
  bars: boolean;
  pad: number;
}

export interface EditPreset {
  id: PresetId;
  title: string;
  tagline: string;
  icon: PresetIcon;
  features: string[];
  sensitivity: number;
  detect: DetectOptions;
  shorts: ShortsDefaults;
}

export const PRESETS: EditPreset[] = [
  {
    id: "gameplay-chat",
    title: "Chatting + Gameplay",
    tagline: "Streams con charla: picos emocionales sobre un fondo de voz constante.",
    icon: "chat",
    features: ["Umbral medio", "Momentos cortos y seguidos", "Contexto de 2 s antes"],
    sensitivity: 55,
    detect: DEFAULT_DETECT,
    shorts: { hook: "Esperá al final 😳", reframe: true, punch: true, bars: true, pad: 1 },
  },
  {
    id: "lets-play",
    title: "Let's Play",
    tagline: "Gameplay con música y efectos: solo las explosiones de verdad.",
    icon: "gamepad",
    features: ["Umbral alto", "Une ráfagas de hasta 3 s", "Punch-in agresivo"],
    sensitivity: 42,
    detect: { mergeGap: 3, padBefore: 3, padAfter: 2, minLength: 2.5, maxHighlights: 10 },
    shorts: { hook: "Esto se descontroló", reframe: true, punch: true, bars: true, pad: 1.5 },
  },
  {
    id: "reaction",
    title: "Reacción",
    tagline: "Gritos, risas y sorpresas: muchos momentos breves.",
    icon: "eye",
    features: ["Umbral bajo", "Momentos de 1 s", "Hasta 16 highlights"],
    sensitivity: 68,
    detect: { mergeGap: 1, padBefore: 1.5, padAfter: 1.5, minLength: 1, maxHighlights: 16 },
    shorts: { hook: "No puedo creer esto", reframe: true, punch: true, bars: false, pad: 1 },
  },
  {
    id: "podcast",
    title: "Podcast / Charla",
    tagline: "Voz continua: busca subidas sostenidas y deja respirar las frases.",
    icon: "mic",
    features: ["Umbral bajo", "Frases largas unidas", "Sin temblor"],
    sensitivity: 38,
    detect: { mergeGap: 4, padBefore: 4, padAfter: 3, minLength: 5, maxHighlights: 8 },
    shorts: { hook: "Esta frase lo cambia todo", reframe: true, punch: false, bars: true, pad: 2 },
  },
  {
    id: "tutorial",
    title: "Tutorial",
    tagline: "Explicaciones: pocos cortes, largos y con contexto amplio.",
    icon: "graduation",
    features: ["Umbral mínimo", "Bloques de 6 s o más", "Estilo limpio"],
    sensitivity: 25,
    detect: { mergeGap: 6, padBefore: 3, padAfter: 3, minLength: 6, maxHighlights: 6 },
    shorts: { hook: "El truco que nadie te cuenta", reframe: false, punch: false, bars: false, pad: 2 },
  },
];

export interface PresetChoice {
  id: PresetId;
  sensitivity: number;
  detect: DetectOptions;
}

const KEY = "autoyt.preset.v1";
const EVENT = "autoyt:preset";

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

export const choiceFromPreset = (preset: EditPreset): PresetChoice => ({
  id: preset.id,
  sensitivity: preset.sensitivity,
  detect: { ...preset.detect },
});

export function loadPresetChoice(): PresetChoice {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as PresetChoice;
      const base = presetById(parsed.id);
      return { id: base.id, sensitivity: parsed.sensitivity ?? base.sensitivity, detect: { ...base.detect, ...parsed.detect } };
    }
  } catch {
    // Corrupt or blocked storage falls back to the default preset.
  }
  return choiceFromPreset(PRESETS[0]);
}

export function savePresetChoice(choice: PresetChoice) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Storage can be unavailable (private mode); the choice still applies to this tab.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function usePresetChoice(): [PresetChoice, (choice: PresetChoice) => void] {
  const [choice, setChoice] = useState<PresetChoice>(() => choiceFromPreset(PRESETS[0]));
  useEffect(() => {
    const sync = () => setChoice(loadPresetChoice());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const save = useCallback((next: PresetChoice) => {
    setChoice(next);
    savePresetChoice(next);
  }, []);
  return [choice, save];
}
