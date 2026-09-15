"use client";

import { useRef, useState } from "react";
import { Film, Loader2, Lock, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1.5 * 1024 ** 3;

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const accept = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      setError("Soltá un archivo de video o audio (mp4, webm, mov, mp3…).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("El análisis en el navegador está pensado para archivos de hasta 1.5 GB.");
      return;
    }
    setError(null);
    onFile(file);
  };

  const loadSample = async () => {
    setLoadingSample(true);
    try {
      const res = await fetch("/sample.mp4");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      onFile(new File([blob], "autoyt-sample-vod.mp4", { type: "video/mp4" }));
    } catch {
      setError("No se pudo descargar el video de ejemplo.");
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition-all",
          dragging
            ? "scale-[1.01] border-[#ff2e63] bg-[#ff2e63]/10"
            : "border-white/15 bg-white/[0.02] hover:border-[#ff2e63]/60 hover:bg-white/[0.04]",
        )}
      >
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff2e63] to-[#ff9f1c] shadow-[0_0_60px_-10px_#ff2e63] transition-transform group-hover:-translate-y-1 group-hover:rotate-3">
          <UploadCloud className="h-9 w-9 text-white" />
        </div>
        <h2 className="relative font-display text-4xl tracking-wide md:text-5xl">SOLTÁ TU VOD ACÁ</h2>
        <p className="relative mt-3 max-w-md text-zinc-400">
          Detectamos los momentos más intensos por la energía del audio, armamos capítulos y te proponemos miniaturas.
        </p>
        <p className="relative mt-5 flex items-center gap-2 text-sm text-emerald-400">
          <Lock className="h-4 w-4" /> Todo se procesa en tu navegador — el archivo nunca se sube.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={loadSample}
          disabled={loadingSample}
          className="border-white/15 bg-transparent hover:bg-white/5"
        >
          {loadingSample ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-[#ff9f1c]" />}
          Probar con un VOD de ejemplo (40 s)
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Film className="h-3.5 w-3.5" /> mp4 · webm · mov · mkv (según tu navegador)
        </span>
      </div>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
