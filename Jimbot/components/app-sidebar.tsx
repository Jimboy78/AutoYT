"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AudioWaveform,
  BarChart3,
  FileText,
  Film,
  Grid3X3,
  Home,
  ImageIcon,
  Monitor,
  Scissors,
  Sparkles,
  Upload,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/brand/logo";
import { API_CONFIGURED } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const createItems: MenuItem[] = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Studio", url: "/studio", icon: Sparkles },
  { title: "Editor de Ritmo", url: "/editor", icon: AudioWaveform },
  { title: "Conversión", url: "/conversion", icon: Monitor },
  { title: "Transcripciones", url: "/transcriptions", icon: FileText },
  { title: "Miniaturas", url: "/thumbnails", icon: ImageIcon },
  { title: "YouTube", url: "/youtube", icon: Youtube },
];

const libraryItems: MenuItem[] = [
  { title: "Galería de Clips", url: "/clips", icon: Grid3X3 },
  { title: "Tipo de Edición", url: "/edit-type", icon: Scissors },
  { title: "Procesamiento", url: "/processing", icon: Activity },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

// Screens backed by the FastAPI service (NEXT_PUBLIC_API_BASE).
const serverItems: MenuItem[] = [
  { title: "Upload", url: "/upload", icon: Upload },
  { title: "Videos", url: "/videos", icon: Film },
];

function NavGroup({ label, items, badge }: { label: string; items: MenuItem[]; badge?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between text-zinc-500">
        {label} {badge}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(({ title, url, icon: Icon }) => {
            const active = url === "/" ? pathname === "/" : pathname.startsWith(url);
            return (
              <SidebarMenuItem key={url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className={cn(
                    "rounded-lg transition-colors hover:bg-white/5 hover:text-white",
                    active && "bg-gradient-to-r from-[#ff2e63]/20 to-transparent text-white",
                  )}
                >
                  <Link href={url}>
                    <Icon className={cn("h-4 w-4", active && "text-[#ff6b8b]")} />
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-white/5">
      <SidebarHeader className="border-b border-white/5 p-4">
        <Link href="/">
          <Logo />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup
          label="Crear"
          items={createItems}
          badge={
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> en tu navegador
            </span>
          }
        />
        <NavGroup label="Biblioteca" items={libraryItems} />
        <NavGroup
          label="Servidor"
          items={serverItems}
          badge={
            <span className={cn("text-[10px]", API_CONFIGURED ? "text-emerald-400" : "text-yellow-400/80")}>
              {API_CONFIGURED ? "conectado" : "requiere API"}
            </span>
          }
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-4">
        <p className="text-xs leading-relaxed text-zinc-500">
          Tus videos, renders y transcripciones quedan en este navegador (IndexedDB). El backend FastAPI es opcional.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
