"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  File as FileIcon,
} from "lucide-react";
import type { UploadFile } from "../hooks/useUpload";

interface UploadFormProps {
  files: UploadFile[];
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSimulate: (index: number) => void;
  onRemove: (index: number) => void;
  onUploadAll: () => void;
  onProcess?: (index: number) => Promise<void> | void;
}

export function UploadForm({
  files,
  dragActive,
  onDrag,
  onDrop,
  onFileInput,
  onSimulate,
  onRemove,
  onUploadAll,
  onProcess,
}: UploadFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyan-400">Subir Archivos</h1>
        <p className="text-gray-400">
          Arrastra y suelta tus archivos de video o audio
        </p>
      </div>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-cyan-400">Área de Subida</CardTitle>
          <CardDescription className="text-gray-400">
            Formatos soportados: .mp4, .mkv, .ts, .mp3 (máximo 5GB por archivo)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              dragActive
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-600 hover:border-cyan-500"
            }`}
            onDragEnter={onDrag}
            onDragLeave={onDrag}
            onDragOver={onDrag}
            onDrop={onDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-cyan-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Arrastra archivos aquí
            </h3>
            <p className="text-gray-400 mb-4">o haz clic para seleccionar</p>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".mp4,.mkv,.ts,.mp3"
              onChange={onFileInput}
              className="hidden"
            />
            <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
              <label htmlFor="file-upload" className="cursor-pointer">
                Seleccionar Archivos
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex justify-between items-center">
            <div>
              <CardTitle className="text-cyan-400">
                Archivos Seleccionados
              </CardTitle>
              <CardDescription className="text-gray-400">
                {files.length} archivo(s) en cola
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onUploadAll}
                className="bg-cyan-600 hover:bg-cyan-700"
                disabled={files.every((f) => f.status !== "pending")}
              >
                Subir Todos
              </Button>
              <Button
                variant="outline"
                onClick={() => files.forEach((_, i) => onRemove(i))}
                className="border-slate-600 text-gray-400 hover:bg-slate-700"
              >
                Limpiar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((f, i) => (
              <div key={i} className="border border-slate-600 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="font-medium truncate max-w-xs">
                        {f.file.name}
                      </p>
                      <p className="text-sm text-gray-400">
                        {(f.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {f.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(i)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {f.status === "uploading" && (
                  <div className="space-y-2">
                    <Progress value={f.progress} className="h-2" />
                    <p className="text-sm text-gray-400">
                      Subiendo... {Math.round(f.progress)}%
                    </p>
                  </div>
                )}

                {f.status === "error" && f.error && (
                  <Alert className="border-red-500/50 bg-red-500/10">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-400">
                      {f.error}
                    </AlertDescription>
                  </Alert>
                )}

                {f.status === "success" && (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-400">
                      Archivo subido exitosamente
                    </AlertDescription>
                  </Alert>
                )}

                {f.status === "pending" && (
                  <Button
                    onClick={() => onSimulate(i)}
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    Subir Archivo
                  </Button>
                )}

                {f.status === "success" && f.videoId && onProcess && (
                  <Button
                    onClick={async () => {
                      await onProcess(i);
                      const vid = files[i]?.videoId;
                      const dest = vid
                        ? `/processing?videoId=${encodeURIComponent(vid)}`
                        : "/processing";
                      window.location.href = dest;
                    }}
                    size="sm"
                    className="mt-2 bg-cyan-600 hover:bg-cyan-700"
                  >
                    Procesar →
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
