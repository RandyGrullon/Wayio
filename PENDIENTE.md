# Wayio — Pendiente para mañana

> Estado al 2026-06-14. Lo que ya funciona vs. lo que queda.

## 🔴 Crítico (hacer primero, bloquea producción)

- [ ] **Arreglar `SUPABASE_SERVICE_ROLE_KEY`** en `.env.local`.
      Ahora mismo es la _anon key_ (idéntica a `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
      Cópiala de Supabase → Settings → API → `service_role`.
      Sin esto fallan: panel admin y guardado de viajes server-side.
- [ ] **Configurar una API key de IA con cuota real** para producción
      (`ANTHROPIC_API_KEY` + `AI_PROVIDER=anthropic`), o subir el plan de Groq.
      El plan gratis de Groq (100k tokens/día, 6k/min) se agota rápido. - Alternativa rápida de prueba: `GROQ_MODEL=llama-3.1-8b-instant` (más cuota).

## 🟢 Quick wins (alto valor, poco esfuerzo)

- [x] **Editar itinerario antes de guardar**: mover / borrar / añadir / editar
      actividad. Botón "Editar" en el resultado → `EditableDays` (`src/components/
trip/EditableDays.tsx`).
- [x] **Geocodificar más de 6 actividades** en background tras mostrar el
      resultado: ruta `/api/geocode` (rate-limit server-side) + hook
      `useBackgroundGeocode` que rellena las coords que faltan y actualiza el mapa.
- [ ] **Rellenar los IDs de afiliado reales** en `src/constants/affiliateLinks.ts`
      (`TU_ID`, `TU_PID`, `TU_CODIGO`) para empezar a monetizar.
      _(Necesita tus IDs reales de Booking/Viator/Skyscanner/Airalo.)_
- [x] **Manejar mejor el caso "sin coords"** en el mapa: `TripMap` muestra un
      aviso ("Ubicaciones aún no disponibles") en vez de centrarse en un punto
      arbitrario cuando ninguna actividad tiene coordenadas.

## 🟡 Producto (esfuerzo medio)

- [ ] **Tiers genuinamente distintos**: hoteles/actividades diferentes por
      paquete, no solo precio escalado. (Cuesta más cuota de IA — evaluar.)
- [ ] **Búsqueda real de vuelos/hoteles**: activar Amadeus (tier gratis de test)
      y/o Booking. Ya hay stubs en `src/lib/api/` (amadeus, booking, viator).
- [x] **Streaming del itinerario**: ruta SSE `/api/generate/stream` que emite el
      progreso real del backend (`contexto → ia → coords → listo`) + el resultado.
      Cliente en `streamGenerate` con fallback a `/api/generate`. La lógica de
      generación se extrajo a `src/lib/ai/generateTrips.ts`. _Verificado en runtime._
- [x] **Chat de ajustes con IA**: componente `AdjustChat` en el resultado +
      ruta `/api/adjust` ("hazlo más barato / añade un mercado…"). Conserva ids y
      coords de lo que no cambia, normaliza la respuesta. _Verificado en runtime._
- [x] **Compartir viaje** por link público de solo lectura:
      `/viaje-compartido/[id]` (sin GPS ni edición) + botón "Compartir" en el
      resultado (guarda y copia el link) y en `/trip/[id]`.
      _Nota: el guardado/lectura necesita Supabase OK (la 🔴 service role key)._

## 🔵 Apuestas grandes (sesión propia cada una)

- [ ] **App móvil real** (ya hay scaffold en `/mobile`) con GPS en vivo +
      geofencing (ya modelado en `src/lib/geofencing/` y `src/hooks/`).
- [ ] **Reservas dentro de la app** (extender la integración de Stripe).
- [ ] **Modo offline** para usar el itinerario sin datos durante el viaje.

## 🧹 Limpieza / deuda técnica

- [x] **Lint**: `ThemeToggle.tsx` reescrito con `useSyncExternalStore` (sin
      `set-state-in-effect`) y `alt` añadido al `Image` de `WeatherStrip.tsx`.
      `npm run lint` pasa con `--max-warnings=0`.
- [ ] Revisar que el `next dev` no deje procesos huérfanos bloqueando el puerto.

---

## ✅ Ya hecho (referencia)

- IA funcional de verdad: una sola llamada + derivación de tiers (≈5k tokens
  por búsqueda en vez de ~27k). Parseo robusto de JSON (repara fences, comas
  finales y escapes Unicode inválidos).
- Reintento automático ante rate-limit (429) corto.
- Búsqueda real sin keys de pago: geocoding (OpenStreetMap) + clima (OpenWeather)
  inyectados al prompt; coordenadas reales de las actividades clave.
- Enlaces de afiliado en actividades + CTAs de vuelos (Skyscanner) y hoteles
  (Booking) en el resultado.
- Botones: "Otra versión" (regenerar sin caché), "Calendario" (.ics export),
  "PDF" (print).
- Banner honesto que explica el motivo real cuando cae a demo.
- Variables nuevas documentadas en `.env.example`: `AI_ITINERARY_MODEL`,
  `AI_ITINERARY_MAX_TOKENS`.
- Todas las pantallas del flujo responden OK (landing → form → loading →
  packages → result → guardar → /trip/[id], login, group, landings SEO).
