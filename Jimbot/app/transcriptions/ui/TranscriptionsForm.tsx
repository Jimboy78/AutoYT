"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadSRT, downloadVTT, type Video } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Download,
  Edit3,
  Save,
  Globe,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Search,
  Languages,
  Clock,
  Volume2,
} from "lucide-react";
import type {
  TranscriptionSegment,
  TranslationJob,
  LanguageOption,
} from "../hooks/useTranscriptions";

interface TranscriptionsFormProps {
  // estados
  video?: { id: string; filename: string } | null;
  videos?: Video[];
  currentTime: number;
  isPlaying: boolean;
  searchTerm: string;
  translations: TranslationJob[];
  filteredSegments: TranscriptionSegment[];
  totalDuration: number;
  averageConfidence: number;
  languages: LanguageOption[];
  // acciones
  setVideo?: (v: Video | null) => void;
  setIsPlaying: (b: boolean) => void;
  setSearchTerm: (s: string) => void;
  jumpToTime: (t: number) => void;
  editSegment: (id: string, text: string) => void;
  toggleEdit: (id: string) => void;
  exportSRT: () => void;
  startTranslation: (code: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptionsForm({
  video,
  videos,
  currentTime,
  isPlaying,
  searchTerm,
  translations,
  filteredSegments,
  totalDuration,
  averageConfidence,
  languages,
  setVideo,
  setIsPlaying,
  setSearchTerm,
  jumpToTime,
  editSegment,
  toggleEdit,
  exportSRT,
  startTranslation,
}: TranscriptionsFormProps) {
  return (
    <div className="space-y-6">
      {/* Selector de Video */}
      <Card className="bg-zinc-800 border-zinc-700">
        <CardContent className="p-4 flex items-center gap-3">
          <span className="text-gray-400">Video:</span>
          <select
            className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1"
            value={video?.id || ""}
            onChange={(e) => {
              const v = videos?.find((x) => x.id === e.target.value) || null;
              setVideo && setVideo(v);
            }}
          >
            {(videos || []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.filename}
              </option>
            ))}
          </select>
          {video && (
            <a
              className="text-rose-400 underline ml-2"
              href={`/api/proxy/uploads/${encodeURIComponent(video.id)}`}
              onClick={(e) => e.preventDefault()}
            >
              {video.id}
            </a>
          )}
        </CardContent>
      </Card>
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
                {/* Formatea el tiempo como mm:ss */}
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </Button>
            </div>

            <div className="text-center">
              <div className="text-2xl font-mono text-rose-400">
                {/* Formatea el tiempo como mm:ss */}
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </div>
              <div className="text-sm text-gray-400">
                Tiempo de reproducción
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <div className="w-24 h-2 bg-zinc-700 rounded-full">
                <div className="w-3/4 h-full bg-rose-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="relative bg-zinc-700 rounded-full h-2 cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full bg-rose-500 rounded-full"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
            />
            {filteredSegments.map((seg) => (
              <div
                key={seg.id}
                className="absolute top-0 w-1 h-full bg-yellow-400 opacity-60"
                style={{ left: `${(seg.startTime / totalDuration) * 100}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transcripción */}
      <Card className="bg-zinc-800 border-zinc-700">
        <CardHeader className="flex justify-between items-center">
          <div>
            <CardTitle className="text-rose-400">Transcripción</CardTitle>
            <CardDescription className="text-gray-400">
              Edita los segmentos de texto
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 bg-zinc-700 border-zinc-600 text-gray-100"
              />
            </div>
            <Button
              onClick={exportSRT}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar SRT
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {filteredSegments.map((seg) => (
            <div
              key={seg.id}
              className={`border rounded-lg p-4 transition-colors ${
                currentTime >= seg.startTime && currentTime <= seg.endTime
                  ? "border-rose-500 bg-rose-500/10"
                  : "border-zinc-600 hover:border-zinc-500"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => jumpToTime(seg.startTime)}
                    className="border-zinc-600 text-gray-400 hover:bg-zinc-700"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {`${seg.startTime.toFixed(2)}`}
                  </Button>
                  <span className="text-sm text-gray-400">
                    → {seg.endTime.toFixed(2)}
                  </span>
                  {seg.speaker && (
                    <Badge
                      variant="outline"
                      className="text-xs border-zinc-500 text-gray-400"
                    >
                      {seg.speaker}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      seg.confidence >= 0.9
                        ? "border-green-500 text-green-400"
                        : seg.confidence >= 0.8
                        ? "border-yellow-500 text-yellow-400"
                        : "border-red-500 text-red-400"
                    }`}
                  >
                    {Math.round(seg.confidence * 100)}%
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleEdit(seg.id)}
                  className="text-gray-400 hover:text-rose-400"
                >
                  {seg.isEditing ? (
                    <Save className="h-3 w-3" />
                  ) : (
                    <Edit3 className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {seg.isEditing ? (
                <Input
                  value={seg.text}
                  onChange={(e) => editSegment(seg.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && toggleEdit(seg.id)}
                  className="bg-zinc-700 border-zinc-600 text-gray-100"
                  autoFocus
                />
              ) : (
                <p className="text-gray-100 leading-relaxed">{seg.text}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Panel lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-rose-400">Estadísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Segmentos:</span>
              <span className="text-rose-400">{filteredSegments.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duración:</span>
              <span className="text-rose-400">{totalDuration.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Confianza promedio:</span>
              <span className="text-rose-400">
                {Math.round(averageConfidence * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Palabras totales:</span>
              <span className="text-rose-400">
                {filteredSegments.reduce(
                  (acc, s) => acc + s.text.split(" ").length,
                  0
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-400">
              <Languages className="h-5 w-5" />
              Traducir
            </CardTitle>
            <CardDescription className="text-gray-400">
              Genera subtítulos en otros idiomas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {languages.slice(0, 6).map((lang) => (
                <Button
                  key={lang.code}
                  size="sm"
                  variant="outline"
                  onClick={() => startTranslation(lang.code)}
                  disabled={translations.some((t) => t.language === lang.code)}
                  className="border-zinc-600 text-gray-400 hover:bg-zinc-700 justify-start"
                >
                  <span className="mr-2">{lang.flag}</span>
                  <span className="text-xs">{lang.name}</span>
                </Button>
              ))}
            </div>
            {translations.map((t) => (
              <div key={t.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    className={`text-xs ${
                      t.status === "completed"
                        ? "bg-green-500"
                        : t.status === "processing"
                        ? "bg-rose-500"
                        : "bg-gray-500"
                    } text-white`}
                  >
                    {t.status === "pending"
                      ? "Pendiente"
                      : t.status === "processing"
                      ? "Procesando"
                      : "Completado"}
                  </Badge>
                  {t.status === "completed" && (
                    <Button size="sm" className="bg-rose-600 hover:bg-rose-700">
                      <Download className="h-3 w-3 mr-1" />
                      Descargar SRT
                    </Button>
                  )}
                </div>
                {t.status === "processing" && (
                  <Progress value={t.progress} className="h-1" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-rose-400">Herramientas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-zinc-600 text-gray-400 hover:bg-zinc-700"
              onClick={() => video && downloadSRT(video.id)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Exportar TXT
            </Button>
            <Button
              variant="outline"
              className="w-full border-zinc-600 text-gray-400 hover:bg-zinc-700"
              onClick={() => video && downloadVTT(video.id)}
            >
              <Globe className="h-4 w-4 mr-2" />
              Exportar VTT
            </Button>
            <Button
              variant="outline"
              className="w-full border-zinc-600 text-gray-400 hover:bg-zinc-700"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Corrección IA
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
