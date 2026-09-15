"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Captions, CheckCircle2, Download, Loader2, Play, Scissors, TriangleAlert, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/studio/common";
import {
  apiAsset,
  createTranscription,
  downloadAsset,
  downloadSRT,
  downloadVTT,
  getTranscription,
  getVideo,
  listClips,
  listJobs,
  processVideo,
  type Clip,
  type Job,
  type Transcription,
  type Video,
} from "@/lib/api";
import { formatClock } from "@/lib/studio/format";
import { cn } from "@/lib/utils";

const JOB_LABEL: Record<string, string> = { transcoding: "Transcodificación (ffmpeg)", clipping: "Momentos y cortes", thumbnails: "Miniaturas", upload: "Subida" };

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const playerRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"process" | "transcribe" | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  // Video + clips, refreshed while jobs run so new clips appear as soon as the pipeline stores them.
  const running = jobs.some((j) => j.status === "pending" || j.status === "processing");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [v, c] = await Promise.all([getVideo(id), listClips(id)]);
        if (cancelled) return;
        setVideo(v);
        setClips(c);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    if (!running) return () => void (cancelled = true);
    const timer = setInterval(load, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, running]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const all = await listJobs();
        const order = ["upload", "transcoding", "clipping", "thumbnails"];
        if (!cancelled) setJobs(all.filter((j) => j.video_id === id).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)));
      } catch {
        // The page still shows the video; the jobs panel just stays empty.
      }
    };
    void tick();
    const timer = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  // Only ask for the transcription once the server says one exists (or the user just started one):
  // a never-transcribed video would otherwise answer 404 on every visit.
  const hasTranscription = !!video?.transcription_status;
  useEffect(() => {
    if (!hasTranscription && busy !== "transcribe") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const tr = await getTranscription(id);
        if (cancelled) return;
        setTranscription(tr);
        if (tr.status === "pending" || tr.status === "processing") timer = setTimeout(poll, 1500);
      } catch {
        if (!cancelled) setTranscription(null);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, busy, hasTranscription]);

  const run = async (kind: "process" | "transcribe") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "process") await processVideo(id);
      else await createTranscription(id, "es");
      // Picks up the new transcription_status so the transcript keeps polling after `busy` clears.
      setVideo(await getVideo(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const seek = (time: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = time;
    void player.play().catch(() => undefined);
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }
  if (!video) return <Panel className="mx-auto max-w-3xl text-sm text-red-300">{error ?? "Video no encontrado"}</Panel>;

  const transcribing = transcription?.status === "pending" || transcription?.status === "processing";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/videos" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Videos
      </Link>
      <PageHeader
        eyebrow="Servidor"
        title={video.filename.toUpperCase()}
        description={`${video.duration ? formatClock(video.duration) : "—"} · estado: ${video.status}`}
        actions={
          <Button onClick={() => run("process")} disabled={running || busy !== null} className="bg-gradient-to-r from-violet-500 to-[#ff2e63] text-white" data-testid="server-process">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {clips.length ? "Reprocesar" : "Procesar"}
          </Button>
        }
      />
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <video ref={playerRef} src={apiAsset(video.url)} controls playsInline className="aspect-video w-full rounded-2xl border border-white/10 bg-black" />

          <Panel className="space-y-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
              <Scissors className="h-3.5 w-3.5" /> Clips detectados ({clips.length})
            </p>
            {clips.length === 0 ? (
              <p className="text-sm text-zinc-500">{running ? "El pipeline está trabajando…" : "Procesá el video para detectar y cortar sus momentos."}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="server-clips">
                {clips.map((c, i) => (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/30" data-testid="server-clip">
                    <div className="relative aspect-video bg-zinc-900">
                      {playing === c.id && c.url ? (
                        <video src={apiAsset(c.url)} autoPlay controls playsInline className="h-full w-full object-contain" />
                      ) : (
                        <button onClick={() => setPlaying(c.id)} className="group h-full w-full" aria-label={`Reproducir clip ${i + 1}`}>
                          {c.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={apiAsset(c.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <Play className="h-8 w-8 text-white" />
                          </span>
                        </button>
                      )}
                      {c.score != null && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-[#ff2e63] px-1.5 font-mono text-[11px] font-bold text-white">{Math.round(c.score)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2.5 text-xs">
                      <button onClick={() => seek(c.start)} className="font-mono text-zinc-300 hover:text-white">
                        {formatClock(c.start)} → {formatClock(c.end)}
                      </button>
                      {c.url && (
                        <button
                          onClick={() => downloadAsset(c.url!, `${video.filename.replace(/\.[^.]+$/, "")}_clip${String(i + 1).padStart(2, "0")}.mp4`).catch((e) => setError(e instanceof Error ? e.message : String(e)))}
                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"
                          aria-label={`Descargar clip ${i + 1}`}
                        >
                          <Download className="h-3.5 w-3.5" /> MP4
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Procesamiento</p>
            {jobs.length === 0 ? (
              <p className="text-sm text-zinc-500">Sin tareas todavía.</p>
            ) : (
              <ul className="space-y-3" data-testid="server-jobs">
                {jobs.map((j) => (
                  <li key={j.id} className="space-y-1" data-status={j.status} data-type={j.type}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        {j.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : j.status === "error" ? <TriangleAlert className="h-3.5 w-3.5 text-red-400" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />}
                        {JOB_LABEL[j.type] ?? j.type}
                      </span>
                      <span className="font-mono text-zinc-400">{Math.round(j.progress)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={cn("h-full rounded-full transition-[width]", j.status === "error" ? "bg-red-400" : "bg-gradient-to-r from-violet-500 to-[#ff2e63]")} style={{ width: `${Math.max(2, Math.min(100, j.progress))}%` }} />
                    </div>
                    {j.error && <p className="line-clamp-3 text-[11px] text-red-300">{j.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                <Captions className="h-3.5 w-3.5" /> Transcripción
              </p>
              {transcription?.model && <span className="font-mono text-[10px] text-zinc-500">faster-whisper · {transcription.model}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => run("transcribe")} disabled={transcribing || busy !== null} className="bg-sky-500 text-black hover:bg-sky-400" data-testid="server-transcribe">
                {transcribing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {transcribing ? `Transcribiendo · ${transcription?.segments.length ?? 0} frases` : transcription ? "Regenerar" : "Transcribir"}
              </Button>
              {transcription?.status === "completed" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => downloadSRT(id)} className="border-white/15 bg-transparent">SRT</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadVTT(id)} className="border-white/15 bg-transparent">VTT</Button>
                </>
              )}
            </div>
            {transcription?.status === "error" && <p className="text-xs text-red-300">{transcription.error ?? "La transcripción falló."}</p>}
            {transcription && transcription.segments.length > 0 && (
              <ol className="max-h-96 space-y-1 overflow-y-auto pr-1" data-testid="server-segments">
                {transcription.segments.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => seek(s.start)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
                      <span className="mr-2 font-mono text-[11px] text-sky-300">{formatClock(s.start)}</span>
                      {s.text}
                      <span className="ml-2 font-mono text-[10px] text-zinc-600">{Math.round(s.confidence * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
