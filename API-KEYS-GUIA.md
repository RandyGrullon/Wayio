# Guía de configuración — servicios y API keys de Wayio

> Todo va en `.env.local` en desarrollo (está en `.gitignore`) y en Vercel → Settings → Environment Variables en producción. Plantilla comentada: [`.env.example`](.env.example). Después de cambiar variables, reinicia `npm run dev` o vuelve a desplegar (las `NEXT_PUBLIC_*` se incrustan al compilar).
>
> Sin ninguna clave la app funciona en **modo demo**: muestra un itinerario de ejemplo, sin login ni pagos. Cada servicio que configures activa sus funciones; lo que falte se desactiva con mensajes amables (nunca con errores técnicos).

## Orden recomendado

| #   | Servicio                                                      | Para qué                                                                                  | ¿Obligatorio?                 | Coste                   |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | ----------------------- |
| 1   | **Anthropic (Claude)**                                        | Generar itinerarios, interpretar la descripción libre, ajustes por chat, reagendar, video | Sí, para la IA real           | Pago por uso            |
| 2   | **Supabase**                                                  | Login, guardar/compartir viajes, grupos, panel admin, caché                               | Sí, para cuentas              | Plan Free               |
| 3   | **Upstash Redis**                                             | Límites de uso globales (protege tu factura de IA)                                        | Muy recomendado en producción | Plan Free               |
| 4   | **Geoapify**                                                  | Ubicar lugares y rutas por calles en el mapa con uso comercial                            | Muy recomendado si cobras     | Plan Free (o US$59/mes) |
| 5   | OpenWeather                                                   | Pronóstico real si el viaje empieza en ≤ 5 días                                           | Opcional                      | Gratis                  |
| 6   | Afiliados (Viator, Booking, Skyscanner/Travelpayouts, Airalo) | Ganar comisión con los enlaces                                                            | Opcional                      | Gratis                  |
| 7   | Stripe                                                        | Suscripciones Pro                                                                         | Solo si vas a cobrar          | Comisión por venta      |
| 8   | PostHog / Sentry                                              | Analítica / errores                                                                       | Opcional                      | Planes gratis           |
| 9   | Mapbox + Expo/EAS                                             | App móvil (mapa y builds)                                                                 | Solo móvil                    | Free / pago de tiendas  |

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

**Comprobar que la IA genera bien:** con el servidor corriendo, `npm run eval:ia -- --base http://localhost:3000` ejecuta la batería de 44 viajes de prueba (`scripts/eval-ia/casos.mjs`) y escribe un informe en `scripts/eval-ia/resultados/`. Opciones: `--interpret` (evalúa también la interpretación de texto libre), `--juez` (nota de calidad 1-5 de Claude), `--solo id1,id2`. Generar exige sesión: con Supabase configurado pon `EVAL_IA_BEARER=<access_token de una cuenta de pruebas>` (en el entorno o en `.env.local`) y el script lo manda como `Authorization: Bearer`. Cada caso gasta del límite de esa cuenta y del tope diario.

## 2. Supabase

