# Documentación Técnica Completa - Proyecto AutoYT

## Resumen Ejecutivo

**AutoYT** (proyecto "Jimbot") es una plataforma web profesional para automatizar el flujo de trabajo de creadores de contenido audiovisual, desde la subida de VODs hasta la publicación optimizada en YouTube. Integra tecnologías de inteligencia artificial para edición automática, generación de miniaturas, transcripción y análisis de rendimiento, revolucionando la forma en que los creadores procesan y distribuyen sus videos.

---

## Propósito y Objetivos

- **Automatización integral:** Eliminar tareas manuales repetitivas en la edición de videos.
- **Optimización de contenido:** Mejorar el rendimiento de videos mediante IA y análisis de datos.
- **Escalabilidad:** Permitir procesar múltiples videos simultáneamente.
- **Accesibilidad:** Democratizar herramientas profesionales de edición para todos los niveles.

---

## Público Meta

- Streamers de Twitch que publican highlights en YouTube.
- YouTubers de gaming y reacciones.
- Editores de video profesionales que buscan automatización.
- Agencias de marketing digital especializadas en contenido audiovisual.

---

## Stack Tecnológico

### Frontend

- **Next.js 15.2.4** (App Router, Server/Client Components)
- **TypeScript** (estricto)
- **React 19**
- **Turbopack** (bundler ultra-rápido)

#### Dependencias principales

```json
{
  "next": "15.2.4",
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "typescript": "^5.8.3"
}
```

### Sistema de Diseño y UI

- Tailwind CSS 3.4.17 + Radix UI.
- app/globals.css = fuente única de tokens (:root claro, .dark oscuro). styles/globals.css queda como LEGACY.

#### Paleta de Colores Personalizada

```css
:root {
  --background: 222.2 84% 4.9%; /* slate-900 */
  --foreground: 210 40% 98%; /* gray-100 */
  --accent: 217.2 32.6% 17.5%; /* cyan-600 */
  --sidebar-background: 222.2 84% 4.9%;
}
```

#### Componentes UI Disponibles (47)

- **Átomos:** Button, Input, Badge, Avatar, Checkbox, Switch
- **Moléculas:** Card, Alert, Progress, Dialog, Dropdown
- **Organismos:** Sidebar, Navigation, Calendar, Chart, Table
- **Utilidades:** Toast, Tooltip, Command Palette, Resizable Panels

### Herramientas de Desarrollo

- **pnpm:** Gestor de paquetes eficiente (monorepo)
- **ESLint + Prettier:** Linting y formateo automático
- **PostCSS:** Procesamiento de CSS
- **Lucide React:** Iconos SVG (454 iconos)

### Backend (Propuesto)

- **FastAPI 0.115.12:** Framework de alto rendimiento
- **Uvicorn:** Servidor ASGI
- **SQLite/PostgreSQL:** Base de datos
- **Celery + Redis:** Cola de tareas
- **FFmpeg:** Procesamiento de video/audio

---

## Arquitectura del Proyecto

### Estructura de Carpetas

```
AutoYT/
├── Docs/                # Documentación técnica
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── PROJECT_README.md
│   └── *.pdf            # Investigación IA
└── Jimbot/              # Aplicación Next.js
        ├── app/             # App Router (rutas y páginas)
        ├── components/      # Sistema de componentes
        ├── hooks/           # Custom hooks compartidos
        ├── lib/             # Utilidades y helpers
        ├── public/          # Assets estáticos
        └── styles/          # Estilos globales
```

#### Patrón de Arquitectura: Hooks + UI + Page

Cada módulo en `app/` sigue este patrón:

```
app/[modulo]/
├── hooks/
│   └── use[Modulo].ts   # Lógica de negocio y estado
├── ui/
│   └── [Modulo]Form.tsx # Componente de presentación
├── page.tsx             # Punto de entrada de la ruta
└── loading.tsx          # Estado de carga (opcional)
```

**Ventajas:**

- Separación de responsabilidades (lógica vs presentación)
- Testabilidad y reutilización
- Mantenibilidad

---

## Módulos Principales del Sistema

1. **Upload (`/upload`)**

   - Subida de archivos (drag & drop)
   - Validación de formatos (.mp4, .mkv, .ts, .mp3)
   - Límite de 5GB, progress bars, procesamiento en lotes
   - **Estado:** ✅ Implementado

