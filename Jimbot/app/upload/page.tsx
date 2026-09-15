"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Server, Sparkles, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { API_CONFIGURED } from "@/lib/api";
import { formatBytes } from "@/lib/studio/format";
import { cn } from "@/lib/utils";
import { useUpload, type UploadStatus } from "./hooks/useUpload";

const STATUS_LABEL: Record<UploadStatus, string> = {
  idle: "Listo para subir",
  preparing: "Pidiendo URL de subida…",
  uploading: "Subiendo",
  confirming: "Confirmando en el backend…",
  processing: "Encolando procesamiento…",
  done: "Subido y en cola",
  error: "Error",
};

export default function UploadPage() {
  const { status, progress, error, videoId, start, cancel, reset } = useUpload();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status === "preparing" || status === "uploading" || status === "confirming" || status === "processing";

  const pick = (f?: File | null) => {
    if (!f || busy) return;
    reset();
    setFile(f);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-violet-400">Pipeline</p>
        <h1 className="font-display text-4xl tracking-wide md:text-5xl">SUBIR AL BACKEND</h1>
        <p className="mt-2 text-zinc-400">
          Flujo presignado: <code className="font-mono text-zinc-300">init → PUT directo → confirm → process</code>. El
          archivo va al storage del backend y los workers generan clips y transcripción.
        </p>
      </div>

      {!API_CONFIGURED && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <Server className="h-5 w-5 shrink-0 text-yellow-300" />
          <p className="min-w-[200px] flex-1 text-sm text-yellow-100/90">
            Esta demo no tiene backend conectado (<code className="font-mono">NEXT_PUBLIC_API_BASE</code>). Para analizar un
            video ahora mismo usá el Studio, que procesa todo en tu navegador.
          </p>
          <Link
            href="/studio"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-3.5 py-2 text-sm font-semibold text-white"
          >
            <Sparkles className="h-4 w-4" /> Abrir Studio
          </Link>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-colors",
          dragging ? "border-violet-500 bg-violet-500/10" : "border-white/15 hover:border-violet-500/60",
        )}
      >
        <UploadCloud className="h-10 w-10 text-violet-400" />
        <p className="mt-3 font-semibold">Arrastrá un archivo o hacé clic</p>
        <p className="text-sm text-zinc-500">.mp4 · .mkv · .ts · .mp3</p>
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mkv,.ts,.mp3,video/*,audio/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {file && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-zinc-500">
                {formatBytes(file.size)} · {STATUS_LABEL[status]}
                {status === "uploading" && ` ${progress}%`}
              </p>
            </div>
            {status === "done" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ) : status === "error" ? (
              <AlertCircle className="h-6 w-6 text-red-400" />
            ) : busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
            ) : (
              <button onClick={() => setFile(null)} aria-label="Quitar archivo" className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {(status === "uploading" || status === "done") && <Progress value={status === "done" ? 100 : progress} className="h-2" />}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            {(status === "idle" || status === "error") && (
              <Button onClick={() => start(file)} disabled={!API_CONFIGURED} className="bg-violet-600 hover:bg-violet-700">
                Subir y procesar
              </Button>
            )}
            {status === "uploading" && (
              <Button variant="outline" onClick={cancel} className="border-white/15 bg-transparent">
                Cancelar
              </Button>
            )}
            {status === "done" && videoId && (
              <Link
                href={`/videos/${encodeURIComponent(videoId)}`}
                className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                Ver procesamiento <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
