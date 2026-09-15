"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Chapter, Highlight } from "@/lib/studio/analyze";
import { formatClock, formatStamp } from "@/lib/studio/format";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
  };
  return { copied, copy };
}

function CopyButton({ id, text, copied, copy }: { id: string; text: string } & ReturnType<typeof useCopy>) {
  return (
    <Button size="sm" variant="outline" onClick={() => copy(id, text)} className="border-white/15 bg-transparent">
      {copied === id ? <Check className="mr-1.5 h-4 w-4 text-emerald-400" /> : <Copy className="mr-1.5 h-4 w-4" />}
      {copied === id ? "Copiado" : "Copiar"}
    </Button>
  );
}

export function defaultChapterTitle(chapter: Chapter, index: number) {
  if (chapter.kind === "intro") return "Intro";
  if (chapter.kind === "highlight") return `Momento destacado #${chapter.highlightId}`;
  return `Parte ${index + 1}`;
}

interface ChaptersPanelProps {
  chapters: Chapter[];
  titles: Record<number, string>;
  onTitle: (time: number, title: string) => void;
  onSeek: (time: number) => void;
}

export function ChaptersPanel({ chapters, titles, onTitle, onSeek }: ChaptersPanelProps) {
  const clip = useCopy();
  const text = chapters.map((c, i) => `${formatClock(c.time)} ${titles[c.time] ?? defaultChapterTitle(c, i)}`).join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        {chapters.map((c, i) => (
          <div key={c.time} className="flex items-center gap-2">
            <button
              onClick={() => onSeek(c.time)}
              className="w-16 shrink-0 rounded-md bg-white/5 px-2 py-2 font-mono text-sm text-[#ff9f1c] hover:bg-white/10"
            >
              {formatClock(c.time)}
            </button>
            <Input
              value={titles[c.time] ?? defaultChapterTitle(c, i)}
              onChange={(e) => onTitle(c.time, e.target.value)}
              className="border-white/10 bg-white/5"
            />
          </div>
        ))}
        {chapters.length < 3 && (
          <p className="text-xs text-zinc-500">YouTube pide al menos 3 capítulos de 10 s: el video es demasiado corto.</p>
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-zinc-400">Pegalo en la descripción de YouTube</span>
          <CopyButton id="chapters" text={text} {...clip} />
        </div>
        <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-zinc-200">{text}</pre>
      </div>
    </div>
  );
}

interface ExportPanelProps {
  fileName: string;
  duration: number;
  highlights: Highlight[];
  chapters: { time: number; title: string }[];
  sensitivity: number;
}

export function ExportPanel({ fileName, duration, highlights, chapters, sensitivity }: ExportPanelProps) {
  const clip = useCopy();
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_");
  const ffmpeg = highlights
    .map(
      (h) =>
        `ffmpeg -ss ${formatStamp(h.start)} -to ${formatStamp(h.end)} -i "${fileName}" -c copy "${base}_clip${String(h.id).padStart(2, "0")}.mp4"`,
    )
    .join("\n");
  const json = JSON.stringify(
    {
      source: fileName,
      duration: Number(duration.toFixed(2)),
      sensitivity,
      highlights: highlights.map(({ id, start, end, peakTime, score }) => ({
        id,
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        peak: Number(peakTime.toFixed(2)),
        score,
      })),
      chapters,
    },
    null,
    2,
  );

  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.autoyt.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm text-zinc-400">Cortes sin recodificar (ffmpeg)</span>
          <CopyButton id="ffmpeg" text={ffmpeg} {...clip} />
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre font-mono text-xs leading-6 text-emerald-300">
          {ffmpeg || "# Sin highlights detectados"}
        </pre>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm text-zinc-400">Manifiesto para el pipeline</span>
          <div className="flex gap-2">
            <CopyButton id="json" text={json} {...clip} />
            <Button size="sm" variant="outline" onClick={downloadJson} className="border-white/15 bg-transparent">
              <Download className="mr-1.5 h-4 w-4" /> .json
            </Button>
          </div>
        </div>
        <pre className="max-h-72 overflow-auto font-mono text-xs leading-5 text-sky-300">{json}</pre>
      </div>
    </div>
  );
}
