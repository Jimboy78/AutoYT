"use client";

import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Youtube,
  LinkIcon,
  Calendar,
  Eye,
  Upload,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Hash,
  FileText,
  ImageIcon,
} from "lucide-react";
import type { YouTubeVideo } from "../hooks/useYouTube";

interface YouTubeFormProps {
  // estados
  isConnected: boolean;
  channelInfo: { name: string; subscribers: number; totalViews: number };
  videoTitle: string;
  videoDescription: string;
  videoTags: string;
  scheduledDate: string;
  scheduledTime: string;
  selectedThumbnail: string;
  isUploading: boolean;
  uploadProgress: number;
  videos: YouTubeVideo[];
  // setters
  setVideoTitle: (v: string) => void;
  setVideoDescription: (v: string) => void;
  setVideoTags: (v: string) => void;
  setScheduledDate: (v: string) => void;
  setScheduledTime: (v: string) => void;
  setSelectedThumbnail: (v: string) => void;
  // acciones
  connectToYouTube: () => void;
  generateSEOTitle: () => void;
  generateDescription: () => void;
  uploadToYouTube: () => void;
  formatNumber: (n: number) => string;
  getStatusColor: (s: YouTubeVideo["status"]) => string;
  getStatusLabel: (s: YouTubeVideo["status"]) => string;
}

export function YouTubeForm({
  isConnected,
  channelInfo,
  videoTitle,
  videoDescription,
  videoTags,
  scheduledDate,
  scheduledTime,
  selectedThumbnail,
  isUploading,
  uploadProgress,
  videos,
  setVideoTitle,
  setVideoDescription,
  setVideoTags,
  setScheduledDate,
  setScheduledTime,
  setSelectedThumbnail,
  connectToYouTube,
  generateSEOTitle,
  generateDescription,
  uploadToYouTube,
  formatNumber,
  getStatusColor,
  getStatusLabel,
}: YouTubeFormProps) {
  return (
    <div className="space-y-6">
      {/* ... aquí va TODO tu JSX original, usando las props en lugar de hooks */}
      {/* Por ejemplo: */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyan-400">
          Integración YouTube
        </h1>
        <p className="text-gray-400">
          Conecta tu canal y publica directamente a YouTube
        </p>
      </div>

      {/* Conexión */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-400">
            <Youtube className="h-5 w-5" />
            Estado de Conexión
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="text-center py-8">
              {/* ... */}
              <Button
                onClick={connectToYouTube}
                className="bg-red-600 hover:bg-red-700"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Conectar Canal YouTube
              </Button>
            </div>
          ) : (
            /* ... info del canal ... */
            <div className="space-y-4">
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-400">
                  Canal conectado exitosamente
                </AlertDescription>
              </Alert>
              {/* ... cards con channelInfo ... */}
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario & Preview & Configuración */}
          {/* Usa todas las props y handlers que recibes */}
        </div>
      )}

      {/* Lista de videos */}
      {videos.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          {/* ... map videos usando formatNumber, getStatusColor, getStatusLabel ... */}
        </Card>
      )}
    </div>
  );
}
