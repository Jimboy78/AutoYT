"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  FileVideo,
  Scissors,
  ImageIcon,
  Upload,
} from "lucide-react";
import type { ProcessingTask } from "../hooks/useProcessing";

interface ProcessingDashboardProps {
  tasks: ProcessingTask[];
  isPaused: boolean;
  pauseAll: () => void;
  retryTask: (id: string) => void;
  formatTime: (secs: number) => string;
  getElapsedTime: (start: Date) => number;
  completedTasks: number;
  totalTasks: number;
  overallProgress: number;
  videoId?: string;
}

const taskIcons = {
  transcoding: FileVideo,
  clipping: Scissors,
  thumbnails: ImageIcon,
  upload: Upload,
};

const taskLabels = {
  transcoding: "Transcodificando",
  clipping: "Generando Clips",
  thumbnails: "Creando Miniaturas",
  upload: "Subiendo a YouTube",
};

const statusColors = {
  pending: "bg-gray-500",
  processing: "bg-rose-500",
  completed: "bg-green-500",
  error: "bg-red-500",
};

const statusLabels = {
  pending: "Pendiente",
  processing: "En Progreso",
  completed: "Completado",
  error: "Error",
};

export function ProcessingDashboard({
  tasks,
  isPaused,
  pauseAll,
  retryTask,
  formatTime,
  getElapsedTime,
  completedTasks,
  totalTasks,
  overallProgress,
  videoId,
}: ProcessingDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-rose-400">
          Dashboard de Procesamiento
        </h1>
        <p className="text-gray-400">
          Monitorea el progreso de tus tareas de edición
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-8 w-8 text-rose-400" />
            <div>
              <p className="text-2xl font-bold">
                {tasks.filter((t) => t.status === "processing").length}
              </p>
              <p className="text-sm text-gray-400">En Progreso</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold">{completedTasks}</p>
              <p className="text-sm text-gray-400">Completadas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold">
                {tasks.filter((t) => t.status === "pending").length}
              </p>
              <p className="text-sm text-gray-400">Pendientes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800 border-zinc-700">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold">
                {tasks.filter((t) => t.status === "error").length}
              </p>
              <p className="text-sm text-gray-400">Con Error</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-800 border-zinc-700">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-rose-400">Progreso General</CardTitle>
            <CardDescription className="text-gray-400">
              {completedTasks} de {totalTasks} tareas completadas
            </CardDescription>
          </div>
          <Button
            onClick={pauseAll}
            variant="outline"
            className="border-rose-500 text-rose-400 hover:bg-rose-600 hover:text-white"
          >
            {isPaused ? (
              <Play className="h-4 w-4 mr-2" />
            ) : (
              <Pause className="h-4 w-4 mr-2" />
            )}
            {isPaused ? "Reanudar" : "Pausar"}
          </Button>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-3" />
          <p className="text-sm text-gray-400 mt-2">
            {Math.round(overallProgress)}% completado
          </p>
          {videoId &&
            tasks.some(
              (t) => t.type === "clipping" && t.status === "completed"
            ) && (
              <div className="mt-4">
                <Button
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => {
                    window.location.href = `/clips?videoId=${encodeURIComponent(
                      videoId
                    )}`;
                  }}
                >
                  Ver Clips
                </Button>
              </div>
            )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-800 border-zinc-700">
        <CardHeader>
          <CardTitle className="text-rose-400">Tareas Activas</CardTitle>
          <CardDescription className="text-gray-400">
            Estado detallado de cada proceso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tasks.map((task) => {
            const Icon = taskIcons[task.type];
            const elapsed = getElapsedTime(task.startTime);
            return (
              <div
                key={task.id}
                className="border border-zinc-600 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-rose-400" />
                    <div>
                      <p className="font-medium">{task.name}</p>
                      <p className="text-sm text-gray-400">
                        {taskLabels[task.type]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${statusColors[task.status]} text-white`}
                    >
                      {statusLabels[task.status]}
                    </Badge>
                    {task.status === "error" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryTask(task.id)}
                        className="border-rose-500 text-rose-400 hover:bg-rose-600 hover:text-white"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reintentar
                      </Button>
                    )}
                  </div>
                </div>

                {task.status === "processing" && (
                  <div className="space-y-2">
                    <Progress value={task.progress} className="h-2" />
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{Math.round(task.progress)}% completado</span>
                      <span>
                        {formatTime(elapsed)} transcurrido
                        {task.estimatedTime &&
                          ` / ~${formatTime(task.estimatedTime)} estimado`}
                      </span>
                    </div>
                  </div>
                )}

                {task.status === "completed" && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Completado en {formatTime(elapsed)}
                    </span>
                  </div>
                )}

                {task.status === "error" && task.error && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{task.error}</span>
                  </div>
                )}

                {task.status === "pending" && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      En cola – Tiempo estimado:{" "}
                      {task.estimatedTime
                        ? formatTime(task.estimatedTime)
                        : "Calculando..."}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
