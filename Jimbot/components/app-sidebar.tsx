import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Upload,
  Scissors,
  Activity,
  Grid3X3,
  Film,
  Monitor,
  ImageIcon,
  Youtube,
  FileText,
  BarChart3,
  Settings,
  User,
  Circle,
} from "lucide-react";
import Link from "next/link";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  dev: boolean;
}

const menuItems: MenuItem[] = [
  {
    title: "Upload",
    url: "/upload",
    icon: Upload,
    dev: false,
  },
  {
    title: "Tipo de Edición",
    url: "/edit-type",
    icon: Scissors,
    dev: true,
  },
  {
    title: "Procesamiento",
    url: "/processing",
    icon: Activity,
    dev: true,
  },
  {
    title: "Galería de Clips",
    url: "/clips",
    icon: Grid3X3,
    dev: true,
  },
  {
    title: "Videos",
    url: "/videos",
    icon: Film,
    dev: false,
  },
  {
    title: "Editor de Ritmo",
    url: "/editor",
    icon: Film,
    dev: true,
  },
  {
    title: "Conversión",
    url: "/conversion",
    icon: Monitor,
    dev: true,
  },
  {
    title: "Miniaturas IA",
    url: "/thumbnails",
    icon: ImageIcon,
    dev: true,
  },
  {
    title: "YouTube",
    url: "/youtube",
    icon: Youtube,
    dev: true,
  },
  {
    title: "Transcripciones",
    url: "/transcriptions",
    icon: FileText,
    dev: true,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    dev: true,
  },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-slate-700">
      <SidebarHeader className="border-b border-slate-700 p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-600 flex items-center justify-center">
            <Film className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-cyan-400">VOD Editor</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-400">
            Herramientas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(({ title, url, icon: Icon, dev }) => (
                <SidebarMenuItem key={title}>
                  <SidebarMenuButton
                    asChild
                    className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800 hover:text-cyan-400"
                  >
                    <Link href={url}>
                      <Icon className="h-4 w-4" />
                      <span className="flex items-center">
                        {title}
                        {dev && (
                          <Circle className="ml-1 h-2 w-2 text-yellow-400">
                            <title>Maqueta visual</title>
                          </Circle>
                        )}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-700 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800">
              <User className="h-4 w-4" />
              <span>Perfil</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-800">
              <Settings className="h-4 w-4" />
              <span>Configuración</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
