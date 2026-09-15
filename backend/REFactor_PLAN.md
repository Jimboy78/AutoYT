# Plan de Refactor Backend (Snapshot)

## Objetivo

Unificar el backend en una arquitectura modular limpia, separando el router legacy (IDs string) del nuevo modelo (IDs int) para migrar de forma incremental sin bloquear el frontend.

## Fases

1. Extraer endpoints legacy a `app/api/v1/legacy.py` (COMPLETADO).
2. Abstraer ejecución de jobs -> `InMemoryJobRunner` (COMPLETADO, ver `services/job_runner_inmemory.py`).
3. Reemplazar lógica inline de transcodificación por servicio `ffmpeg_service` con función pura y retorno de metadata (PENDIENTE).
4. Unificar modelo de IDs (decidir UUID o INT). Propuesta: migrar todo a UUID string para videos y jobs, evitando colisiones y permitiendo uploads previos como ID natural -> requiere migración DB (Alembic) (PENDIENTE).
5. Generar OpenAPI limpio y cliente TypeScript (`openapi-typescript`). (PENDIENTE).
6. Introducir capa repositorio y servicios (video_service, clip_service, transcription_service). (PENDIENTE).
7. Sustituir runner in-memory por Celery manteniendo la interfaz. (PENDIENTE).

## Notas

- Mientras conviven dos modelos, los endpoints legacy están bajo `/api/v1/legacy/*`.
- Frontend puede apuntar gradualmente a los nuevos endpoints (`/api/v1/videos`, `/api/v1/jobs`).
- Evitar añadir más lógica en `main.py`; usar routers.

## Próximos Commits Recomendados

- Crear `services/ffmpeg.py`.
- Añadir `alembic/` y primera migración.
- Implementar endpoint SSE/WebSocket para progreso.
