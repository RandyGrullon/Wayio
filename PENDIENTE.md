# Wayio — Pendiente para mañana

> Estado al 2026-06-14. Lo que ya funciona vs. lo que queda.

## 🔴 Crítico (hacer primero, bloquea producción)

- [x] **`SUPABASE_SERVICE_ROLE_KEY`** corregida en `.env.local` (ya es la
      `service_role` real, no la anon). Desbloquea panel admin y guardado
      server-side.
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

- [x] **Tiers genuinamente distintos**: la IA adjunta `variantesTier`
      (hoteles/actividades reales por nivel) en la MISMA generación y
      `deriveTier` las aplica; si faltan, cae al escalado de precio clásico.
      `enforceTierOrder` garantiza básico ≤ confort ≤ premium (las variantes de
      la IA podían no ser monótonas). (`generateItinerary.ts` + `generateTrips.ts`.)
- [x] **Búsqueda real de vuelos/hoteles/actividades**: rutas `/api/hotels`,
      `/api/flights`, `/api/activities` + libs Amadeus/Booking/Viator y el
      componente `RealSearch`. Degrada con gracia (`configured:false`) sin keys.
      _Solo falta poner las API keys reales para que devuelva resultados._
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

- [x] **App móvil real** (`/mobile`, Expo) con GPS en vivo + geofencing +
      alertas (capas 5-6). **Paridad de pantallas con web completada**: - `RealSearch` (búsqueda real vía las GET del backend) + `ReserveButton`
      (abre checkout web logueado) en `TripDetailScreen`. - `AdjustChat` (chat de ajustes IA → `/api/adjust`, persiste el cambio). - `EditableDays` (editar/mover/borrar/añadir actividades) con modo
      "Editar itinerario" en `TripDetailScreen`. - `RecreateTripScreen` ("Desde un video" → `/api/analyze-video`, prefija
      el destino en el formulario) + botón en `HomeScreen`. - Compartir link público de solo lectura (`/viaje-compartido/[id]`) además
      del invite de grupo. - **Paridad de rediseños (2ª pasada)**: `TripEssentials` ("Completa tu
      viaje": vuelo incluido + preguntar hospedaje/carro + total en vivo),
      card de actividad simplificada (`DayCard`: sin descripción, dirección +
      "Llegar"), header con acciones colapsadas en un action-sheet "Más", y
      `Loader3D` (giro 3D) en la pantalla de carga. - _Streaming: el `LoadingScreen` ya emula las fases; SSE real no es viable
      en el `fetch` de RN, así que se usa el `POST /api/generate` que ya
      funciona._ - _Verificado: `type-check` + `lint` en verde. No ejecutado en
      dispositivo (requiere Expo + las `EXPO_PUBLIC_\*`).\_
- [x] **Reservas dentro de la app** (Stripe): `ReserveButton` + `/api/stripe/
    checkout` con `mode:'reservation'` (depósito del 15% del presupuesto).
      Degrada con gracia sin `STRIPE_SECRET_KEY`. En móvil abre la web logueada.
- [x] **Modo offline**: service worker (`public/sw.js`) + store (`src/lib/
    offline/`) + hook `useOfflineTrip` cableado en `/trip/[id]` (cacheo
      automático, indicador online/offline y lectura desde caché sin conexión).

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
