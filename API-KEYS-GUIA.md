# Guía de configuración — servicios y API keys de Wayio

> Todo va en `.env.local` en desarrollo (está en `.gitignore`) y en Vercel → Settings → Environment Variables en producción. Plantilla comentada: [`.env.example`](.env.example). Después de cambiar variables, reinicia `npm run dev` o vuelve a desplegar (las `NEXT_PUBLIC_*` se incrustan al compilar).
>
> Sin ninguna clave la app funciona en **modo demo**: muestra un itinerario de ejemplo, sin login ni pagos. Cada servicio que configures activa sus funciones; lo que falte se desactiva con mensajes amables (nunca con errores técnicos).

## Orden recomendado

| #   | Servicio                                                      | Para qué                                                                                  | ¿Obligatorio?                 | Coste                  |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | ---------------------- |
| 1   | **Anthropic (Claude)**                                        | Generar itinerarios, interpretar la descripción libre, ajustes por chat, reagendar, video | Sí, para la IA real           | Pago por uso           |
| 2   | **Supabase**                                                  | Login, guardar/compartir viajes, grupos, panel admin, caché                               | Sí, para cuentas              | Plan Free              |
| 3   | **Upstash Redis**                                             | Límites de uso globales (protege tu factura de IA)                                        | Muy recomendado en producción | Plan Free              |
| 4   | OpenWeather                                                   | Pronóstico real si el viaje empieza en ≤ 5 días                                           | Opcional                      | Gratis                 |
| 5   | Afiliados (Viator, Booking, Skyscanner/Travelpayouts, Airalo) | Ganar comisión con los enlaces                                                            | Opcional                      | Gratis                 |
| 6   | Stripe                                                        | Suscripciones Pro                                                                         | Solo si vas a cobrar          | Comisión por venta     |
| 7   | PostHog / Sentry                                              | Analítica / errores                                                                       | Opcional                      | Planes gratis          |
| 8   | Mapbox + Expo/EAS                                             | App móvil (mapa y builds)                                                                 | Solo móvil                    | Free / pago de tiendas |

---

## 1. IA — Anthropic (recomendado) o Groq (pruebas)

**Anthropic**

1. Entra en <https://platform.claude.com> (consola de Anthropic), carga créditos y crea una clave en **API Keys**.
2. En `.env.local`:
   ```
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Modelos por defecto (no hace falta tocarlos): `claude-opus-5-5` para el itinerario y los ajustes, `claude-haiku-5-5` para tareas rápidas (interpretar la descripción, alertas). Para abaratar el itinerario a la mitad: `AI_ITINERARY_MODEL=claude-sonnet-5-5`. Velocidad vs. calidad: `AI_ITINERARY_EFFORT=low|medium|high` (por defecto `medium`).
4. El servidor activa automáticamente el _fallback_ ante rechazos de los clasificadores de seguridad (`fallbacks: "default"`) en los modelos que lo admiten.

**Groq (gratis, cuota diaria limitada)**

```
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
GROQ_VISION_MODEL=qwen/qwen3.8-27b
```

Los modelos antiguos (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `llama-4-scout`) fueron dados de baja por Groq: si tu `.env.local` los tiene, cámbialos.

**Comprobar que la IA genera bien:** con el servidor corriendo, `npm run eval:ia -- --base http://localhost:3000` ejecuta la batería de 44 viajes de prueba (`scripts/eval-ia/casos.mjs`) y escribe un informe en `scripts/eval-ia/resultados/`. Opciones: `--interpret` (evalúa también la interpretación de texto libre), `--juez` (nota de calidad 1-5 de Claude), `--solo id1,id2`.

## 2. Supabase

