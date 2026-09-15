"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Zap, Clock, Volume2 } from "lucide-react";
import type { EditType } from "../hooks/useEditType";
import type { EditTypeConfig } from "../hooks/useEditType";

interface EditTypeFormProps extends EditTypeConfig {
  editTypes: EditType[];
  selectedType: string;
  setSelectedType: (id: string) => void;
  setZoomLevel: (v: number) => void;
  setTargetDuration: (v: number) => void;
  setSilenceThreshold: (v: number) => void;
  setSpeechThreshold: (v: number) => void;
  handleContinue: () => void;
}

export function EditTypeForm({
  editTypes,
  selectedType,
  zoomLevel,
  targetDuration,
  silenceThreshold,
  speechThreshold,
  setSelectedType,
  setZoomLevel,
  setTargetDuration,
  setSilenceThreshold,
  setSpeechThreshold,
  handleContinue,
}: EditTypeFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-rose-400">Tipo de Edición</h1>
        <p className="text-gray-400">
          Selecciona el tipo de contenido que quieres editar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {editTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <Card
              key={type.id}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "bg-rose-600/20 border-rose-500 ring-2 ring-rose-500/50"
                  : "bg-zinc-800 border-zinc-700 hover:border-rose-500"
              }`}
              onClick={() => setSelectedType(type.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Icon
                    className={`h-8 w-8 ${
                      isSelected ? "text-rose-400" : "text-gray-400"
                    }`}
                  />
                  {type.recommended && (
                    <Badge className="bg-rose-600 text-white">
                      Recomendado
                    </Badge>
                  )}
                </div>
                <CardTitle
                  className={isSelected ? "text-rose-400" : "text-gray-100"}
                >
                  {type.title}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {type.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">
                    Características:
                  </h4>
                  <ul className="space-y-1">
                    {type.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-400 flex items-center gap-2"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedType && (
        <Card className="bg-zinc-800 border-zinc-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-400">
              <Settings className="h-5 w-5" />
              Configuración Avanzada
            </CardTitle>
            <CardDescription className="text-gray-400">
              Ajusta los parámetros para optimizar la edición
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Zoom */}
              <div className="space-y-3">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-rose-400" />
                  Nivel de Zoom: {zoomLevel}%
                </Label>
                <Slider
                  value={[zoomLevel]}
                  onValueChange={(v) => setZoomLevel(v[0])}
                  max={100}
                  min={50}
                  step={5}
                  className="w-full"
                />
                <p className="text-sm text-gray-400">
                  Controla qué tan cerca se enfoca en los momentos destacados
                </p>
              </div>

              {/* Duración */}
              <div className="space-y-3">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-rose-400" />
                  Duración Objetivo
                </Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[targetDuration]}
                    onValueChange={(v) => setTargetDuration(v[0])}
                    max={600}
                    min={60}
                    step={30}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(+e.target.value)}
                    className="w-20 bg-zinc-700 border-zinc-600"
                  />
                  <span className="text-sm text-gray-400">seg</span>
                </div>
                <p className="text-sm text-gray-400">
                  Duración aproximada del video final
                </p>
              </div>

              {/* Silencio */}
              <div className="space-y-3">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-rose-400" />
                  Umbral de Silencio: {silenceThreshold}%
                </Label>
                <Slider
                  value={[silenceThreshold]}
                  onValueChange={(v) => setSilenceThreshold(v[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <p className="text-sm text-gray-400">
                  Nivel mínimo de audio para considerar como silencio
                </p>
              </div>

              {/* Habla */}
              <div className="space-y-3">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-rose-400" />
                  Umbral de Habla: {speechThreshold}%
                </Label>
                <Slider
                  value={[speechThreshold]}
                  onValueChange={(v) => setSpeechThreshold(v[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <p className="text-sm text-gray-400">
                  Nivel mínimo de audio para detectar habla activa
                </p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleContinue}
                className="bg-rose-600 hover:bg-rose-700"
                disabled={!selectedType}
              >
                Continuar con Edición
              </Button>
              <Button
                variant="outline"
                className="border-zinc-600 text-gray-400 hover:bg-zinc-700"
              >
                Guardar Configuración
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
