"use client";

import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Alert as AlertComponent,
  AlertDescription,
} from "@/components/ui/alert";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Clock,
  ThumbsUp,
  MessageSquare,
  Share2,
  Bell,
  Calendar,
  Target,
  Award,
} from "lucide-react";
import type { VideoMetrics, Alert } from "../hooks/useAnalytics";

interface AnalyticsFormProps {
  videoMetrics: VideoMetrics[];
  alertsData: Alert[];
  selectedPeriod: "7d" | "30d" | "90d";
  unreadAlerts: Alert[];
  showAllAlerts: boolean;
  setSelectedPeriod: (p: "7d" | "30d" | "90d") => void;
  setShowAllAlerts: (b: boolean) => void;
  totalViews: number;
  totalWatchTime: number;
  avgCTR: number;
  totalEngagement: number;
  formatNumber: (n: number) => string;
  formatDuration: (n: number) => string;
  getAlertIcon: (type: Alert["type"]) => React.ReactNode;
  getAlertColor: (type: Alert["type"]) => string;
  markAsRead: (id: string) => void;
}

export function AnalyticsForm({
  videoMetrics,
  alertsData,
  selectedPeriod,
  unreadAlerts,
  showAllAlerts,
  setSelectedPeriod,
  setShowAllAlerts,
  totalViews,
  totalWatchTime,
  avgCTR,
  totalEngagement,
  formatNumber,
  formatDuration,
  getAlertIcon,
  getAlertColor,
  markAsRead,
}: AnalyticsFormProps) {
  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-cyan-400">Analytics & Alerts</h1>
        <p className="text-gray-400">
          Monitorea el rendimiento de tus videos y recibe alertas importantes
        </p>
      </div>

      {/* Alertas */}
      {unreadAlerts.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <Bell className="h-5 w-5" /> Alertas Recientes
              </CardTitle>
              <CardDescription className="text-gray-400">
                {unreadAlerts.length} alerta(s) sin leer
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="border-cyan-500 text-cyan-400 hover:bg-cyan-600"
            >
              {showAllAlerts ? "Ocultar" : "Ver todas"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(showAllAlerts ? alertsData : unreadAlerts.slice(0, 3)).map(
              (alert) => (
                <AlertComponent
                  key={alert.id}
                  className={getAlertColor(alert.type)}
                >
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{alert.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs opacity-70">
                            {alert.timestamp.toLocaleTimeString()}
                          </span>
                          {!alert.isRead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsRead(alert.id)}
                              className="h-6 px-2 text-xs"
                            >
                              Marcar leído
                            </Button>
                          )}
                        </div>
                      </div>
                      <AlertDescription className="mt-1">
                        {alert.description}
                      </AlertDescription>
                    </div>
                  </div>
                </AlertComponent>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: <Eye className="h-6 w-6 text-cyan-400" />,
            value: formatNumber(totalViews),
            label: "Total Visualizaciones",
            deltaIcon: <TrendingUp className="h-3 w-3 text-green-400" />,
            delta: "+12.5%",
            background: "bg-cyan-600/20",
            color: "text-cyan-400",
          },
          {
            icon: <Clock className="h-6 w-6 text-purple-400" />,
            value: formatDuration(totalWatchTime),
            label: "Tiempo de Visualización",
            deltaIcon: <TrendingUp className="h-3 w-3 text-green-400" />,
            delta: "+8.3%",
            background: "bg-purple-600/20",
            color: "text-purple-400",
          },
          {
            icon: <Target className="h-6 w-6 text-yellow-400" />,
            value: `${avgCTR.toFixed(1)}%`,
            label: "CTR Promedio",
            deltaIcon: <TrendingUp className="h-3 w-3 text-green-400" />,
            delta: "+2.1%",
            background: "bg-yellow-600/20",
            color: "text-yellow-400",
          },
          {
            icon: <ThumbsUp className="h-6 w-6 text-green-400" />,
            value: formatNumber(totalEngagement),
            label: "Total Engagement",
            deltaIcon: <TrendingUp className="h-3 w-3 text-green-400" />,
            delta: "+15.7%",
            background: "bg-green-600/20",
            color: "text-green-400",
          },
        ].map((stat, idx) => (
          <Card key={idx} className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.background}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {stat.deltaIcon}
                    <span className={`text-xs ${stat.color}`}>
                      {stat.delta}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rendimiento por video & panel lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rendimiento por video */}
        <div className="lg:col-span-2">
          {/* ... similar al original, mapeando videoMetrics ... */}
        </div>
        <div className="space-y-6"></div>
      </div>
    </div>
  );
}
