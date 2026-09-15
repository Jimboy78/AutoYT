"use client";

import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Music,
  Zap,
  Move,
  Scissors,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  TimelineClip,
  MusicTrack,
  TransitionType,
} from "../hooks/useEditor";

interface EditorFormProps {
  // estados y setters
  clips: TimelineClip[];
  selectedClip: string | null;
  isPlaying: boolean;
  currentTime: number;
  selectedMusic: string;
  musicVolume: number[];
  bpmSync: boolean;
  setIsPlaying: (b: boolean) => void;
  setCurrentTime: (n: number) => void;
  setSelectedClip: (id: string | null) => void;
  setSelectedMusic: (id: string) => void;
  setMusicVolume: (v: number[]) => void;
  setBpmSync: (b: boolean) => void;
  // helpers
  totalDuration: number;
  formatTime: (n: number) => string;
  updateClipSpeed: (id: string, speed: number) => void;
  updateClipTransition: (id: string, t: TransitionType) => void;
  addTransition: () => void;
  removeClip: (id: string) => void;
  selectedClipData: TimelineClip | null;
  musicTracks: MusicTrack[];
  transitionTypes: { id: TransitionType; name: string; iconId: string }[];
}

export function EditorForm({
  clips,
  selectedClip,
  isPlaying,
  currentTime,
  selectedMusic,
  musicVolume,
  bpmSync,
  setIsPlaying,
  setCurrentTime,
  setSelectedClip,
  setSelectedMusic,
  setMusicVolume,
  setBpmSync,
  totalDuration,
  formatTime,
  updateClipSpeed,
  updateClipTransition,
  addTransition,
  removeClip,
  selectedClipData,
  musicTracks,
  transitionTypes,
}: EditorFormProps) {
  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-rose-400">
          Editor de Ritmo y Transiciones
        </h1>
        <p className="text-gray-400">
          Ajusta el timing y las transiciones de tus clips
        </p>
      </div>

      {/* Controles de reproducción */}
      <Card className="bg-zinc-800 border-zinc-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="border-rose-500 text-rose-400 hover:bg-rose-600"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setIsPlaying(!isPlaying)}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-500 text-rose-400 hover:bg-rose-600"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              <div className="text-2xl font-mono text-rose-400">
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>
              <div className="text-sm text-gray-400">
                Tiempo de reproducción
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <Slider
                value={musicVolume}
                onValueChange={setMusicVolume}
                max={100}
                min={0}
                step={1}
                className="w-24"
              />
              <span className="text-sm text-gray-400 w-8">
                {musicVolume[0]}%
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative bg-zinc-900 rounded-lg p-4 min-h-32">
            <div className="absolute top-2 left-4 text-xs text-gray-400">
              Timeline
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-2 mt-6">
              {Array.from(
                { length: Math.ceil(totalDuration / 10) + 1 },
                (_, i) => (
                  <span key={i}>{formatTime(i * 10)}</span>
                )
              )}
            </div>
            <div className="relative h-16 bg-zinc-800 rounded border border-zinc-600">
              {clips.map((clip) => {
                const widthP = (clip.duration / totalDuration) * 100;
                const leftP = (clip.startTime / totalDuration) * 100;
                const Icon = {
                  fade: Zap,
                  slide: Move,
                  cut: Scissors,
                }[clip.transition ?? "fade"];

                return (
                  <div
                    key={clip.id}
                    className={`absolute top-1 h-14 rounded cursor-pointer transition-all ${
                      selectedClip === clip.id
                        ? "ring-2 ring-rose-500 z-10"
                        : "hover:ring-1 hover:ring-rose-400"
                    } ${
                      clip.type === "video"
                        ? "bg-rose-600"
                        : clip.type === "transition"
                        ? "bg-purple-600"
                        : "bg-green-600"
                    }`}
                    style={{
                      left: `${leftP}%`,
                      width: `${widthP}%`,
                      minWidth: "40px",
                    }}
                    onClick={() => setSelectedClip(clip.id)}
                  >
                    <div className="p-2 h-full flex flex-col justify-between">
                      <div className="text-xs font-medium text-white truncate">
                        {clip.title}
                      </div>
                      <div className="text-xs text-white/80 flex items-center gap-1">
                        {clip.speed !== 1 && `${clip.speed}x`}
                        {clip.transition && (
                          <>
                            • <Icon className="h-3 w-3" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                style={{ left: `${(currentTime / totalDuration) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de propiedades */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-rose-400">
                {selectedClipData
                  ? `Editando: ${selectedClipData.title}`
                  : "Selecciona un clip"}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Ajusta las propiedades del clip seleccionado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedClipData ? (
                <>
                  {/* Velocidad */}
                  <div className="space-y-3">
                    <Label className="text-gray-300 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-rose-400" />
                      Velocidad: {selectedClipData.speed}x
                    </Label>
                    <Slider
                      value={[selectedClipData.speed]}
                      onValueChange={([s]) =>
                        updateClipSpeed(selectedClipData.id, s)
                      }
                      min={0.25}
                      max={3}
                      step={0.25}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>0.25x (Muy lento)</span>
                      <span>1x (Normal)</span>
                      <span>3x (Muy rápido)</span>
                    </div>
                  </div>

                  {/* Transición */}
                  <div className="space-y-3">
                    <Label className="text-gray-300">Tipo de Transición</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {transitionTypes.map((t) => {
                        const Icon = { fade: Zap, slide: Move, cut: Scissors }[
                          t.id
                        ];
                        const isSel = selectedClipData.transition === t.id;
                        return (
                          <Button
                            key={t.id}
                            variant={isSel ? "default" : "outline"}
                            className={`flex flex-col gap-2 h-16 ${
                              isSel
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "border-zinc-600 hover:bg-zinc-700"
                            }`}
                            onClick={() =>
                              updateClipTransition(selectedClipData.id, t.id)
                            }
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-xs">{t.name}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-900 rounded-lg">
                    <div>
                      <Label className="text-gray-400">Duración</Label>
                      <p className="text-lg font-mono text-rose-400">
                        {formatTime(selectedClipData.duration)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Posición</Label>
                      <p className="text-lg font-mono text-rose-400">
                        {formatTime(selectedClipData.startTime)}
                      </p>
                    </div>
                  </div>

                  {/* Eliminar */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="border-red-500 text-red-400 hover:bg-red-600"
                      onClick={() => removeClip(selectedClipData.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Clip
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto h-16 w-16 rounded-full bg-zinc-700 flex items-center justify-center mb-4">
                    <Scissors className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-400">
                    Selecciona un clip en el timeline para editarlo
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel de música y stats */}
        <div>
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-400">
                <Music className="h-5 w-5" /> Música de Fondo
              </CardTitle>
              <CardDescription className="text-gray-400">
                Añade y sincroniza música con tu video
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selección de pista */}
              <div className="space-y-2">
                <Label className="text-gray-300">Seleccionar Pista</Label>
                <select
                  value={selectedMusic}
                  onChange={(e) => setSelectedMusic(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-gray-100"
                >
                  <option value="">Sin música</option>
                  {musicTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.bpm} BPM)
                    </option>
                  ))}
                </select>
              </div>

              {selectedMusic && (
                <>
                  <div className="p-3 bg-zinc-900 rounded-lg">
                    {(() => {
                      const tr = musicTracks.find(
                        (m) => m.id === selectedMusic
                      );
                      return tr ? (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">BPM:</span>
                            <span className="text-rose-400">{tr.bpm}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Duración:</span>
                            <span className="text-rose-400">
                              {formatTime(tr.duration)}
                            </span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Sincronizar BPM</Label>
                    <Button
                      size="sm"
                      variant={bpmSync ? "default" : "outline"}
                      onClick={() => setBpmSync(!bpmSync)}
                      className={bpmSync ? "bg-rose-600" : "border-zinc-600"}
                    >
                      {bpmSync ? "Activado" : "Desactivado"}
                    </Button>
                  </div>

                  {bpmSync && (
                    <div className="p-3 bg-rose-600/10 border border-rose-500/50 rounded-lg">
                      <p className="text-sm text-rose-400">
                        Los cortes se sincronizarán automáticamente con el ritmo
                        de la música
                      </p>
                    </div>
                  )}
                </>
              )}

              <Button
                onClick={addTransition}
                className="w-full bg-rose-600 hover:bg-rose-700"
              >
                <Plus className="h-4 w-4 mr-2" /> Añadir Transición
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-zinc-800 border-zinc-700 mt-6">
            <CardHeader>
              <CardTitle className="text-rose-400">Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total clips:</span>
                <span className="text-rose-400">
                  {clips.filter((c) => c.type === "video").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transiciones:</span>
                <span className="text-rose-400">
                  {clips.filter((c) => c.type === "transition").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duración total:</span>
                <span className="text-rose-400">
                  {formatTime(totalDuration)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Velocidad promedio:</span>
                <span className="text-rose-400">
                  {(
                    clips
                      .filter((c) => c.type === "video")
                      .reduce((sum, c) => sum + c.speed, 0) /
                    clips.filter((c) => c.type === "video").length
                  ).toFixed(1)}
                  x
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
