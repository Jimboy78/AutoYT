import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Anton, Inter, JetBrains_Mono } from "next/font/google"
import { Github, Sparkles } from "lucide-react"
import "./globals.css"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Logo } from "@/components/brand/logo"

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" })
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "AutoYT — highlights, capítulos y miniaturas para tus VODs",
  description:
    "Detecta los mejores momentos de un VOD por la energía del audio, genera capítulos de YouTube y propone miniaturas. Studio en el navegador + pipeline FastAPI/Celery.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`dark ${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />
          <SidebarInset className="bg-background">
            <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-background/80 px-4 backdrop-blur-xl">
              <SidebarTrigger className="-ml-1" />
              <Link href="/" className="md:hidden">
                <Logo />
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <a
                  href="https://github.com/Jimboy78/AutoYT"
                  target="_blank"
                  rel="noreferrer"
                  className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white sm:flex"
                >
                  <Github className="h-4 w-4" /> GitHub
                </a>
                <Link
                  href="/studio"
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ff2e63] to-[#ff9f1c] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_6px_24px_-8px_#ff2e63] transition-transform hover:-translate-y-0.5"
                >
                  <Sparkles className="h-4 w-4" /> Studio
                </Link>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}
