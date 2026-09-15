"use client";
import { useEffect, useState } from "react";
import { listVideos, type Video } from "@/lib/api";

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await listVideos();
        setVideos(res);
      } catch (e: any) {
        setError(e?.message || "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6">Cargando…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Videos</h1>
      {videos.length === 0 ? (
        <p className="text-muted-foreground">No hay videos aún.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <li key={v.id} className="border rounded-lg p-4">
              <div className="font-medium break-words">{v.filename}</div>
              <div className="text-sm text-muted-foreground">
                {v.duration ? `${v.duration.toFixed(1)}s` : "—"}
              </div>
              <a
                className="text-primary underline"
                href={`/videos/${encodeURIComponent(v.id)}`}
              >
                Ver detalles
              </a>
              <div className="mt-2">
                <a
                  className="text-primary underline"
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver archivo
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