1. <https://supabase.com> → tu proyecto (si está pausado, **Restore**). En **Project Settings → API** copia:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co     # sin /rest/v1
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...                          # la "service_role" (secreta), NO la anon
   NEXT_PUBLIC_BASE_URL=http://localhost:3000             # en producción, tu dominio
   ```
2. **Esquema y seguridad:** SQL Editor → New query → pega TODO [`supabase/migrations/20261008120000_seguridad_y_flujos.sql`](supabase/migrations/20261008120000_seguridad_y_flujos.sql) → Run. Si el proyecto está vacío, pega en su lugar [`supabase/schema.sql`](supabase/schema.sql) (ya lo incluye). Ambos son idempotentes. Esta migración corrige huecos graves (cualquiera podía hacerse admin; los grupos eran legibles por cualquier usuario) y activa compartir, unirse a grupos, referidos, reservas y realtime.
3. Revisa admins: `select id, email from public.profiles where role = 'admin';` y hazte admin con `update public.profiles set role = 'admin' where email = '<tu-email>';`.
4. **Realtime:** Database → Publications → `supabase_realtime`: deben estar `trip_members`, `group_messages`, `activity_votes`, `group_expenses`.
5. **Auth** (detalle paso a paso en [`supabase/CONFIGURACION-AUTH.md`](supabase/CONFIGURACION-AUTH.md)):
   - Authentication → URL Configuration: Site URL = tu dominio; Redirect URLs = `https://<tu-dominio>/**`, `http://localhost:3000/**` (proyecto de desarrollo) y `wayio://**`.
   - Providers → Email: Confirm email ON, contraseña mínima 8.
   - Emails → Templates: pega los 6 HTML de `supabase/templates/` (el `db push` NO los sube).
   - SMTP propio para producción (p. ej. Resend con dominio verificado).
   - Google: crea un OAuth Client (Web) en Google Cloud con redirect `https://<ref>.supabase.co/auth/v1/callback` y pégalo en Providers → Google.

## 3. Upstash Redis (límites de uso)

<https://upstash.com> → Redis → crea una base → pestaña **REST API**:

```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

Sin esto, los límites (6 itinerarios/hora sin sesión, 30 con sesión, etc.) se cuentan por instancia serverless y no son globales. En desarrollo están apagados salvo `RATE_LIMIT_ENFORCE=true`.

## 4. Mapa, geocoding y clima

- Mapa (MapLibre + OpenFreeMap) y geocoding (OpenStreetMap Nominatim): **gratis y sin clave**. Pon `NOMINATIM_EMAIL=tu@email` (lo pide su política de uso). Para tráfico alto, migra a un geocoder comercial (Geoapify, LocationIQ, OpenCage).
- Rutas exactas por calles entre paradas (`POST /api/ruta`): **OSRM** sobre OpenStreetMap, con los servidores públicos de FOSSGIS (`routing.openstreetmap.de`, perfiles a pie y en carro). Son gratis y sin clave, pero de **uso justo**. Los tramos de ≤ 1,6 km van a pie, los de hasta 250 km en carro, y los más largos o por mar se dibujan como arco. Las rutas se cachean en el servidor (7 días) y en la sesión del navegador.
  - Con tráfico real, monta tu propio OSRM (imagen Docker `osrm/osrm-backend` con el extracto de tu región de Geofabrik) y pon `OSRM_FOOT_URL` y `OSRM_CAR_URL` (URL base con el perfil, sin barra final). Otra opción es un proveedor comercial compatible (Stadia, GraphHopper, Mapbox Directions), adaptando `src/lib/api/rutas.ts`.
  - Si el servicio no responde, el mapa dibuja arcos y el itinerario no se rompe.
- Clima: <https://openweathermap.org/api> → API keys → `OPENWEATHER_API_KEY=` (tarda hasta 2 h en activarse). Si el viaje empieza en ≤ 5 días se usa el pronóstico real de esas fechas; si no, se muestra el clima actual con esa etiqueta.

## 5. Búsqueda real y afiliados

| Qué                    | Estado                                                                | Qué hacer                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vuelos con precio      | **Amadeus Self-Service cerró (17-jul-2026)**; no hay API autoservicio | Se usan enlaces de afiliado con fechas (Skyscanner/Aviasales/Google Flights). Para precios reales: Duffel (autoservicio) o Travelpayouts Data API                                          |
| Hoteles con precio     | La API de Booking exige contrato                                      | Enlaces de Booking con fechas y huéspedes. Para precios: LiteAPI (sandbox gratis)                                                                                                          |
| Actividades con precio | **Viator Partner API** (autoservicio "Basic Access")                  | Alta en <https://partnerresources.viator.com> → `VIATOR_API_KEY`, `NEXT_PUBLIC_VIATOR_PID`, `NEXT_PUBLIC_VIATOR_MCID` (prueba con `VIATOR_API_URL=https://api.sandbox.viator.com/partner`) |

