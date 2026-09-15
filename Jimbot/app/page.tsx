import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Cloud,
  Cpu,
  Flame,
  Github,
  ImageIcon,
  ListVideo,
  Lock,
  Scissors,
  Server,
  Terminal,
  Upload,
  Youtube,
} from "lucide-react";

// Deterministic pseudo-waveform for the hero (decorative, same on server and client).
const BARS = Array.from({ length: 72 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.37) * 0.55 + Math.sin(i * 1.31) * 0.3) + 0.12;
  return Math.min(1, v);
});
const HOT = [
  [14, 22],
  [38, 47],
  [58, 64],
];

const STUDIO_STEPS = [
  {
    icon: AudioLines,
    title: "Energía de audio",
    text: "Web Audio decodifica la pista y mide el nivel RMS en ventanas de 50 ms.",
  },
  {
    icon: Flame,
    title: "Detección robusta",
    text: "z-score con mediana y MAD: los picos se miden contra la base del propio video, no contra un umbral fijo.",
  },
  {
    icon: ImageIcon,
    title: "Frames puntuados",
    text: "Canvas extrae frames de cada pico y los ordena por brillo, contraste y colorido.",
  },
  {
    icon: Terminal,
    title: "Export listo",
    text: "Capítulos para la descripción de YouTube, cortes ffmpeg sin recodificar y un manifiesto JSON.",
  },
];

const PIPELINE = [
  { icon: Upload, title: "Upload presignado", text: "init → PUT directo a S3/MinIO → confirm", href: "/upload" },
  { icon: Cpu, title: "Workers Celery", text: "transcode, normalización y detección en cola", href: "/processing" },
  { icon: Scissors, title: "Clips", text: "cortes por evento y galería de revisión", href: "/clips" },
  { icon: Captions, title: "Transcripción", text: "SRT / VTT por video", href: "/transcriptions" },
  { icon: Youtube, title: "Publicación", text: "metadatos y subida a YouTube", href: "/youtube" },
];

