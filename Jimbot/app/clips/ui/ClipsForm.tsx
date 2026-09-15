"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Download,
  Search,
  Grid3X3,
  List,
  Star,
  Share2,
  Upload,
} from "lucide-react";
import type { Clip } from "../hooks/useClips";

interface ClipsFormProps {
  filteredClips: Clip[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedType: Clip["type"] | "";
  setSelectedType: (v: Clip["type"] | "") => void;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  sortBy: "recent" | "views" | "rating";
  setSortBy: (v: "recent" | "views" | "rating") => void;
  formatDuration: (n: number) => string;
  formatViews: (n: number) => string;
  typeColors: Record<Clip["type"], string>;
  typeLabels: Record<Clip["type"], string>;
}

export function ClipsForm({
  filteredClips,
  searchTerm,
  setSearchTerm,
  selectedType,
  setSelectedType,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  formatDuration,
  formatViews,
  typeColors,
  typeLabels,
}: ClipsFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-rose-400">Galería de Clips</h1>
        <p className="text-gray-400">Explora y gestiona tus clips generados</p>
      </div>

      {/* Filtros y búsqueda */}
      <Card className="bg-zinc-800 border-zinc-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar clips por título o tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-zinc-700 border-zinc-600 text-gray-100"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-gray-100"
              >
                <option value="">Todos los tipos</option>
                <option value="gameplay">Gameplay</option>
                <option value="reaction">Reacción</option>
                <option value="highlight">Highlight</option>
                <option value="funny">Divertido</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-gray-100"
              >
                <option value="recent">Más recientes</option>
                <option value="views">Más vistas</option>
                <option value="rating">Mejor valorados</option>
              </select>
              <div className="flex border border-zinc-600 rounded-md overflow-hidden">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={
                    viewMode === "grid" ? "bg-rose-600" : "hover:bg-zinc-700"
                  }
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={
                    viewMode === "list" ? "bg-rose-600" : "hover:bg-zinc-700"
                  }
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ... aquí podrías mapear stats como en tu original usando `clips` */}
      </div>

      {/* Grid o Lista */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClips.map((clip) => (
            <Card
              key={clip.id}
              className="bg-zinc-800 border-zinc-700 hover:border-rose-500 group"
            >
              <div className="relative">
                <Image
                  src={clip.thumbnail}
                  alt={clip.title}
                  width={320}
                  height={180}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button size="sm" className="bg-rose-600 hover:bg-rose-700">
                    <Play className="h-4 w-4 mr-2" />
                    Reproducir
                  </Button>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white">
                  {formatDuration(clip.duration)}
                </div>
                <div className="absolute top-2 left-2">
                  <Badge className={`${typeColors[clip.type]} text-white`}>
                    {typeLabels[clip.type]}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-100 mb-2 line-clamp-2">
                  {clip.title}
                </h3>

                <div className="flex flex-wrap gap-1 mb-3">
                  {clip.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs border-zinc-600 text-gray-400"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                  <span>
                    {clip.views
                      ? `${formatViews(clip.views)} vistas`
                      : "Sin vistas"}
                  </span>
                  {clip.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{clip.rating}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-rose-600 hover:bg-rose-700"
                  >
                    <Play className="h-3 w-3 mr-1" /> Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-600 hover:bg-zinc-700"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-600 hover:bg-zinc-700"
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ... renderizado en lista similar al original ... */
        <div>/* LIST VIEW */</div>
      )}

      {filteredClips.length === 0 && (
        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-zinc-700 flex items-center justify-center">
              <Grid3X3 className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-300">
              No se encontraron clips
            </h3>
            <p className="text-gray-400">
              {searchTerm || selectedType
                ? "Intenta ajustar tus filtros de búsqueda"
                : "Aún no tienes clips generados. ¡Sube un video para comenzar!"}
            </p>
            {!searchTerm && !selectedType && (
              <Button className="bg-rose-600 hover:bg-rose-700">
                <Upload className="h-4 w-4 mr-2" /> Subir Video
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
