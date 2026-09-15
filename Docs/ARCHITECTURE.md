# Stack Tecnológico Propuesto

## Resumen Ejecutivo

Este documento detalla el stack tecnológico propuesto para tu proyecto de edición de VODs y highlights, compuesto por Next.js 14 con TypeScript en el frontend, estilizado con Tailwind CSS en modo oscuro y una paleta de colores fríos personalizada, y un backend basado en FastAPI 0.115.12 con Python. Se describen las razones de elección de cada tecnología, las versiones estables recomendadas, la configuración inicial, y los primeros pasos para armar un esqueleto mínimo con un flujo básico de subida de VOD, procesamiento y presentación de resultados.

## 1. Visión General del Stack

### 1.1 Frontend: Next.js 14 + TypeScript

Next.js 14 es la última versión estable de Vercel, con:

- Servidor de desarrollo hasta 53 % más rápido y actualizaciones de código un 94 % más ágiles gracias a Turbopack.
- Server Actions, React Server Components y streaming dinámico.
- Soporte integrado a TypeScript: al crear el proyecto con create-next-app, genera un `tsconfig.json` óptimo.

### 1.2 Estilizado: Tailwind CSS en Dark Mode con Paleta Fría

Tailwind CSS utility-first, con `darkMode: 'class'` o `media` para activar el modo oscuro.  
Paleta recomendada:

- Fondo principal: `slate-900 (#0F172A)`
- Superficies: `slate-800 (#1E293B)`
- Texto: `gray-100 (#F3F4F6)`
- Acento: `cyan-600 (#06B6D4)`
- Bordes / hover: `cyan-500 (#14B8A6)`

Extiende en `tailwind.config.js` usando variables CSS y tokens semánticos.

### 1.3 Backend: FastAPI 0.115.12

- FastAPI de alto rendimiento con ASGI y Uvicorn.
- Validación automática con Pydantic y documentación Swagger/OpenAPI integrada.
- Versión 0.115.12 (marzo 2025) mejora compatibilidad con `mypy --strict` y actualiza `uvicorn[standard]`.

## 2. Versiones y Configuración Inicial

### 2.1 Crear Proyecto Next.js con TypeScript

`npx create-next-app@latest frontend --typescript`

`cd frontend`

`npm list next # Verifica que sea la versión 14.x`

### 2.2 Instalar y Configurar Tailwind CSS

`npm install -D tailwindcss postcss autoprefixer`

`npx tailwindcss init -p`

#

En `tailwind.config.js`:

```javascript
export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#e0f2fe",
          500: "#0284c7",
          900: "#083344",
        },
        accent: {
          500: "#06b6d4",
          700: "#0e7490",
        },
      },
    },
  },
};
```

En `globals.css`:

@tailwind base;

@tailwind components;

@tailwind utilities;

### 2.3 Definir Paleta Fría Personalizada

```javascript
// tailwind.config.js (snippet)
extend: {
  colors: {
    slate: {
      900: '#0F172A',
      800: '#1E293B',
    },
    gray: {
      100: '#F3F4F6',
    },
    cyan: {
      500: '#14B8A6',
      600: '#06B6D4',
    },
  },
},
```

### 2.4 Inicializar Proyecto FastAPI

`mkdir backend && cd backend`

`python -m venv .venv`

`source .venv/bin/activate`

`pip install fastapi[all] uvicorn[standard]`

Estructura sugerida:

```
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints.py
│   │       └── schemas.py
│   └── core/
│       └── config.py
└── requirements.txt
```

## 3. Primeros Pasos: Esqueleto y Flujo Básico

### 3.1 Flujo End-to-End Mínimo

- **Frontend:** ruta `/upload` con formulario drag & drop.
- **API:** `POST /api/v1/upload` recibe `file: UploadFile`.
- **Procesamiento** (Celery o APScheduler + ffmpeg-python): guarda VOD y genera recortes.
- **Persistencia:** SQLite para desarrollo, guarda URLs y metadatos.
- **UI Dashboard:** `/dashboard` consulta `GET /api/v1/clips` y muestra miniaturas.

### 3.2 Configuración CI/CD Inicial

- `docker-compose` para servicios frontend y backend.
- GitHub Actions: workflow que construya imágenes, ejecute tests y despliegue en staging.

### 3.3 Ejecución Local

- **Terminal A: backend**

  `cd backend`

  `uvicorn app.main:app --reload`

- **Terminal B: frontend**

  `cd frontend`

  `npm run dev`

  - Frontend en `http://localhost:3000`
  - Docs FastAPI en `http://localhost:8000/docs`

## 4. Siguientes Pasos y Buenas Prácticas

- **Pruebas:** pytest (backend), Jest + React Testing Library (frontend).
- **Linting & Formato:** flake8/black (Python), ESLint/Prettier (JS/TS).
- **Monitorización:** Sentry / Prometheus + Grafana.
- **Despliegue:** Vercel (frontend), Kubernetes / DigitalOcean App Platform (backend).

## Pipeline Implementado (Snapshot 0.1)

Ver `Docs/PIPELINE.md` para diagrama Mermaid y estados actuales (upload_ingest → cut_clips). Próximas etapas planificadas ya enumeradas para expansión modular.