export default function HomePage() {
  return (
    <div className="-m-6 overflow-hidden">
      {/* HERO */}
      <section className="relative px-6 pb-20 pt-14 md:px-12">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="glow pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] bg-[#ff2e63]/25" />
        <div className="glow pointer-events-none absolute -right-40 top-20 h-[460px] w-[460px] bg-violet-600/20" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              <Lock className="h-3.5 w-3.5 text-emerald-400" /> Studio 100% en el navegador · nada se sube
            </span>
            <h1 className="mt-6 font-display text-6xl leading-[0.92] tracking-wide md:text-7xl xl:text-8xl">
              DE VOD ETERNO
              <br />A <span className="text-gradient">HIGHLIGHTS</span>
              <br />EN SEGUNDOS.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-400">
              AutoYT encuentra los momentos más intensos de tu stream, arma los capítulos y te propone miniaturas. Un
              Studio que corre local y un pipeline FastAPI + Celery para procesar a escala.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/studio"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-6 py-3 font-semibold text-white shadow-[0_10px_40px_-10px_#ff2e63] transition-transform hover:-translate-y-0.5"
              >
                Abrir Studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 font-semibold text-zinc-200 transition-colors hover:bg-white/5"
              >
                Ver pipeline
              </a>
            </div>
          </div>

          {/* Timeline visual */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-[#0d0d16]/90 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <span className="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
                <span className="font-mono text-xs text-zinc-500">stream_2026-09-14.mp4 · 3:12:44</span>
              </div>

              <div className="relative flex h-40 items-end gap-[3px] overflow-hidden rounded-xl bg-black/40 px-2 pb-3">
                {HOT.map(([a, b]) => (
                  <div
                    key={a}
                    className="absolute inset-y-0 border-t-2 border-[#ff2e63] bg-gradient-to-b from-[#ff2e63]/30 to-transparent"
                    style={{ left: `${(a / BARS.length) * 100}%`, width: `${((b - a) / BARS.length) * 100}%` }}
                  />
                ))}
                {BARS.map((v, i) => {
                  const hot = HOT.some(([a, b]) => i >= a && i < b);
                  return (
                    <span
                      key={i}
                      className={`eq-bar relative flex-1 rounded-sm ${hot ? "bg-gradient-to-t from-[#ff2e63] to-[#ff9f1c]" : "bg-zinc-700"}`}
                      style={{ height: `${v * (hot ? 100 : 55)}%`, animationDelay: `${(i % 12) * 90}ms` }}
                    />
                  );
                })}
                <span className="scan absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_#fff]" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["#1", "0:41:12", "94"],
                  ["#2", "1:52:03", "88"],
                  ["#3", "2:31:40", "81"],
                ].map(([id, t, score], i) => (
                  <div
                    key={id}
                    className="float rounded-xl border border-white/10 bg-white/[0.04] p-3"
                    style={{ animationDelay: `${i * 400}ms` }}
                  >
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-[#ff2e63]/60 via-violet-600/40 to-[#ff9f1c]/50" />
                    <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                      <span className="text-zinc-300">
                        {id} {t}
                      </span>
                      <span className="text-[#ffe14d]">{score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="float absolute -bottom-6 -left-6 hidden rounded-2xl border border-white/10 bg-[#12121c] px-4 py-3 shadow-xl md:block">
              <p className="font-mono text-xs text-zinc-500">capítulos.txt</p>
              <p className="font-mono text-sm text-zinc-200">0:00 Intro</p>
              <p className="font-mono text-sm text-[#ff9f1c]">41:12 Clutch 1v4</p>
            </div>
          </div>
        </div>
      </section>

      {/* STUDIO STEPS */}
      <section className="border-y border-white/5 bg-white/[0.02] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs uppercase tracking-[0.25em] text-[#ff6b8b]">Cómo funciona el Studio</p>
          <h2 className="mt-2 font-display text-4xl tracking-wide md:text-5xl">PROCESAMIENTO REAL, EN TU PESTAÑA</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STUDIO_STEPS.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-white/10 bg-[#0d0d16] p-6 transition-all hover:-translate-y-1 hover:border-[#ff2e63]/40"
              >
                <span className="absolute right-5 top-4 font-display text-5xl text-white/5 transition-colors group-hover:text-[#ff2e63]/20">
                  0{i + 1}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff2e63] to-[#ff9f1c]">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section id="pipeline" className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-violet-400">Backend</p>
              <h2 className="mt-2 font-display text-4xl tracking-wide md:text-5xl">EL PIPELINE A ESCALA</h2>
              <p className="mt-2 max-w-2xl text-zinc-400">
                FastAPI + SQLAlchemy + Celery/Redis con almacenamiento S3-compatible. Estas pantallas se conectan a la API
                cuando corre (<code className="font-mono text-zinc-300">NEXT_PUBLIC_API_BASE</code>).
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-300">
              <Server className="h-3.5 w-3.5" /> Requiere backend
            </span>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-5">
            {PIPELINE.map(({ icon: Icon, title, text, href }, i) => (
              <Link
                key={title}
                href={href}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-violet-500/50"
              >
                {i < PIPELINE.length - 1 && (
                  <span className="absolute -right-2 top-1/2 z-10 hidden h-0.5 w-4 bg-gradient-to-r from-violet-500 to-transparent md:block" />
                )}
                <Icon className="h-6 w-6 text-violet-400" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-zinc-500">{text}</p>
              </Link>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-[#ff2e63]/15 via-violet-600/10 to-[#ff9f1c]/15 p-8">
            <div>
              <h3 className="font-display text-3xl tracking-wide">PROBALO CON TU PROPIO VIDEO</h3>
              <p className="mt-1 text-zinc-400">O usá el VOD de ejemplo: 40 segundos con tres picos de audio.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-black transition-transform hover:-translate-y-0.5"
              >
                <ListVideo className="h-4 w-4" /> Abrir Studio
              </Link>
              <a
                href="https://github.com/Jimboy78/AutoYT"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold transition-colors hover:bg-white/5"
              >
                <Github className="h-4 w-4" /> Código
              </a>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2 text-xs text-zinc-500">
            {["Next.js 15", "React 19", "Web Audio API", "Canvas 2D", "FastAPI", "Celery", "Redis", "S3 / MinIO", "ffmpeg"].map(
              (t) => (
                <span key={t} className="rounded-full border border-white/10 px-3 py-1">
                  {t}
                </span>
              ),
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1">
              <Cloud className="h-3 w-3" /> Vercel
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