2. **Edit-Type (`/edit-type`)**

   - Selección de tipo de edición (Just Chatting, Gameplay, Reacción, Tutorial)
   - **Estado:** 🚧 Maqueta visual

3. **Processing (`/processing`)**

   - Dashboard de monitoreo de tareas (transcodificación, clips, miniaturas, subida a YouTube)
   - Estimación de tiempo, logs, progreso en tiempo real
   - **Estado:** 🚧 Maqueta visual

4. **Clips (`/clips`)**

   - Galería de clips generados (grid/lista, filtros, previsualización, descarga)
   - **Estado:** 🚧 Maqueta visual

5. **Editor (`/editor`)**

   - Timeline visual para edición avanzada (velocidad, transiciones, música, silencios)
   - **Estado:** 🚧 Maqueta visual

6. **Conversion (`/conversion`)**

   - Reconversión de aspect ratios (16:9→9:16, 16:9→1:1, 4:3→16:9)
   - IA para detección de área de interés
   - **Estado:** 🚧 Maqueta visual

7. **Thumbnails (`/thumbnails`)**

   - Generación de miniaturas con IA (OpenCV/FFmpeg, Stable Diffusion/DALL-E)
   - Templates: Gaming Epic, Reaction Style, Tutorial Clean, Highlight Reel
   - **Estado:** 🚧 Maqueta visual

8. **Transcriptions (`/transcriptions`)**

   - Transcripción y subtitulado automático (Whisper/WhisperX, DeepL/Google Translate)
   - Exportación: SRT, VTT, JSON
   - **Estado:** 🚧 Maqueta visual

9. **YouTube (`/youtube`)**

   - Integración completa con YouTube (OAuth2, subida automática, SEO, thumbnails)
   - **Estado:** 🚧 Maqueta visual

10. **Analytics (`/analytics`)** - Métricas y análisis de rendimiento (vistas, watch time, CTR, A/B testing) - Dashboard interactivo, alertas, recomendaciones IA - **Estado:** 🚧 Maqueta visual

---

## Sistema de Componentes UI

### Componentes Atómicos

- **Button:** 6 variantes, estados hover/focus/disabled
- **Input:** Validación, placeholders, iconos
- **Badge:** Indicadores de estado, etiquetas
- **Avatar:** Imágenes de usuario con fallbacks
- **Progress:** Barras animadas

### Componentes Moleculares

- **Card:** Contenedor base
- **Alert:** Notificaciones
- **Dialog:** Modales accesibles
- **Dropdown:** Menús contextuales
- **Tabs:** Navegación entre secciones

### Componentes de Layout

- **Sidebar:** Navegación principal colapsible
- **Resizable Panels:** Paneles redimensionables
- **Scroll Area:** Scrolling customizado
- **Sheet:** Panels deslizantes para mobile

### Hooks de UI Compartidos

- `useToast`: Notificaciones temporales
- `useMobile`: Detección de dispositivos móviles
- `useTheme`: Gestión de tema claro/oscuro

---

## Roadmap y Hitos

### Fase 1: MVP Core (En desarrollo)

- ✅ Configuración Next.js + TypeScript
- ✅ Sistema de componentes UI
- ✅ Navegación y layout principal
- ✅ Módulo de upload funcional
- ✅ Arquitectura hooks + UI + page

### Fase 2: Procesamiento de Video (En desarrollo)

- 🚧 Integración FFmpeg
- 🚧 Sistema de colas (Celery/APScheduler)
- 🚧 API FastAPI backend
- 🚧 WebSockets para updates

### Fase 3: IA y Automatización (Planeado)

- 📋 Integración Whisper para transcripción
- 📋 Pipeline de miniaturas IA
- 📋 Detección automática de highlights
- 📋 Optimización SEO con IA

### Fase 4: Integraciones (Planeado)

- 📋 YouTube Data API v3
- 📋 OAuth2 flow completo
- 📋 Subida automática programada
- 📋 Analytics y métricas

### Fase 5: Optimización y Escalado (Futuro)

- 📋 Docker y Kubernetes
- 📋 CDN para assets de video
- 📋 Monitorización (Prometheus + Grafana)

---

## Buenas Prácticas Adoptadas

### Desarrollo y Código

- TypeScript estricto
- Conventional Commits
- Code Splitting
- Error Boundaries

### Performance y UX

- Lazy Loading
- Optimized Images (Next.js)
- Responsive Design
- Loading States

