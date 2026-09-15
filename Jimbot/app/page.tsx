import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Scissors, Activity, Grid3X3 } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyan-400">Bienvenido a VOD Editor Pro</h1>
        <p className="text-gray-400">Plataforma profesional para edición de VODs y highlights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700 hover:border-cyan-500 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Upload className="h-5 w-5" />
              Upload
            </CardTitle>
            <CardDescription className="text-gray-400">Sube tus archivos de video</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-cyan-600 hover:bg-cyan-700">
              <Link href="/upload">Comenzar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 hover:border-cyan-500 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Scissors className="h-5 w-5" />
              Edición
            </CardTitle>
            <CardDescription className="text-gray-400">Configura el tipo de edición</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-600 hover:text-white"
            >
              <Link href="/edit-type">Configurar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 hover:border-cyan-500 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Activity className="h-5 w-5" />
              Procesamiento
            </CardTitle>
            <CardDescription className="text-gray-400">Monitorea el progreso</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-600 hover:text-white"
            >
              <Link href="/processing">Ver Estado</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 hover:border-cyan-500 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Grid3X3 className="h-5 w-5" />
              Clips
            </CardTitle>
            <CardDescription className="text-gray-400">Explora clips generados</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-600 hover:text-white"
            >
              <Link href="/clips">Ver Galería</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-cyan-400">Estadísticas Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Videos procesados</span>
              <span className="font-semibold">24</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Clips generados</span>
              <span className="font-semibold">156</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tiempo ahorrado</span>
              <span className="font-semibold">48h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-cyan-400">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">Video_gameplay_01.mp4</div>
              <div className="text-gray-400">Procesado hace 2 horas</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Reaction_stream_05.mkv</div>
              <div className="text-gray-400">Subido hace 4 horas</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Highlights_compilation.mp4</div>
              <div className="text-gray-400">Publicado en YouTube</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-cyan-400">Próximas Funciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <div className="font-medium">IA Mejorada</div>
              <div className="text-gray-400">Detección de momentos épicos</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Colaboración</div>
              <div className="text-gray-400">Edición en equipo</div>
            </div>
            <div className="text-sm">
              <div className="font-medium">Más Plataformas</div>
              <div className="text-gray-400">TikTok, Instagram, Twitch</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