1. <https://supabase.com> → tu proyecto (si está pausado, **Restore**). En **Project Settings → API** copia:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co     # sin /rest/v1
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...                          # la "service_role" (secreta), NO la anon
   NEXT_PUBLIC_BASE_URL=http://localhost:3000             # en producción, tu dominio
   ```
2. **Esquema y seguridad:** SQL Editor → New query → pega TODO [`supabase/migrations/20261008120000_seguridad_y_flujos.sql`](supabase/migrations/20261008120000_seguridad_y_flujos.sql) → Run, y después [`supabase/migrations/20261017120000_ai_gasto_diario.sql`](supabase/migrations/20261017120000_ai_gasto_diario.sql) (la RPC del tope diario de IA). Si el proyecto está vacío, pega en su lugar [`supabase/schema.sql`](supabase/schema.sql) (ya lo incluye todo). Todos son idempotentes. La primera corrige huecos graves (cualquiera podía hacerse admin; los grupos eran legibles por cualquier usuario) y activa compartir, unirse a grupos, referidos, reservas y realtime.
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

Sin esto, los límites se cuentan por instancia serverless y no son globales. En desarrollo están apagados salvo `RATE_LIMIT_ENFORCE=true`; en producción se aplican siempre.

**Límites por cuenta** (beta, en [`src/lib/security/aiGuard.ts`](src/lib/security/aiGuard.ts)). Generar itinerarios, ajustarlos con IA y analizar fotos o videos **exigen sesión** (sin cuenta: 401 `auth_required`); interpretar la descripción y validar siguen abiertos con límite por IP.

| Función                               | Por hora                   | Por día |
| ------------------------------------- | -------------------------- | ------- |
| Generar (`/api/generate` y `/stream`) | 6                          | 20      |
| Ajustar con IA (`/api/adjust`)        | 20                         | 60      |
| Interpretar (`/api/interpret`)        | 20 sin cuenta, 60 con ella | —       |
| Recrear desde foto                    | 10                         | 20      |
| Recrear desde video                   | 5                          | 10      |

Al pasarse, la API responde 429 `rate_limit` con `retryAfter` y un mensaje que dice cuánto esperar. Con Upstash la ventana diaria es fija y se reinicia a las 00:00 UTC (8:00 p. m. de RD).

**Tope global de gasto diario:** `AI_DAILY_BUDGET_USD=25` (en USD, no es secreto) frena TODA la IA de la app cuando el gasto estimado de hoy (día natural de RD, desde ai_logs) llega al tope: generar, interpretar y analizar responden 429 `tope_diario` («Wayio llegó a su límite de IA por hoy») con `retryAfter` hasta las 12:00 a. m. de RD; ajustar y reagendar pasan a edición manual; validar y las alertas usan sus reglas locales. Al 125 % se corta también lo que ya estaba en marcha. Necesita la service role y la migración `20261017120000_ai_gasto_diario.sql`; si no puede leer el gasto, **deja pasar** y avisa en consola y Sentry. Es una estimación (precios de `src/lib/ai/pricing.ts`): como red final pon además un **límite de gasto mensual** en la consola de Anthropic (Settings → Limits), que corta en el proveedor aunque la app fallara.

## 4. Mapa, geocoding, rutas y clima

- **Mapa base** (MapLibre + OpenFreeMap): gratis y sin clave.
- **Geocoding y rutas por calles**: con `GEOAPIFY_API_KEY` se usa **Geoapify**; sin ella, el respaldo gratuito de OpenStreetMap (Nominatim + OSRM de FOSSGIS). El respaldo es de **uso justo** y no sirve para uso comercial intensivo, así que en producción, y sobre todo si vas a cobrar, pon la clave de Geoapify. Los tramos de ≤ 1,6 km van a pie, los de hasta 250 km en carro, y los más largos o por mar se dibujan como arco (con cualquiera de los dos proveedores).

### Geoapify (recomendado en producción)

1. Entra en <https://myprojects.geoapify.com>, crea una cuenta gratis (plan **Free**, sin tarjeta) y un proyecto, y copia su **API key**.
2. En `.env.local` y en Vercel:
   ```
   GEOAPIFY_API_KEY=...      # SECRETO: solo servidor, NUNCA con NEXT_PUBLIC_
   ```
   El servidor la manda en la cabecera `x-api-key`, nunca en la URL ni al navegador.
3. **Vuelve a desplegar.** Los créditos del mapa web («Powered by Geoapify») se deciden al compilar: `next.config.ts` expone al navegador solo el nombre del proveedor (`WAYIO_GEO_PROVEEDOR` = `geoapify` u `osm`), nunca la clave.
4. Comprueba con `npm run verificar` (hace una geocodificación y una ruta a pie de prueba en Santo Domingo).

Opcionales:

- `GEOAPIFY_BASE_URL`: URL base sin barra final. Por defecto `https://api.geoapify.com/v1`; `https://api-eu.geoapify.com/v1` para el endpoint de la UE o la URL de un mock local para pruebas.
- `GEOAPIFY_RPS`: peticiones por segundo como máximo por instancia (por defecto **4**, con margen sobre el límite de 5 del plan Free; como mucho 4 en vuelo). Súbelo solo si cambias a un plan con más peticiones por segundo.
- `GEOAPIFY_CREDITOS_DIA`: tope de créditos que la app puede gastar al día (día UTC), sumando todas las instancias si hay Upstash (`UPSTASH_REDIS_REST_*`; sin Upstash se cuenta por instancia). Por defecto **3000**, la cuota del plan Free. Al llegar al tope, la app deja de llamar a Geoapify hasta el día siguiente: las rutas salen estimadas (arcos) y los lugares sin verificar, pero nada se rompe y no hay sobrecostes. Súbelo si cambias de plan (p. ej. 10000 con API 10, o algo menos para dejar margen).

Cómo funciona:

