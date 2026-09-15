"use client";

import React, { useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Clock,
  ThumbsUp,
  MessageSquare,
  Share2,
  Bell,
  Target,
  Award,
} from "lucide-react";

export interface VideoMetrics {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  watchTime: number;
  likes: number;
  comments: number;
  shares: number;
  ctr: number;
  avgViewDuration: number;
  publishDate: Date;
  trending?: boolean;
}

export interface Alert {
  id: string;
  type: "milestone" | "trending" | "engagement" | "performance";
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  videoId?: string;
}

const videoMetrics: VideoMetrics[] = [
  {
    id: "1",
    title: "ÉPICA JUGADA que NO CREERÁS",
    thumbnail: "/placeholder.svg?height=90&width=160",
    views: 15420,
    watchTime: 8640,
    likes: 1250,
    comments: 89,
    shares: 45,
    ctr: 8.5,
    avgViewDuration: 3.2,
    publishDate: new Date("2024-01-15"),
    trending: true,
  },
  {
    id: "2",
    title: "Reacción INCREÍBLE a Jump Scare",
    thumbnail: "/placeholder.svg?height=90&width=160",
    views: 8930,
    watchTime: 4200,
    likes: 890,
    comments: 156,
    shares: 23,
    ctr: 6.2,
    avgViewDuration: 2.8,
    publishDate: new Date("2024-01-14"),
  },
  {
    id: "3",
    title: "Clutch 1v5 IMPOSIBLE",
    thumbnail: "/placeholder.svg?height=90&width=160",
    views: 22100,
    watchTime: 12500,
    likes: 1890,
    comments: 234,
    shares: 78,
    ctr: 12.3,
    avgViewDuration: 4.1,
    publishDate: new Date("2024-01-13"),
    trending: true,
  },
];

const alertsData: Alert[] = [
  {
    id: "1",
    type: "milestone",
    title: "¡10K visualizaciones alcanzadas!",
    description:
      "Tu video 'ÉPICA JUGADA que NO CREERÁS' ha superado las 10,000 visualizaciones",
    timestamp: new Date(Date.now() - 3600000),
    isRead: false,
    videoId: "1",
  },
  {
    id: "2",
    type: "trending",
    title: "Video en tendencia",
    description: "Tu video 'Clutch 1v5 IMPOSIBLE' está en tendencia en Gaming",
    timestamp: new Date(Date.now() - 7200000),
    isRead: false,
    videoId: "3",
  },
  {
    id: "3",
    type: "engagement",
    title: "Alto engagement detectado",
    description: "CTR del 12.3% en tu último video - ¡Excelente miniatura!",
    timestamp: new Date(Date.now() - 10800000),
    isRead: true,
    videoId: "3",
  },
];

export function useAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d">(
    "30d"
  );
  const [unreadAlerts, setUnreadAlerts] = useState<Alert[]>(
    alertsData.filter((a) => !a.isRead)
  );
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const totalViews = useMemo(
    () => videoMetrics.reduce((sum, v) => sum + v.views, 0),
    []
  );
  const totalWatchTime = useMemo(
    () => videoMetrics.reduce((sum, v) => sum + v.watchTime, 0),
    []
  );
  const avgCTR = useMemo(
    () => videoMetrics.reduce((sum, v) => sum + v.ctr, 0) / videoMetrics.length,
    []
  );
  const totalEngagement = useMemo(
    () =>
      videoMetrics.reduce((sum, v) => sum + v.likes + v.comments + v.shares, 0),
    []
  );

  const formatNumber = useCallback((num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return `${num}`;
  }, []);

  const formatDuration = useCallback((mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, []);

  const getAlertIcon = useCallback((type: Alert["type"]): ReactNode => {
    switch (type) {
      case "milestone":
        return React.createElement(Target, { className: "h-4 w-4" });
      case "trending":
        return React.createElement(TrendingUp, { className: "h-4 w-4" });
      case "engagement":
        return React.createElement(ThumbsUp, { className: "h-4 w-4" });
      case "performance":
        return React.createElement(BarChart3, { className: "h-4 w-4" });
      default:
        return React.createElement(Bell, { className: "h-4 w-4" });
    }
  }, []);

  const getAlertColor = useCallback((type: Alert["type"]): string => {
    switch (type) {
      case "milestone":
        return "border-green-500/50 bg-green-500/10 text-green-400";
      case "trending":
        return "border-cyan-500/50 bg-cyan-500/10 text-cyan-400";
      case "engagement":
        return "border-purple-500/50 bg-purple-500/10 text-purple-400";
      case "performance":
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-400";
      default:
        return "border-gray-500/50 bg-gray-500/10 text-gray-400";
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setUnreadAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    // data
    videoMetrics,
    alertsData,
    // state
    selectedPeriod,
    unreadAlerts,
    showAllAlerts,
    // setters
    setSelectedPeriod,
    setShowAllAlerts,
    // computed
    totalViews,
    totalWatchTime,
    avgCTR,
    totalEngagement,
    // formatters
    formatNumber,
    formatDuration,
    getAlertIcon,
    getAlertColor,
    // actions
    markAsRead,
  };
}
