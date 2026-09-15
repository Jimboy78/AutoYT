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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Monitor,
  Smartphone,
  Square,
  Download,
  Settings,
  Eye,
} from "lucide-react";
import type { AspectRatio, ConversionJob } from "../hooks/useConversion";

interface ConversionFormProps {
  aspectRatios: AspectRatio[];
  selectedRatios: string[];
  conversionJobs: ConversionJob[];
  generateMultiple: boolean;
  previewRatio: string;
  previewAspectRatio: AspectRatio;
  toggleRatio: (id: string) => void;
  startConversion: () => void;
  setGenerateMultiple: (on: boolean) => void;
  setPreviewRatio: (id: string) => void;
}

export function ConversionForm({
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
}: ConversionFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyan-400">
          Conversión de Formato
        </h1>
        <p className="text-gray-400">
          Convierte tus videos a diferentes aspect ratios para múltiples
          plataformas
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector de formatos */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">
                Seleccionar Formatos
              </CardTitle>
              <CardDescription className="text-gray-400">
                Elige los aspect ratios para tu contenido
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aspectRatios.map((ratio) => {
                  const Icon = ratio.icon;
                  const isSelected = selectedRatios.includes(ratio.id);
                  return (
                    <Card
                      key={ratio.id}
                      className={`cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-cyan-600/20 border-cyan-500 ring-2 ring-cyan-500/50"
                          : "bg-slate-700 border-slate-600 hover:border-cyan-500"
                      }`}
                      onClick={() => toggleRatio(ratio.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Icon
                            className={`h-6 w-6 mt-1 ${
                              isSelected ? "text-cyan-400" : "text-gray-400"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className={`font-semibold ${
                                  isSelected ? "text-cyan-400" : "text-gray-100"
                                }`}
                              >
                                {ratio.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className="text-xs border-slate-500 text-gray-400"
                              >
                                {ratio.ratio}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">
                              {ratio.description}
                            </p>
                            <p className="text-xs text-gray-500">
                              {ratio.width} × {ratio.height}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {ratio.platforms.slice(0, 3).map((plat) => (
                                <Badge
                                  key={plat}
                                  variant="secondary"
                                  className="text-xs bg-slate-600 text-gray-300"
                                >
                                  {plat}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="multiple"
                    checked={generateMultiple}
                    onChange={(e) => setGenerateMultiple(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <Label htmlFor="multiple" className="text-gray-300">
                    Generar múltiples versiones simultáneamente
                  </Label>
                </div>
                <Button
                  onClick={startConversion}
                  disabled={selectedRatios.length === 0}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Iniciar Conversión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <Eye className="h-5 w-5" />
                Preview en Vivo
              </CardTitle>
              <CardDescription className="text-gray-400">
                Vista previa del formato seleccionado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Formato de Preview</Label>
                <select
                  value={previewRatio}
                  onChange={(e) => setPreviewRatio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-gray-100"
                >
                  {aspectRatios.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.ratio})
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 flex items-center justify-center min-h-48">
                <div
                  className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded flex items-center justify-center text-white font-semibold shadow-lg"
                  style={{
                    aspectRatio: `${previewAspectRatio.width} / ${previewAspectRatio.height}`,
                    width:
                      previewAspectRatio.id === "9:16"
                        ? "120px"
                        : previewAspectRatio.id === "1:1"
                        ? "150px"
                        : "200px",
                  }}
                >
                  <div className="text-center">
                    <div className="text-sm">{previewAspectRatio.ratio}</div>
                    <div className="text-xs opacity-80">
                      {previewAspectRatio.width}×{previewAspectRatio.height}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Resolución:</span>
                  <span className="text-cyan-400">
                    {previewAspectRatio.width}×{previewAspectRatio.height}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Aspect Ratio:</span>
                  <span className="text-cyan-400">
                    {previewAspectRatio.ratio}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Plataformas:</span>
                  <span className="text-cyan-400">
                    {previewAspectRatio.platforms.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Estado de jobs */}
      {conversionJobs.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-cyan-400">
              Estado de Conversión
            </CardTitle>
            <CardDescription className="text-gray-400">
              Progreso de las conversiones en curso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {conversionJobs.map((job) => {
              const Icon = job.aspectRatio.icon;
              return (
                <div
                  key={job.id}
                  className="border border-slate-600 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="font-medium">
                          {job.aspectRatio.name} ({job.aspectRatio.ratio})
                        </p>
                        <p className="text-sm text-gray-400">
                          {job.aspectRatio.width} × {job.aspectRatio.height}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`${
                          job.status === "completed"
                            ? "bg-green-500"
                            : job.status === "processing"
                            ? "bg-cyan-500"
                            : job.status === "error"
                            ? "bg-red-500"
                            : "bg-gray-500"
                        } text-white`}
                      >
                        {job.status === "pending"
                          ? "Pendiente"
                          : job.status === "processing"
                          ? "Procesando"
                          : job.status === "completed"
                          ? "Completado"
                          : "Error"}
                      </Badge>
                      {job.status === "completed" && (
                        <Button
                          size="sm"
                          className="bg-cyan-600 hover:bg-cyan-700"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Descargar
                        </Button>
                      )}
                    </div>
                  </div>
                  {job.status === "processing" && (
                    <div className="space-y-2">
                      <Progress value={job.progress} className="h-2" />
                      <p className="text-sm text-gray-400">
                        Convirtiendo... {Math.round(job.progress)}%
                      </p>
                    </div>
                  )}
                  {job.status === "completed" && (
                    <div className="flex items-center gap-2 text-green-400">
                      <Download className="h-4 w-4" />
                      <span className="text-sm">
                        Conversión completada – Listo para descargar
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
