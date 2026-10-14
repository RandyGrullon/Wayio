# Wayio

**Traza tu viaje · Vive el camino.** Planificador de viajes con IA en español: describes tu viaje como se lo contarías a un amigo y Wayio arma tres versiones del itinerario (básico, confort y premium) con horarios reales, mapa, presupuesto en USD/EUR/DOP y enlaces para reservar. Después puedes ajustarlo por chat, guardarlo, compartirlo, viajar en grupo y seguirlo en vivo con GPS.

## Qué hay en el repo

| Carpeta           | Qué es                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`         | Web en **Next.js 16** (App Router): landing `/`, planificador `/planificar`, viaje guardado `/trip/[id]`, compartido `/viaje-compartido/[id]`, grupos `/group/[id]`, mis viajes `/viajes`, cuenta `/cuenta`, precios `/precios`, 47 guías SEO `/viaje/[destino]`, auth y panel `/admin`. |
| `src/app/api`     | Backend: generación con IA (SSE), interpretación de texto libre, ajustes, reagendado, validación, video, viajes, grupos, Stripe, búsqueda y geocoding.                                                                                                                                   |
| `src/lib/ai`      | Núcleo de IA: cliente Anthropic/Groq con salida estructurada, prompts, generación por bloques en paralelo, normalización y validación de lo que devuelve el modelo.                                                                                                                      |
| `supabase`        | Esquema completo (`schema.sql`), migraciones, plantillas de correo y guía de auth.                                                                                                                                                                                                       |
| `mobile`          | App **Expo** (React Native) con las mismas funciones y modo en vivo con GPS y geofencing.                                                                                                                                                                                                |
| `scripts/eval-ia` | Batería de evaluación de la IA (44 viajes + 6 textos libres) con validaciones automáticas y juez opcional.                                                                                                                                                                               |
| `docs/DISENO.md`  | Sistema de diseño «Cuaderno de Ruta» (tokens, componentes, pantallas, logo y animación de entrada).                                                                                                                                                                                      |

Stack: React 19, Tailwind CSS 4, framer-motion, MapLibre + OpenFreeMap, Supabase (Postgres + Auth + Realtime), Anthropic SDK, Stripe, PostHog, Sentry.

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # y rellena lo que quieras activar (ver API-KEYS-GUIA.md)
npm run dev                  # http://localhost:3000
```

Sin ninguna clave la app corre en modo demo (itinerario de ejemplo, sin login). Para IA real basta `ANTHROPIC_API_KEY` (o `GROQ_API_KEY` con `AI_PROVIDER=groq`). La guía completa de servicios está en [**API-KEYS-GUIA.md**](API-KEYS-GUIA.md) y lo que falta para producción en [**PENDIENTE.md**](PENDIENTE.md).

App móvil: ver [`mobile/README.md`](mobile/README.md) (necesita un _development build_, no Expo Go).

## Scripts

| Comando                                                                                   | Qué hace                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                                                                             | Servidor de desarrollo                                           |
| `npm run build` / `npm start`                                                             | Build y servidor de producción                                   |
| `npm run validate`                                                                        | type-check + lint + formato (lo mismo que CI)                    |
| `npm run eval:ia -- --base http://localhost:3000 [--interpret] [--juez] [--solo id1,id2]` | Evalúa la generación de itinerarios contra el servidor en marcha |

## Documentación

- [API-KEYS-GUIA.md](API-KEYS-GUIA.md) — cómo obtener y configurar cada servicio.
- [PENDIENTE.md](PENDIENTE.md) — estado del proyecto y pasos para terminarlo.
- [ADMIN.md](ADMIN.md) — panel de administración.
- [supabase/CONFIGURACION-AUTH.md](supabase/CONFIGURACION-AUTH.md) — autenticación paso a paso.
- [docs/DISENO.md](docs/DISENO.md) — sistema de diseño.
