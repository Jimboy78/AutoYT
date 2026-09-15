"use client";

import { useState, useCallback } from "react";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  status: "draft" | "scheduled" | "published" | "processing";
  scheduledDate?: Date;
  views?: number;
  likes?: number;
  comments?: number;
}

export function useYouTube() {
  const [isConnected, setIsConnected] = useState(false);
  const [channelInfo, setChannelInfo] = useState({
    name: "",
    subscribers: 0,
    totalViews: 0,
  });
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoTags, setVideoTags] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedThumbnail, setSelectedThumbnail] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);

  const connectToYouTube = useCallback(() => {
    // Simular OAuth2
    setTimeout(() => {
      setIsConnected(true);
      setChannelInfo({
        name: "Mi Canal Gaming",
        subscribers: 15420,
        totalViews: 2840000,
      });
    }, 2000);
  }, []);

  const generateSEOTitle = useCallback(() => {
    const seoTitles = [
      "🔥 ÉPICA JUGADA que NO CREERÁS | Highlights Gaming",
      "REACCIÓN INCREÍBLE a este MOMENTO ÉPICO 😱",
      "TOP 5 MEJORES JUGADAS | Compilation 2024",
      "¡NO PUEDE SER! La jugada MÁS LOCA del año",
      "HIGHLIGHTS que te harán GRITAR | Gaming Moments",
    ];
    setVideoTitle(seoTitles[Math.floor(Math.random() * seoTitles.length)]);
  }, []);

  const generateDescription = useCallback(() => {
    const description = `🎮 ¡Bienvenidos a otro épico video de gaming!

En este video verás:
• 00:00 - Introducción
• 00:30 - Momento épico #1
• 01:15 - Reacción increíble
• 02:00 - Jugada del siglo
• 02:45 - Conclusiones

🔔 ¡No olvides suscribirte y activar la campanita!
👍 Dale like si te gustó el video
💬 Déjame tu opinión en los comentarios

🎯 Sígueme en mis redes:
• Twitch: twitch.tv/micanal
• Twitter: @micanal
• Discord: discord.gg/micanal

#Gaming #Highlights #Epic #Gameplay #Reaction

¡Gracias por ver el video! 🚀`;
    setVideoDescription(description);
  }, []);

  const uploadToYouTube = useCallback(() => {
    if (!videoTitle || !videoDescription) return;

    setIsUploading(true);
    setUploadProgress(0);

    const newVideo: YouTubeVideo = {
      id: Date.now().toString(),
      title: videoTitle,
      description: videoDescription,
      thumbnail: selectedThumbnail || "/placeholder.svg?height=180&width=320",
      status: "processing",
    };

    if (scheduledDate && scheduledTime) {
      newVideo.status = "scheduled";
      newVideo.scheduledDate = new Date(`${scheduledDate}T${scheduledTime}`);
    }

    setVideos((prev) => [newVideo, ...prev]);

    const interval = setInterval(() => {
      setUploadProgress((prevProg) => {
        const next = Math.min(prevProg + Math.random() * 10, 100);
        if (next >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadProgress(0);
          setVideos((prevVid) =>
            prevVid.map((v) =>
              v.id === newVideo.id
                ? {
                    ...v,
                    status:
                      scheduledDate && scheduledTime
                        ? "scheduled"
                        : "published",
                    views: Math.floor(Math.random() * 1000),
                    likes: Math.floor(Math.random() * 100),
                    comments: Math.floor(Math.random() * 50),
                  }
                : v
            )
          );
          // limpiar form
          setVideoTitle("");
          setVideoDescription("");
          setVideoTags("");
          setScheduledDate("");
          setScheduledTime("");
        }
        return next;
      });
    }, 300);
  }, [
    videoTitle,
    videoDescription,
    selectedThumbnail,
    scheduledDate,
    scheduledTime,
  ]);

  const formatNumber = useCallback((n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }, []);

  const getStatusColor = useCallback((status: YouTubeVideo["status"]) => {
    switch (status) {
      case "published":
        return "bg-green-500";
      case "scheduled":
        return "bg-blue-500";
      case "processing":
        return "bg-yellow-500";
      case "draft":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  }, []);

  const getStatusLabel = useCallback((status: YouTubeVideo["status"]) => {
    switch (status) {
      case "published":
        return "Publicado";
      case "scheduled":
        return "Programado";
      case "processing":
        return "Procesando";
      case "draft":
        return "Borrador";
      default:
        return "Desconocido";
    }
  }, []);

  return {
    // estados
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
    // setters
    setVideoTitle,
    setVideoDescription,
    setVideoTags,
    setScheduledDate,
    setScheduledTime,
    setSelectedThumbnail,
    // acciones
    connectToYouTube,
    generateSEOTitle,
    generateDescription,
    uploadToYouTube,
    formatNumber,
    getStatusColor,
    getStatusLabel,
  };
}
