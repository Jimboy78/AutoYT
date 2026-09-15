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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ImageIcon,
  Upload,
  Wand2,
  Download,
  RefreshCw,
  Type,
  Palette,
  Sparkles,
} from "lucide-react";
import type {
  ThumbnailTemplate,
  ThemeOption,
  GeneratedThumbnail,
} from "../hooks/useThumbnails";

interface ThumbnailsFormProps {
  templates: ThumbnailTemplate[];
  themes: ThemeOption[];
  selectedTemplate: string;
  selectedTheme: string;
  prompt: string;
  overlayText: string;
  keyFrame: File | null;
  generatedThumbnails: GeneratedThumbnail[];
  isGenerating: boolean;
  generationProgress: number;
  setSelectedTemplate: (id: string) => void;
  setSelectedTheme: (id: string) => void;
  setPrompt: (p: string) => void;
  setOverlayText: (t: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  generateThumbnail: () => void;
  regenerateThumbnail: (id: string) => void;
}

export function ThumbnailsForm({
  templates,
  themes,
  selectedTemplate,
  selectedTheme,
  prompt,
  overlayText,
  keyFrame,
  generatedThumbnails,
  isGenerating,
  generationProgress,
  setSelectedTemplate,
  setSelectedTheme,
  setPrompt,
  setOverlayText,
  handleFileUpload,
  generateThumbnail,
  regenerateThumbnail,
}: ThumbnailsFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-rose-400">
          Generador de Miniaturas IA
        </h1>
        <p className="text-gray-400">
          Crea miniaturas atractivas usando inteligencia artificial
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de configuración */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selección de template */}
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-rose-400">
                Seleccionar Estilo
              </CardTitle>
              <CardDescription className="text-gray-400">
                Elige un template base para tu miniatura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => {
                  const isSel = selectedTemplate === template.id;
                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        isSel
                          ? "bg-rose-600/20 border-rose-500 ring-2 ring-rose-500/50"
                          : "bg-zinc-700 border-zinc-600 hover:border-rose-500"
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <CardContent className="p-3">
                        <Image
                          src={template.preview}
                          alt={template.name}
                          width={320}
                          height={180}
                          className="w-full h-24 object-cover rounded mb-2"
                        />
                        <h3
                          className={`font-semibold text-sm ${
                            isSel ? "text-rose-400" : "text-gray-100"
                          }`}
                        >
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {template.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuración de contenido */}
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-400">
                <Wand2 className="h-5 w-5" />
                Configuración de Contenido
              </CardTitle>
              <CardDescription className="text-gray-400">
                Personaliza el contenido de tu miniatura
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fotograma clave */}
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-rose-400" />
                  Fotograma Clave (Opcional)
                </Label>
                <div className="border-2 border-dashed border-zinc-600 rounded-lg p-4 text-center hover:border-rose-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="keyframe-upload"
                  />
                  <label htmlFor="keyframe-upload" className="cursor-pointer">
                    {keyFrame ? (
                      <div className="space-y-2">
                        <ImageIcon className="mx-auto h-8 w-8 text-rose-400" />
                        <p className="text-sm text-rose-400">{keyFrame.name}</p>
                        <p className="text-xs text-gray-400">
                          Haz clic para cambiar
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="text-sm text-gray-400">
                          Subir fotograma clave
                        </p>
                        <p className="text-xs text-gray-500">
                          PNG, JPG hasta 10MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Prompt IA */}
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-rose-400" />
                  Descripción para IA
                </Label>
                <Textarea
                  placeholder="Describe lo que quieres en tu miniatura..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="bg-zinc-700 border-zinc-600 text-gray-100 min-h-20"
                />
                <p className="text-xs text-gray-400">
                  Sé específico para mejores resultados
                </p>
              </div>

              {/* Overlay text */}
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Type className="h-4 w-4 text-rose-400" />
                  Texto de Overlay
                </Label>
                <Input
                  placeholder="¡ÉPICO! | INCREÍBLE JUGADA"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  className="bg-zinc-700 border-zinc-600 text-gray-100"
                />
              </div>

              {/* Tema */}
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-rose-400" />
                  Tema de Color
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {themes.map((theme) => {
                    const isSel = selectedTheme === theme.id;
                    return (
                      <Button
                        key={theme.id}
                        variant={isSel ? "default" : "outline"}
                        className={`h-12 ${
                          isSel
                            ? "bg-rose-600 hover:bg-rose-700"
                            : "border-zinc-600 hover:bg-zinc-700"
                        }`}
                        onClick={() => setSelectedTheme(theme.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full bg-gradient-to-r ${theme.color}`}
                          />
                          <span className="text-xs">{theme.name}</span>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={generateThumbnail}
                disabled={!selectedTemplate || !prompt || isGenerating}
                className="w-full bg-rose-600 hover:bg-rose-700"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {isGenerating ? "Generando..." : "Generar Miniatura"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Vista previa y resultados */}
        <div className="space-y-6">
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-rose-400">Vista Previa</CardTitle>
              <CardDescription className="text-gray-400">
                Configuración actual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-video bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-600">
                {selectedTemplate ? (
                  <div className="text-center p-4">
                    <div
                      className={`w-16 h-16 rounded-lg bg-gradient-to-r ${
                        themes.find((t) => t.id === selectedTheme)?.color
                      } mx-auto mb-2 flex items-center justify-center`}
                    >
                      <ImageIcon className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-sm text-gray-300 mb-1">
                      {templates.find((t) => t.id === selectedTemplate)?.name}
                    </p>
                    {overlayText && (
                      <p className="text-xs text-rose-400 font-bold">
                        {overlayText}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Selecciona un template</p>
                  </div>
                )}
              </div>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={generationProgress} className="h-2" />
                  <p className="text-sm text-gray-400 text-center">
                    Generando con IA... {Math.round(generationProgress)}%
                  </p>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Template:</span>
                  <span className="text-rose-400">
                    {selectedTemplate
                      ? templates.find((t) => t.id === selectedTemplate)?.name
                      : "Ninguno"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tema:</span>
                  <span className="text-rose-400">
                    {themes.find((t) => t.id === selectedTheme)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fotograma:</span>
                  <span className="text-rose-400">
                    {keyFrame ? "Subido" : "No"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-rose-400">Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Generadas hoy:</span>
                <span className="text-rose-400">
                  {generatedThumbnails.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Templates usados:</span>
                <span className="text-rose-400">
                  {new Set(generatedThumbnails.map((t) => t.style)).size}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tiempo promedio:</span>
                <span className="text-rose-400">~15s</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Galería */}
      {generatedThumbnails.length > 0 && (
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-rose-400">
              Miniaturas Generadas
            </CardTitle>
            <CardDescription className="text-gray-400">
              Historial de miniaturas creadas con IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {generatedThumbnails.map((thumb) => (
                <Card key={thumb.id} className="bg-zinc-700 border-zinc-600">
                  <CardContent className="p-3">
                    <div className="aspect-video bg-zinc-900 rounded mb-3 overflow-hidden">
                      {thumb.isGenerating ? (
                        <div className="h-full flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-400 mb-2" />
                          <Progress
                            value={thumb.progress || 0}
                            className="w-20 h-1"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            {Math.round(thumb.progress || 0)}%
                          </p>
                        </div>
                      ) : (
                        <Image
                          src={thumb.url}
                          alt="Generated thumbnail"
                          width={320}
                          height={180}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="text-xs border-zinc-500 text-gray-400"
                        >
                          {templates.find((t) => t.id === thumb.style)?.name}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {thumb.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {thumb.prompt}
                      </p>
                      {!thumb.isGenerating && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="flex-1 bg-rose-600 hover:bg-rose-700"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Descargar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-600 hover:bg-zinc-600"
                            onClick={() => regenerateThumbnail(thumb.id)}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