### Accesibilidad (a11y)

- ARIA Labels
- Keyboard Navigation
- Focus Management
- Color Contrast

### Seguridad

- CSRF Protection
- Input Validation (cliente y servidor)
- File Upload Security
- OAuth2 Flow

---

## Configuraciones Técnicas

### Next.js

```js
// next.config.mjs
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
};
```

### TypeScript

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES6",
    "moduleResolution": "bundler",
    "paths": { "@/_": ["./_"] }
  }
}
```

### Tailwind

- Tokens personalizados para colores y espaciado
- Dark Mode por defecto (`class: "dark"`)
- Animaciones personalizadas (keyframes)
- Plugins: `tailwindcss-animate`

---

## Extensibilidad y Futuras Mejoras

### Módulos Propuestos

1. **Branding Automático:** Plantillas de intro/outro, overlays, patrocinadores.
2. **Community Interaction:** Detección de preguntas en chat, video-respuestas automáticas, resúmenes semanales.
3. **Content Intelligence:** Análisis de tendencias, sugerencias de contenido, A/B testing automático.
4. **Workflow Automation:** Integración con Premiere/DaVinci, scripts personalizados, plantillas de canal.

### Arquitectura de Microservicios (Futuro)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Frontend      │  │   API Gateway   │  │   Auth Service  │
│   (Next.js)     │  │   (FastAPI)     │  │   (OAuth2)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Video Service  │  │   AI Service    │  │ YouTube Service │
│   (FFmpeg)      │  │ (Whisper/SDXL)  │  │  (Data API)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Despliegue y DevOps

### Estrategia Actual

- **Frontend:** Vercel (deploy automático desde Git)
- **Assets:** CDN integrado de Vercel
- **Dominio:** Configuración personalizada

### CI/CD Pipeline Propuesto

```yaml
# .github/workflows/deploy.yml
name: Deploy
on: [push]
jobs:
    build:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - name: Setup Node.js
                uses: actions/setup-node@v3
                with:
                    node-version: '18'
                    cache: 'pnpm'
            - run: pnpm install
            - run: pnpm build
            - run: pnpm test
            - name: Deploy to Vercel
                uses: vercel/action@v1
```

### Monitorización y Observabilidad

- **Error Tracking:** Sentry
- **Performance:** Web Vitals, Core Web Vitals
- **Analytics:** Plausible Analytics
- **Uptime:** Pingdom

---

## Conclusiones y Recomendaciones

### Fortalezas

- Arquitectura sólida y escalable
- Excelente developer experience
- Accesibilidad y performance optimizadas

### Áreas de Mejora

- Testing: Implementar Jest + React Testing Library
- Documentación: JSDoc para componentes y hooks
- Storybook: Catálogo de componentes
- Performance Monitoring: Bundle analyzer
- Internationalization: Soporte multi-idioma

### Siguientes Pasos

- Implementar backend FastAPI
- Conectar pipeline de video con FFmpeg y workers
- Configurar autenticación OAuth2 con YouTube
- Establecer testing suite
- Deploy de entorno staging

### Estimación de Recursos

- **Desarrollo completo:** 6-8 meses (3-4 desarrolladores)
- **MVP funcional:** 2-3 meses (funcionalidades core)
- **Infraestructura:** $200-500/mes (cloud)
- **APIs externas:** $50-200/mes (IA, YouTube quota)

---

**AutoYT** representa una solución integral y técnicamente sólida para la automatización de workflows de creadores de contenido, con una base de código mantenible y una arquitectura preparada para escalar según las necesidades del mercado.
**AutoYT** representa una solución integral y técnicamente sólida para la automatización de workflows de creadores de contenido, con una base de código mantenible y una arquitectura preparada para escalar según las necesidades del mercado.
**AutoYT** representa una solución integral y técnicamente sólida para la automatización de workflows de creadores de contenido, con una base de código mantenible y una arquitectura preparada para escalar según las necesidades del mercado.
**AutoYT** representa una solución integral y técnicamente sólida para la automatización de workflows de creadores de contenido, con una base de código mantenible y una arquitectura preparada para escalar según las necesidades del mercado.

## Actualización Arquitectura (Backend MVP)

Se incorporó un esqueleto FastAPI con modelos Video, Clip y Job y pipeline inicial (4 etapas). Ver `OPENAPI_DRAFT.yaml` y `PIPELINE.md` para detalles.
