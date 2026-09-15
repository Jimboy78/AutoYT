"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  getVideo,
  listClips,
  listJobs,
  createTranscription,
  getTranscription,
  downloadSRT,
  downloadVTT,
  type Clip,
  type Video,
  type Job,
} from "@/lib/api";

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [video, setVideo] = useState<Video | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingTr, setCreatingTr] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [v, c] = await Promise.all([getVideo(id), listClips(id)]);
        if (cancelled) return;
        setVideo(v);
        setClips(c);
      } catch (e: any) {
        setError(e?.message || "Error cargando video");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const js = await listJobs();
        if (cancelled) return;
        setJobs(js.filter((j) => j.video_id === id));
      } catch {}
    };
    const iv = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [id]);

  useEffect(() => {
    let timer: any;
    const poll = async () => {
      try {
        const tr = await getTranscription(id);
        setTranscriptionStatus(tr.status);
      } catch {
        setTranscriptionStatus(null);
      }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [id]);

  const jobSummary = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const j of jobs) {
      map[j.type] = map[j.type] ? [...map[j.type], j] : [j];
    }
    return map;
  }, [jobs]);

  const startTranscription = async () => {
    setCreatingTr(true);
    try {
      await createTranscription(id, "es");
    } finally {
      setCreatingTr(false);
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!video) return <div className="p-6">No encontrado</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold break-words">{video.filename}</h1>
        <p className="text-sm text-muted-foreground">
          {video.duration ? `${video.duration.toFixed(1)}s` : "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <video src={video.url} controls className="w-full rounded border" />

          <section>
            <h2 className="font-semibold mb-2">Clips</h2>
            {clips.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin clips aún.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {clips.map((c) => (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block border rounded overflow-hidden"
                  >
                    {c.thumbnail_url ? (
                      <img
                        src={c.thumbnail_url}
                        alt="thumb"
                        className="w-full aspect-video object-cover"
                      />
                    ) : (
                      <div className="aspect-video flex items-center justify-center text-xs text-muted-foreground">
                        sin miniatura
                      </div>
                    )}
                    <div className="p-2 text-xs">
                      {c.start.toFixed(1)}s → {c.end.toFixed(1)}s
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border rounded p-3">
            <h2 className="font-semibold mb-2">Procesamiento</h2>
            <ul className="space-y-2">
              {Object.entries(jobSummary).map(([type, list]) => (
                <li key={type} className="text-sm">
                  <div className="capitalize font-medium">{type}</div>
                  {list.map((j) => (
                    <div key={j.id} className="flex items-center gap-2">
                      <div className="w-full bg-muted h-2 rounded">
                        <div
                          className="bg-primary h-2 rounded"
                          style={{
                            width: `${Math.max(0, Math.min(100, j.progress))}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs w-12 text-right">
                        {j.progress.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </li>
              ))}
              {jobs.length === 0 && (
                <li className="text-sm text-muted-foreground">Sin tareas.</li>
              )}
            </ul>
          </section>

          <section className="border rounded p-3">
            <h2 className="font-semibold mb-2">Transcripción</h2>
            <div className="text-sm mb-2">
              Estado: {transcriptionStatus ?? "no creada"}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-sm rounded border"
                onClick={startTranscription}
                disabled={creatingTr}
              >
                {creatingTr ? "Creando…" : "Crear/Regenerar"}
              </button>
              <button
                className="px-3 py-1 text-sm rounded border"
                onClick={() => downloadSRT(id)}
              >
                Descargar SRT
              </button>
              <button
                className="px-3 py-1 text-sm rounded border"
                onClick={() => downloadVTT(id)}
              >
                Descargar VTT
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
