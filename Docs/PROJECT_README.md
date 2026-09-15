# Jimbot

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Tecnologías y Convenciones](#tecnologías-y-convenciones)
- [Estructura de Carpetas](#estructura-de-carpetas)
- [Módulos “app/”](#módulos-app)
- [Listado de Módulos](#listado-de-módulos)
- [Componentes Compartidos](#componentes-compartidos-componentsui)
- [Sidebar y Layout Global](#sidebar-y-layout-global)
- [Estilos y Theming](#estilos-y-theming)
- [Assets Públicos](#assets-públicos)
- [Configuraciones y Scripts](#configuraciones-y-scripts)
- [Flujo de Desarrollo](#flujo-de-desarrollo)
- [Cómo Añadir una Nueva Herramienta](#cómo-añadir-una-nueva-herramienta)
- [Despliegue](#despliegue)
- [Convenciones y Buenas Prácticas](#convenciones-y-buenas-prácticas)
- [Recursos Adicionales](#recursos-adicionales)

---

## Visión General

**Jimbot** es una aplicación Next.js 13 (App Router) con TypeScript diseñada para editar, convertir y subir contenido audiovisual (VODs). Cada sección sigue el patrón **hooks + UI + page** para separar lógica, componentes visuales y rutas. El sistema de UI propio (`components/ui`) está basado en Tailwind CSS y un tema global.

---

## Tecnologías y Convenciones

- Next.js 15 (App Router `app/`)
- React 19 + TypeScript
- Tailwind CSS
- Lucide-React
- pnpm / Vercel

---

## Estructura de Carpetas

```plaintext
Jimbot/
┣ app/
┃ ┣ ...módulos...
┃ ┣ globals.css         # tokens + resets (único)
┃ ┣ layout.tsx
┃ ┗ page.tsx
┣ components/
┃ ┣ ui/
┃ ┣ app-sidebar.tsx
┃ ┗ theme-provider.tsx
┣ hooks/
┣ lib/
┣ public/
┣ styles/
┃ ┗ globals.css         # LEGACY
┣ next.config.mjs
┣ tailwind.config.ts
┣ tsconfig.json
┣ package.json
┗ pnpm-lock.yaml
```

---

## Módulos `app/`

Cada carpeta dentro de `app/` corresponde a una ruta (`/analytics`, `/upload`, etc.) y está dividida en:

### Patrón Hooks → UI → Page

- **hooks/useXxx.ts**: Toda la lógica (estado, llamadas a API, cálculos).
- **ui/XxxForm.tsx**: “Dumb component” que recibe props y renderiza UI.
- **page.tsx**: Punto de entrada de la ruta: importa el hook, extrae props y renderiza el form.
- **(loading.tsx)**: Opcional: skeleton/loading state.

Este patrón facilita pruebas unitarias, reutilización de lógica y limpieza de los componentes de presentación.

---

## Listado de Módulos

- **upload/**: Subida de archivos (drag & drop, progress bars).
- **edit-type/**: Selección de tipo de edición (chatting, reacción, etc.).
- **processing/**: Dashboard de estado de tareas (transcoding, clipping…).
- **clips/**: Galería de clips generados, filtros y modo grid/list.
- **editor/**: Timeline visual para editar velocidad, transiciones y música.
- **conversion/**: Reconversión de videos a distintos aspect ratios.
- **thumbnails/**: Generador de miniaturas con IA (simulado).
- **transcriptions/**: Edición de texto de transcripción, export SRT/VTT y traducciones.
- **youtube/**: Integración con canal YouTube (OAuth simulado, upload directo).
- **analytics/**: Métricas de rendimiento y alertas.

---

## Componentes Compartidos (`components/ui/`)

- **Átomos:** Button, Input, Checkbox, Badge, Slider…
- **Moléculas:** Card, Alert, Progress, Dialog…
- **Hooks de UI:** use-mobile, use-toast
- **Layout:** Drawer, Sidebar, Tabs
- **Accesibilidad incorporada:** focus, keyboard nav…

> **Recomendación:** Antes de crear un componente nuevo, verifica si ya existe en `components/ui`.

---

## Sidebar y Layout Global

- **layout.tsx:** Envuelve todas las rutas con `<ThemeProvider>` y `<AppSidebar>`. Importa `globals.css`.
- **app-sidebar.tsx:** Lee un array de items y renderiza `<SidebarMenu>`. Cada item tiene un distintivo “dev” para maqueta visual (icónico o badge amarillo).

---

## Estilos y Theming

- app/globals.css define tokens y resets (única fuente).
- styles/globals.css es LEGACY para compatibilidad.

**Clases comunes:**

- Colores: `bg-slate-800`, `text-cyan-400`, etc.
- Espaciados: `p-4`, `space-y-6`
- Estados hover/focus: `hover:bg-slate-700`, `focus:ring-cyan-500`

---

## Assets Públicos

La carpeta `public/` guarda imágenes de placeholder y logos:

- `placeholder.svg` / `.png`
- `placeholder-user.jpg`

Carpeta libre para agregar iconos o imágenes estáticas accesibles en `/static`.

---

## Configuraciones y Scripts

- **next.config.mjs:** ajustes de Next.js (p. ej. dominio de imágenes)
- **postcss.config.mjs:** plugins PostCSS
- **tsconfig.json:** paths y reglas TS
- **package.json:** scripts principales:
  - `dev`: arranca en localhost
  - `build`: producción
  - `start`: servidor Next.js
  - `lint`, `format`

---

## Flujo de Desarrollo

1. Clonar & instalar

   ```bash
   git clone …
   pnpm install
   pnpm dev
   ```

2. Crear branch por feature: `feature/nombre-descriptivo`.
3. Añadir módulo bajo `app/mi-feature/` siguiendo patrón Hooks/UI/Page.
4. Revisar UI: usar componentes existentes antes de crear nuevos.
5. Estilos: aplicar clases Tailwind; evitar CSS inline.
6. Testing: unidad para hooks; revisión manual de flujos.
7. PR: incluir descripción, screenshots y etiquetas (WIP si es maqueta).
8. Merge tras aprobación y build verde en CI.

---

## Cómo Añadir una Nueva Herramienta

1. Crear carpeta `app/mi-herramienta/`.
2. Implementar hook en `hooks/useMiHerramienta.ts`.
3. Crear UI en `ui/MiHerramientaForm.tsx`.
4. Poner `page.tsx` que importe hook y UI.
5. Agregar ruta en `menuItems` de `app-sidebar.tsx`, marcando `dev: true` si es prototipo.
6. Probar localmente con `pnpm dev`.

---

## Despliegue

- Vercel detecta el proyecto automáticamente.
- Branches `main` desplegadas en producción; PRs en preview URLs.
- Asegurar variables de entorno en Vercel (p. ej. claves API para YouTube).

---

## Convenciones y Buenas Prácticas

- **TypeScript estricto:** evita `any`.
- **Separación de responsabilidades:** hook ⚙️ vs UI 🎨 vs page 🗺️.
- **Reutilización de UI:** usa `components/ui` primero.
- **Accesibilidad:** etiquetas `aria-` en inputs y botones importantes.
- **Commit messages:** estilo Conventional Commits (`feat:`, `fix:`, `docs:`).

---

## Recursos Adicionales

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)
- [pnpm](https://pnpm.io/)
- [Vercel Deploy](https://vercel.com/docs)
- **TypeScript estricto:** evita `any`.
- **Separación de responsabilidades:** hook ⚙️ vs UI 🎨 vs page 🗺️.
- **Reutilización de UI:** usa `components/ui` primero.
- **Accesibilidad:** etiquetas `aria-` en inputs y botones importantes.
- **Commit messages:** estilo Conventional Commits (`feat:`, `fix:`, `docs:`).

---

## Recursos Adicionales

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)
- [pnpm](https://pnpm.io/)
- [Vercel Deploy](https://vercel.com/docs)

---

## Backend (Esqueleto Inicial)

FastAPI + SQLAlchemy añadidos (Video, Clip, Job) con pipeline básico. Consultar carpeta `backend/app/` y `Docs/OPENAPI_DRAFT.yaml`.