- **Geocoding** (`/geocode/search`): sin la cola de 1,1 s de Nominatim. Las actividades se buscan dentro de una caja alrededor de la ciudad del día (la misma que con Nominatim) y con sesgo de proximidad, y se descartan siempre los aciertos gruesos (país, región, ciudad o código postal en vez del lugar), haya ciudad de referencia o no: cuando Geoapify no encuentra un sitio responde con la ciudad, y es mejor dejar el lugar sin verificar que poner el pin en el centro. Las búsquedas sin ciudad de referencia llevan un sesgo neutro (si no, Geoapify ordenaría según la IP del servidor de Vercel, en EE. UU.).
- **Rutas** (`/routing`, `walk` a pie y `drive` en carro): cada tramo se guarda por separado y solo se piden los que faltan, en una petición por racha de paradas encadenadas con el mismo modo (hasta 20 paradas), en paralelo y con un plazo total de 25 s (lo que no llegue sale estimado). Agrupar ahorra peticiones, no créditos: Geoapify cobra un crédito por tramo.
- **Caché**: en memoria y persistente entre instancias durante **30 días** (lo permiten sus términos). Los fallos transitorios (tiempo agotado, 429, 5xx) **no** se cachean; un «sin resultados» válido, sí. Un fallo de red, un 429 por ritmo o un 5xx se reintenta una vez; una cuota agotada (429 «Quota exceeded») no se reintenta.
- **Límites por IP** (solo con Geoapify, además de los de peticiones): `/api/ruta` deja gastar a cada IP 300 créditos cada 10 minutos (solo cuentan los tramos que no estaban en caché; los que pasan del límite salen estimados) y `/api/geocode`, 200 (lugares + ciudades de cada petición; al pasarlo responde 429). El gasto total lo acota `GEOAPIFY_CREDITOS_DIA`.
- **Si Geoapify falla**, el tramo se estima y el mapa dibuja un arco, y el lugar se queda con las coordenadas de la IA; el itinerario nunca se rompe y **no** se recurre a Nominatim ni a OSRM. Si una petición espera más de 8 s su turno en el limitador, se da por fallida, para que `/api/ruta` responda siempre a tiempo. Las claves inválidas (401/403) y la cuota agotada (429) dejan un aviso en los logs de Vercel (como mucho uno por minuto, sin la clave) y paran las llamadas un minuto; el presupuesto diario agotado también deja aviso.
- **Mapa del planificador**: mientras se verifican en segundo plano las coordenadas de un viaje nuevo, el mapa espera para pedir las rutas (si no, cada tramo se cobraría dos veces: con las coordenadas de la IA y con las verificadas).

**Límites del plan Free:** 3000 créditos al día y 5 peticiones por segundo. Una geocodificación cuesta 1 crédito y una ruta, paradas − 1 créditos (uno por tramo). Como referencia, un viaje nuevo de 5 días con unas 5 actividades por día gasta del orden de **45–50 créditos**: 1 del destino, 1–3 de las ciudades, 25 de los lugares (10 al generarlo y 15 en segundo plano) y 20 de los tramos de ruta, que se piden una sola vez. Eso da **≈ 60 viajes nuevos al día** en Free (≈ 200 con API 10). Volver a abrir un viaje (en otra pestaña, en el enlace compartido o en otro dispositivo) sale de la caché, y editar un día solo cobra los tramos que cambian.

**Atribución obligatoria en el plan Free:** un enlace «Powered by Geoapify» a <https://www.geoapify.com/> (sin `nofollow`) cerca del mapa y «© OpenStreetMap contributors» con enlace a <https://www.openstreetmap.org/copyright>. El mapa web ya muestra los dos: el de Geoapify en los créditos del mapa y el de OpenStreetMap lo trae el estilo de OpenFreeMap. La **app móvil** también pinta coordenadas de Geoapify (las verifica el backend al generar el viaje), así que su mapa muestra un enlace «Powered by Geoapify» arriba a la izquierda (el de OpenStreetMap va en los créditos de Mapbox, botón «i»); solo se oculta con `EXPO_PUBLIC_GEO_PROVEEDOR=osm`, si el servidor no tiene clave. Si algún día muestras resultados de Geoapify en otro sitio (correos, PDF), añade también los créditos.

**Cuándo pasar al plan API 10 (US$59 al mes, 10 000 créditos al día):** cuando el panel de Geoapify muestre que te acercas a los 3000 créditos diarios de forma sostenida o aparezcan avisos de cuota (429) en los logs de Vercel. Si el nuevo plan permite más peticiones por segundo, sube `GEOAPIFY_RPS`.

### Respaldo sin clave (OpenStreetMap)

- Geocoding con **Nominatim** público (1 petición/s global, con la cola del servidor y el candado de Upstash). Pon `NOMINATIM_EMAIL=tu@email` (lo pide su política de uso).
- Rutas con **OSRM** sobre OpenStreetMap, con los servidores públicos de FOSSGIS (`routing.openstreetmap.de`, perfiles a pie y en carro). Las rutas se cachean en el servidor (7 días) y en la sesión del navegador. Si prefieres tu propio OSRM (imagen Docker `osrm/osrm-backend` con el extracto de tu región de Geofabrik), pon `OSRM_FOOT_URL` y `OSRM_CAR_URL` (URL base con el perfil, sin barra final); con `GEOAPIFY_API_KEY` se ignoran.
- Si el servicio no responde, el mapa dibuja arcos y el itinerario no se rompe.

### Clima

- <https://openweathermap.org/api> → API keys → `OPENWEATHER_API_KEY=` (tarda hasta 2 h en activarse). Si el viaje empieza en ≤ 5 días se usa el pronóstico real de esas fechas; si no, se muestra el clima actual con esa etiqueta.

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