IDs de afiliado (públicos; si faltan, los enlaces funcionan sin comisión): `NEXT_PUBLIC_BOOKING_AID` (Booking vía Awin/CJ), `NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID` (Impact), `NEXT_PUBLIC_TP_MARKER` (Travelpayouts/Aviasales), `NEXT_PUBLIC_AIRALO_REF`. Tras desplegar, haz un clic de prueba en cada panel de afiliado para confirmar la atribución.

## 6. Stripe (solo si vas a cobrar)

> Stripe no abre cuentas de comercio con sede en República Dominicana (verifícalo en stripe.com/global). Opciones: empresa en EE. UU. (Stripe Atlas), un _merchant of record_ (Paddle, Lemon Squeezy) o una pasarela local.

1. dashboard.stripe.com (modo **Test** primero) → Developers → API keys → `STRIPE_SECRET_KEY`.
2. Products (USD, importes de [`src/constants/pricing.ts`](src/constants/pricing.ts)):
   - «Wayio Pro Viajero»: recurrente mensual 6.99 → `STRIPE_PRICE_MONTHLY`; recurrente anual 49.99 → `STRIPE_PRICE_ANNUAL`.
   - «Wayio Pro por Viaje»: pago único 4.99 → `STRIPE_PRICE_PER_TRIP` (da Pro hasta el fin del viaje + 7 días).
   - «Wayio Pro Grupo»: recurrente mensual 12.99 → `STRIPE_PRICE_GROUP`.
3. Developers → Webhooks → endpoint `https://<tu-dominio>/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET`. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Settings → Billing → Customer portal: activa cancelar, cambiar método de pago y cambiar de plan; enlace de retorno `https://<tu-dominio>/cuenta`; **Save**.
5. El «depósito de reserva» queda **desactivado** (`NEXT_PUBLIC_RESERVAS_ENABLED=false`): hoy no hay un proveedor real de reservas detrás y cobrar un depósito sin reservar nada es un riesgo legal. Actívalo solo cuando lo haya.

## 7. Analítica y errores

- PostHog: <https://posthog.com> → Project API Key → `NEXT_PUBLIC_POSTHOG_KEY` y `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com` o `https://eu.i.posthog.com`). Sin clave no se envía nada.
- Sentry: proyecto Next.js en <https://sentry.io> → `NEXT_PUBLIC_SENTRY_DSN`. Para sourcemaps legibles: `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` (Settings → Auth Tokens), solo en el build de Vercel.

## 8. App móvil (Expo)

`mobile/.env` (ver `mobile/.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=...            # la misma de la web
EXPO_PUBLIC_SUPABASE_ANON_KEY=...       # la misma anon key
EXPO_PUBLIC_API_URL=http://<IP-LAN-de-tu-PC>:3000   # en un teléfono físico, no "localhost"
EXPO_PUBLIC_WEB_URL=https://<tu-dominio>
EXPO_PUBLIC_MAPBOX_TOKEN=pk....          # account.mapbox.com (token público)
```

- **Expo Go ya no abre este proyecto** (Expo Go va por un SDK más nuevo que el 54 del proyecto, y el mapa, la ubicación en segundo plano y los enlaces `wayio://` necesitan código nativo). Haz un _development build_: `cd mobile && npx expo install expo-dev-client expo-system-ui && npx expo run:android` (Android Studio) o `eas build --profile development`.
- Publicar en tiendas: Apple Developer (99 USD/año) y Google Play (25 USD, pago único). Para vender suscripciones dentro de la app revisa las reglas de pagos in-app de cada tienda.
