"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
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
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const liveItems: MenuItem[] = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Studio", url: "/studio", icon: Sparkles },
];

// Screens that talk to the FastAPI backend (NEXT_PUBLIC_API_BASE).
const pipelineItems: MenuItem[] = [
  { title: "Upload", url: "/upload", icon: Upload },
  { title: "Videos", url: "/videos", icon: Film },
  { title: "Tipo de Edición", url: "/edit-type", icon: Scissors },
  { title: "Procesamiento", url: "/processing", icon: Activity },
  { title: "Galería de Clips", url: "/clips", icon: Grid3X3 },
  { title: "Editor de Ritmo", url: "/editor", icon: Film },
  { title: "Conversión", url: "/conversion", icon: Monitor },
  { title: "Miniaturas IA", url: "/thumbnails", icon: ImageIcon },
  { title: "YouTube", url: "/youtube", icon: Youtube },
  { title: "Transcripciones", url: "/transcriptions", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

function NavGroup({ label, items, badge }: { label: string; items: MenuItem[]; badge: React.ReactNode }) {
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
          label="En vivo"
          items={liveItems}
          badge={
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> local
            </span>
          }
        />
        <NavGroup
          label="Pipeline"
          items={pipelineItems}
          badge={<span className="text-[10px] text-yellow-400/80">requiere API</span>}
        />
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-4">
        <p className="text-xs leading-relaxed text-zinc-500">
          El Studio analiza en tu navegador. El pipeline usa FastAPI + Celery.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
