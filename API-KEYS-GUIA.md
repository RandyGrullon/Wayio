# Guía de configuración — servicios y API keys de Wayio

> Todo va en `.env.local` en desarrollo (está en `.gitignore`) y en Vercel → Settings → Environment Variables en producción. Plantilla comentada: [`.env.example`](.env.example). Después de cambiar variables, reinicia `npm run dev` o vuelve a desplegar (las `NEXT_PUBLIC_*` se incrustan al compilar).
>
> Sin ninguna clave la app funciona en **modo demo**: muestra un itinerario de ejemplo, sin login ni pagos. Cada servicio que configures activa sus funciones; lo que falte se desactiva con mensajes amables (nunca con errores técnicos).

## Orden recomendado

| #   | Servicio                                         | Para qué                                                                                  | ¿Obligatorio?                 | Coste                                                   |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| 1   | **Anthropic (Claude)**                           | Generar itinerarios, interpretar la descripción libre, ajustes por chat, reagendar, video | Sí, para la IA real           | Pago por uso                                            |
| 2   | **Supabase**                                     | Login, guardar/compartir viajes, grupos, panel admin, caché                               | Sí, para cuentas              | Plan Free                                               |
| 3   | **Upstash Redis**                                | Límites de uso globales (protege tu factura de IA)                                        | Muy recomendado en producción | Plan Free                                               |
| 4   | **Geoapify**                                     | Ubicar lugares y rutas por calles en el mapa con uso comercial                            | Muy recomendado si cobras     | Plan Free (o US$59/mes)                                 |
| 5   | OpenWeather                                      | Pronóstico real si el viaje empieza en ≤ 5 días                                           | Opcional                      | Gratis                                                  |
| 6   | Precios, afiliados y worker de video (sección 5) | Precios reales de vuelos y hoteles, comisión por reservas y viajes desde video            | Opcional                      | Gratis (worker ~US$5)                                   |
| 7   | Creem (o Stripe como alternativa)                | Suscripciones Pro y Pase Pro de 30 días                                                   | Solo si vas a cobrar          | 3,9 % + US$0,40 / venta                                 |
| 7b  | RevenueCat + App Store / Google Play             | Vender Pro dentro de la app móvil (compras integradas)                                    | Solo si cobras en la app      | 15 % de la tienda; RevenueCat gratis hasta US$2.500/mes |
| 8   | PostHog / Sentry                                 | Analítica / errores                                                                       | Opcional                      | Planes gratis                                           |
| 9   | Mapbox + Expo/EAS                                | App móvil (mapa y builds)                                                                 | Solo móvil                    | Free / pago de tiendas                                  |

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
2. **Esquema y seguridad:** SQL Editor → New query → pega TODO [`supabase/migrations/20261008120000_seguridad_y_flujos.sql`](supabase/migrations/20261008120000_seguridad_y_flujos.sql) → Run, después [`supabase/migrations/20261017120000_ai_gasto_diario.sql`](supabase/migrations/20261017120000_ai_gasto_diario.sql) (la RPC del tope diario de IA) y por último [`supabase/migrations/20261017130000_cupos_y_rentabilidad.sql`](supabase/migrations/20261017130000_cupos_y_rentabilidad.sql) (cupos mensuales del plan Gratis, tabla privada de ajustes del admin e índice de `ai_logs` por usuario). Si el proyecto está vacío, pega en su lugar [`supabase/schema.sql`](supabase/schema.sql) (ya lo incluye todo). Todos son idempotentes. La primera corrige huecos graves (cualquiera podía hacerse admin; los grupos eran legibles por cualquier usuario) y activa compartir, unirse a grupos, referidos, reservas y realtime.
3. Revisa admins: `select id, email from public.profiles where role = 'admin';` y hazte admin con `update public.profiles set role = 'admin' where email = '<tu-email>';`. Después pon `WAYIO_OWNER_EMAILS=<tu-email>` (solo servidor, nunca `NEXT_PUBLIC_`; varios correos separados por comas): solo esas cuentas admin ven la calculadora de rentabilidad del panel. Sin la variable la ve cualquier admin.
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

**Cupo mensual del plan Gratis** ([`src/constants/planes.ts`](src/constants/planes.ts), aplicado en [`src/lib/planes/cupo.ts`](src/lib/planes/cupo.ts)): 2 viajes, 5 ajustes con IA y 3 fotos o videos por mes natural de RD; agotado, la API responde 402 `cupo_agotado` con la fecha de renovación. Pro no tiene cupo (solo los límites de arriba). Necesita la service role y la migración `20261017130000_cupos_y_rentabilidad.sql`; si no puede leer el plan o contar el uso, **deja pasar** y avisa en consola y Sentry.

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

## 5. Precios reales, afiliados y video

Todo funciona con solo poner la clave o el ID: sin ellos, la app se comporta como antes (enlaces sin comisión y sin precios).

### Precios de vuelos — Travelpayouts (`TRAVELPAYOUTS_TOKEN`)

1. Crea cuenta gratis en <https://www.travelpayouts.com> y únete al programa Aviasales.
2. En el panel, Profile → API token: copia el token a `TRAVELPAYOUTS_TOKEN` en Vercel (Production y Preview), sin `NEXT_PUBLIC`.
3. Tu número de socio (marker) va en `NEXT_PUBLIC_TP_MARKER`: sin él los enlaces funcionan pero no generan comisión.
4. Los precios son de caché de búsquedas de Aviasales de las últimas 48 h: Wayio los muestra como «desde», por persona y con aviso de que pueden cambiar. En rutas poco buscadas puede no haber precio (sale el enlace del buscador). Límite: 600 peticiones/min (Wayio cachea 1 h por búsqueda).

### Precios de hoteles — LiteAPI (`LITEAPI_KEY`)

1. Regístrate en <https://www.liteapi.travel> (sin tarjeta) → Developer → API Keys.
2. Para probar, usa la clave de sandbox: los precios salen marcados «de prueba».
3. Para precios reales, añade una tarjeta en el panel para obtener la clave de producción y configura el cobro de tus comisiones (payout). Pon la clave en `LITEAPI_KEY` (sin `NEXT_PUBLIC`).
4. Opcional, para cobrar comisión de LiteAPI: crea tu sitio de marca blanca (Whitelabel), elige tu comisión y pon su dirección en `LITEAPI_WHITELABEL_URL`. Sin ella, cada hotel enlaza a Booking con tu AID.
5. Límites: sandbox 5 peticiones/s, producción 250/s (Wayio cachea 30 min por búsqueda). Se muestra el mayor entre la tarifa y el precio público sugerido, como pide LiteAPI.

### Actividades con precio — Viator (`VIATOR_API_KEY`)

Alta en <https://partnerresources.viator.com> («Basic Access») → `VIATOR_API_KEY`, `NEXT_PUBLIC_VIATOR_PID` y `NEXT_PUBLIC_VIATOR_MCID` (prueba con `VIATOR_API_URL=https://api.sandbox.viator.com/partner`).

### Afiliados: solo hay que poner los IDs

Cada ID es una variable pública (`NEXT_PUBLIC_*` en la web y la misma con `EXPO_PUBLIC_*` en la app). Si falta, el enlace funciona igual pero sin comisión; la eSIM y el seguro solo se muestran con su ID. Junto a los botones de reserva sale siempre el aviso de enlace patrocinado (FTC y LSSI). Tras desplegar, haz un clic de prueba en cada enlace y comprueba que la URL final lleva tu ID.

1. **Travelpayouts** (vuelos y hoteles de Trip.com, 5,5 % en hoteles): crea un proyecto en travelpayouts.com. `NEXT_PUBLIC_TP_MARKER` es tu ID de socio (el `marker=` de cualquier enlace del panel); `NEXT_PUBLIC_TP_TRS` es el ID del proyecto (opcional). Conecta el programa **Trip.com** a tu proyecto y, aprobado, pon `NEXT_PUBLIC_TP_TRIPCOM=true`: los hoteles irán a Trip.com en vez de Booking. Comprobación: un enlace largo de Trip.com del panel debe llevar `p=8626` y `campaign_id=121` (si cambian, hay que actualizar el código).
2. **Viator** (actividades): `NEXT_PUBLIC_VIATOR_PID` y `NEXT_PUBLIC_VIATOR_MCID` salen de cualquier enlace del panel (`pid=P00…&mcid=…`). Hacen falta los dos.
3. **Airalo** (eSIM): `NEXT_PUBLIC_AIRALO_REF` es el código de «Invita y gana» de tu perfil en la app; con él aparece «eSIM con datos». Ese programa paga en crédito: la comisión en dinero (hasta 10 %) va por Impact y hoy no está integrada.
4. **Civitatis** (actividades en español, 8-10 %, cookie de 30 días): alta en civitatis.com/es/afiliados (piden una web de viajes publicada). `NEXT_PUBLIC_CIVITATIS_AID` es tu número de afiliado. Si no hay Viator, «Reservar» va a Civitatis. Exigen consentimiento de cookies de analítica y publicidad.
5. **Expedia** (Creator Program): no se integra; sus enlaces solo salen del Link Builder con la sesión iniciada.
6. **GetYourGuide** (actividades, cookie de 31 días): alta en partner.getyourguide.com. `NEXT_PUBLIC_GYG_PARTNER_ID` es el Partner ID (menú de tu nombre → Account details). Se usa si no hay Viator ni Civitatis.
7. **Seguro de viaje — IATI**: alta como colaborador en iatiseguros.com/alta-colaboradores (panel myiati.com). Tu enlace termina en `?r=XXXX`: pon ese valor en `NEXT_PUBLIC_IATI_REF`. IATI vende en España, Portugal, Italia, México, Colombia y Perú (revisa si te sirve para viajeros de RD). Heymondo no se integra: da una URL única sin ID.
8. **DiscoverCars** (carros, hasta 70 % de su margen, cookie de 365 días): alta en discovercars.com/affiliate. Tu enlace lleva `?a_aid=XXXX`: pon ese valor en `NEXT_PUBLIC_DISCOVERCARS_AID` y «Ver carros» irá a DiscoverCars en vez de Booking.

**Booking.com** exige aprobación por escrito para usar sus enlaces en un producto con IA. Deja `NEXT_PUBLIC_BOOKING_AID` vacío hasta tenerla; mientras, sus enlaces siguen funcionando sin comisión.

### Worker de video (Railway o Fly.io)

Opcional, para «Recrear desde un video» en producción. Despliega `worker-video/` siguiendo [`worker-video/README.md`](worker-video/README.md): en Railway, Root Directory `/worker-video`, variable `VIDEO_WORKER_SECRET` y Generate Domain; en Fly, `fly launch --copy-config`, `fly secrets set` y `fly deploy`. Después pon en Vercel `VIDEO_WORKER_URL` (la URL del worker) y `VIDEO_WORKER_SECRET` (el mismo secreto, `openssl rand -hex 32`) y vuelve a desplegar. No hace falta `VIDEO_ANALYSIS_ENABLED`; si existe con `false`, bórrala. El worker no lleva claves de IA. Coste aproximado: Railway Hobby US$5/mes con US$5 de consumo incluidos; Fly US$1-3/mes con apagado automático. Si YouTube, Instagram o TikTok bloquean la IP del servidor, añade `YTDLP_PROXY` en el worker (proxy residencial, de pago).

## 6. Pagos — Creem (principal) o Stripe (alternativa)

Stripe no abre cuentas a residentes de República Dominicana, así que el cobro web va por **Creem**, un _merchant of record_ (MoR): Creem es el vendedor legal, calcula y paga los impuestos de cada país, aparece en el recibo del cliente y te paga a tu banco de RD (o en USDC) los días 1 y 15. Comisión: 3,9 % + US$0,40 por venta, sin cuota mensual ni recargo internacional. El código de Stripe sigue ahí como alternativa.

- `PAYMENTS_PROVIDER=creem` (por defecto) o `stripe` decide dónde se abren los pagos **nuevos**. Quien ya paga con un proveedor sigue atendido por ese (portal, bajas y webhook), aunque cambies la variable.
- La web y la app móvil llaman a `/api/pagos/checkout`, `/api/pagos/portal` y `/api/pagos/suscripcion` (cancelar o reanudar al final del periodo desde **Tu cuenta**). `/api/stripe/checkout` y `/api/stripe/portal` siguen vivos como alias para las versiones ya publicadas de la app. Ningún texto al cliente nombra al procesador; la política de privacidad sí, la del proveedor activo.
- Base de datos: ejecuta [`supabase/migrations/20261105120000_cobros_creem.sql`](supabase/migrations/20261105120000_cobros_creem.sql) en Supabase → SQL Editor (admite `source = 'creem'` y crea `payment_events`). Sin ella los pagos activan el plan igual, pero no quedan marcados como Creem y el webhook pierde la idempotencia.

> Documentación oficial de Creem consultada el **5-nov-2026**: [API](https://docs.creem.io/api-reference/introduction) (base `https://api.creem.io`, test `https://test-api.creem.io`, cabecera `x-api-key`), [modo test](https://docs.creem.io/getting-started/test-mode), [webhooks y firma](https://docs.creem.io/code/webhooks), [crear checkout](https://docs.creem.io/api-reference/endpoint/create-checkout), [suscripción](https://docs.creem.io/api-reference/endpoint/get-subscription), [cancelar](https://docs.creem.io/api-reference/endpoint/cancel-subscription) / [reanudar](https://docs.creem.io/api-reference/endpoint/resume-subscription), [portal del cliente](https://docs.creem.io/features/customer-portal) ([enlace por API](https://docs.creem.io/api-reference/endpoint/create-customer-billing)), [bajas y reembolsos](https://docs.creem.io/features/subscriptions/refunds-and-cancellations), [productos](https://docs.creem.io/api-reference/endpoint/create-product), [revisión de cuenta](https://docs.creem.io/merchant-of-record/account-reviews/account-reviews) y [tarifas](https://www.creem.io/pricing).

### 6.1 Cuenta de Creem

1. Regístrate en <https://creem.io> y crea la tienda «Wayio» (email de soporte = el de `NEXT_PUBLIC_CONTACT_EMAIL`, que debe verse igual en la web y en los recibos).
2. Todo lo de abajo se hace primero con el interruptor **Test Mode** (abajo a la izquierda del panel) **activado**: el modo test es un entorno aparte, con sus propias claves, productos y webhooks.
3. Para cobrar de verdad, Creem revisa la tienda (1-2 días hábiles) desde **Balance → Payout Account → Set up Payout Account** (solo en modo producción). Pide: la web en **dominio propio** (no vale `*.vercel.app`), **Política de privacidad y Términos** visibles (ya están en `/privacidad` y `/terminos`), precios visibles (`/precios`), un email de soporte que responda, tu nombre o empresa, el país de residencia fiscal (RD) y una descripción del negocio. Wayio genera texto con IA, no imágenes ni video, así que no necesita su API de moderación. Puede que hagan una compra de prueba con un cupón del 100 %.

### 6.2 Productos (en Test Mode)

Products → Create product, en **USD**, categoría fiscal _SaaS / digital_, con los importes de [`src/constants/pricing.ts`](src/constants/pricing.ts). Copia cada id (`prod_…`):

| Producto                         | Tipo                 | Precio | Variable                 |
| -------------------------------- | -------------------- | ------ | ------------------------ |
| Wayio Pro Viajero Mensual        | Recurrente, cada mes | 6.99   | `CREEM_PRODUCT_MONTHLY`  |
| Wayio Pro Viajero Anual          | Recurrente, cada año | 49.99  | `CREEM_PRODUCT_ANNUAL`   |
| Wayio Pase Pro de 30 días        | Pago único           | 4.99   | `CREEM_PRODUCT_PER_TRIP` |
| Wayio Pro Grupo Mensual (oculto) | Recurrente, cada mes | 12.99  | `CREEM_PRODUCT_GROUP`    |

- El pase da Pro 30 días desde el pago (si se compra desde un viaje guardado, hasta el fin del viaje + 7 días). Pro Grupo no está a la venta (`PLANES_A_LA_VENTA`): su producto es opcional.
- **Impuestos (tax mode):** con _exclusive_ el impuesto del país se suma al precio al pagar y a ti te llega el precio de la tabla menos la comisión (es lo que supone la calculadora de `/admin/rentabilidad`; la página de planes ya avisa de que pueden sumarse impuestos). Con _inclusive_ el cliente paga justo 6.99, pero el impuesto sale de tu parte. Decídelo antes de crear los productos de producción.
- Developers → API keys → la clave de test (`creem_test_…`) → `CREEM_API_KEY`, y `CREEM_TEST_MODE=true`.
- **No compartas el enlace de pago público** de los productos ni los pongas en una _storefront_: Wayio abre cada pago por API con la cuenta del usuario en la metadata, y un pago hecho desde el enlace suelto no se puede asociar a nadie (el webhook lo registra como error y no activa ningún plan).

### 6.3 Webhook

Developers → Webhooks → endpoint `https://<tu-dominio>/api/creem/webhook`. Eventos: déjalo en «todos» o marca al menos `checkout.completed`, `subscription.active`, `subscription.paid`, `subscription.update`, `subscription.trialing`, `subscription.scheduled_cancel`, `subscription.past_due`, `subscription.unpaid`, `subscription.paused`, `subscription.canceled`, `subscription.expired` y `refund.created` (más `dispute.created` para que quede en el registro). Copia el secreto de firma → `CREEM_WEBHOOK_SECRET`.

- Cada evento llega firmado (`creem-signature`, HMAC-SHA256 del cuerpo) y el webhook rechaza los que no cuadran. Creem reintenta a los 30 s, 5 min, 30 min y 6 h si no recibe un 200; cada evento se procesa una sola vez (`payment_events`).
- Qué escribe en `subscriptions` (igual que el de Stripe, con `source = 'creem'`; las columnas `stripe_*` guardan los ids de Creem): suscripción activa o en prueba → Pro hasta `current_period_end`; baja programada → sigue Pro con «Cancelado: tienes acceso hasta…»; pago fallido (`past_due`) → conserva Pro mientras Creem reintenta; `unpaid`, `paused` o `canceled` → Gratis; pase pagado → Pro hasta la fecha del pase; reembolso total del pase → lo retira.
- **Bajas:** según su documentación, el portal de Creem cancela **en el acto**. Para cumplir la promesa de `/precios` («sigues con Pro hasta el final del periodo»), **Tu cuenta** tiene «Cancelar suscripción», que programa la baja al final del periodo por API. Si en los ajustes de facturación de tu tienda de Creem puedes elegir que las cancelaciones sean al final del periodo, actívalo también.

### 6.4 Probar en modo test

1. `.env.local` con las variables de arriba (`PAYMENTS_PROVIDER=creem`, `CREEM_TEST_MODE=true`) y `npm run verificar`: comprueba la clave, que cada producto existe en modo test con su tipo y precio, el secreto del webhook y la migración.
2. Para que los webhooks lleguen a tu PC: `creem listen --forward-to http://localhost:3000/api/creem/webhook` ([CLI de Creem](https://docs.creem.io/code/cli), reenvía con la firma real) o un túnel tipo ngrok registrado como endpoint de test.
3. `npm run dev` → `/precios` → «Continuar al pago» → paga con la tarjeta de prueba `4111 1111 1111 1111` (cualquier fecha futura y CVC). Para fallos: `4507 9900 0000 0028` (rechazada), `4507 9900 0000 0010` (sin fondos), `4507 9900 0000 0044` (CVC incorrecto).
4. Vuelves a `/cuenta?pago=ok` con el plan activo. Prueba también «Cancelar suscripción» / «Mantener mi suscripción», «Gestionar pagos» (portal de Creem) y el pase de 30 días. Desde el panel de Creem puedes reenviar eventos y hacer reembolsos de prueba.

**Sin cuenta de Creem todavía:** `npm run creem:mock` levanta un simulador local (`scripts/creem-mock.mjs`) con la misma API, una página de pago, el portal y webhooks firmados. Pon en `.env.local` `CREEM_API_URL=http://localhost:4010`, `CREEM_API_KEY=creem_test_simulador`, `CREEM_WEBHOOK_SECRET=whsec_simulador` y `CREEM_PRODUCT_MONTHLY|ANNUAL|PER_TRIP|GROUP` = `prod_sim_mensual|prod_sim_anual|prod_sim_pase|prod_sim_grupo` (las instrucciones están al principio del script). Usa un Supabase de **desarrollo**: el webhook escribe de verdad en `subscriptions`.

### 6.5 Pasar a producción

1. En el panel de Creem, desactiva Test Mode y aprueba la revisión de la cuenta (6.1).
2. Crea los **mismos productos** en producción (tienen ids nuevos), una clave de API de producción y un webhook de producción con su propio secreto.
3. En Vercel: `CREEM_API_KEY` (producción), `CREEM_TEST_MODE=false`, `CREEM_WEBHOOK_SECRET`, `CREEM_PRODUCT_*` de producción, `PAYMENTS_PROVIDER=creem` y **sin** `CREEM_API_URL`. Vuelve a desplegar.
4. Haz una compra real pequeña (el pase) y reembólsala desde el panel: el plan debe activarse y luego volver a Gratis. El panel admin muestra el proveedor en **Estado del entorno** y el origen «Creem» en Suscripciones.

### 6.6 Stripe (alternativa: `PAYMENTS_PROVIDER=stripe`)

> Solo tiene sentido con una empresa fuera de RD (p. ej. una LLC en EE. UU. con Stripe Atlas). Con Creem activo, las variables de Stripe pueden quedarse vacías.

1. dashboard.stripe.com (modo **Test** primero) → Developers → API keys → `STRIPE_SECRET_KEY`.
2. Products (USD, importes de [`src/constants/pricing.ts`](src/constants/pricing.ts)):
   - «Wayio Pro Viajero»: recurrente mensual 6.99 → `STRIPE_PRICE_MONTHLY`; recurrente anual 49.99 → `STRIPE_PRICE_ANNUAL`.
   - «Wayio Pase Pro de 30 días» (antes «Pro por Viaje»): pago único 4.99 → `STRIPE_PRICE_PER_TRIP` (da Pro 30 días desde el pago; si se compra desde un viaje guardado, hasta el fin del viaje + 7 días).
   - «Wayio Pro Grupo»: recurrente mensual 12.99 → `STRIPE_PRICE_GROUP`. **Oculto de la venta** (no está en `PLANES_A_LA_VENTA`): el checkout lo rechaza con 400 `plan_no_disponible`. Si ya tienes suscriptores, conserva el precio y la variable: el portal y el webhook siguen funcionando para ellos.
3. Developers → Webhooks → endpoint `https://<tu-dominio>/api/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET`. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Settings → Billing → Customer portal: activa cancelar, cambiar método de pago y cambiar de plan; enlace de retorno `https://<tu-dominio>/cuenta`; **Save**.
5. El «depósito de reserva» queda **desactivado** (`NEXT_PUBLIC_RESERVAS_ENABLED=false`): hoy no hay un proveedor real de reservas detrás y cobrar un depósito sin reservar nada es un riesgo legal. Actívalo solo cuando lo haya. **Solo existe con Stripe**: un MoR como Creem vende software, no depósitos de viajes de terceros, así que con `PAYMENTS_PROVIDER=creem` el checkout de reservas responde 403.

## 6b. Compras dentro de la app (RevenueCat, App Store y Google Play)

> Investigado en la documentación oficial el **2026-11-05** (fuentes al final de esta sección). Si lo retomas meses después, vuelve a mirar las reglas: cambian a menudo.

**Por qué.** Fuera de EE. UU., Apple (App Review Guidelines 3.1.1) y Google Play (política de pagos) obligan a vender las suscripciones digitales con sus compras integradas; la app no puede abrir el pago web ni enlazarlo. Wayio Pro no entra en ninguna excepción de la 3.1.3 (no es una app «Reader» ni un servicio que se consuma fuera de la app). La 3.1.3(b) sí permite que quien pagó Pro en la web lo use en la app, siempre que la app también lo venda con compras integradas. Comisión: **15 %** en Apple con el Small Business Program (ingresos ≤ US$1 M al año) y **15 %** en las suscripciones de Google Play. RevenueCat es gratis hasta US$2.500 de ingresos al mes; por encima cobra el 1 % de **todo** lo facturado.

**Cómo está hecho en el código.**

- **Basta con poner las claves**: en la app, la clave pública de RevenueCat de cada plataforma; en el servidor, `REVENUECAT_WEBHOOK_AUTH`. Lo demás tiene valores por defecto y solo se toca si usas otros identificadores.
- App (`mobile/src/lib/compras/tienda.ts` y `PaywallScreen.tsx`): con la clave de la plataforma (`EXPO_PUBLIC_REVENUECAT_IOS_KEY` o `_ANDROID_KEY`), los planes y precios salen de la oferta de RevenueCat y se pagan con la hoja de la tienda; `EXPO_PUBLIC_COMPRAS_TIENDA=false` lo apaga. Hay botón «Restaurar compras», aviso de renovación y enlaces a Términos y Privacidad (los exige Apple). Los planes se reconocen por el tipo de paquete ($rc_monthly, $rc_annual) y de producto (no renovable = pase), no por sus ids. El app_user_id de RevenueCat es el id de Supabase de la cuenta, así que comprar exige sesión. Sin clave, la app sigue con el pago web como antes.
- Servidor: `POST /api/revenuecat/webhook` comprueba la cabecera `Authorization` (`REVENUECAT_WEBHOOK_AUTH`), procesa cada `event.id` una sola vez (tabla `revenuecat_events`) y escribe en `subscriptions` con `source` `app_store` o `play_store`. El plan efectivo (RPC `my_effective_tier`, `/api/cupo` y el resto del servidor) da acceso hasta `current_period_end` más 3 horas, para cubrir la demora de las renovaciones y los reintentos del webhook (5 reintentos en unos 80 minutos).
- El **Pase Pro de 30 días** no se renueva. En el App Store es una **suscripción no renovable** y en Google Play un **producto único consumible**: se puede volver a comprar para otro viaje. Un «no consumible» solo se podría comprar una vez en la vida. El servidor le da 30 días desde la compra al recibir `NON_RENEWING_PURCHASE`. **No lo adjuntes al entitlement `pro`**: RevenueCat lo daría para siempre.
- Prueba local del webhook sin Supabase ni RevenueCat: `npm run probar:revenuecat`. Levanta un Supabase simulado y `next dev`, y comprueba 37 casos: compra, renovación, orden, cancelación, caducidad, reembolso, pase, transferencia, ids propios, reintentos y `/api/cupo`.

**Identificadores recomendados.** Con estos no hay que configurar nada. Si usas otros, ponlos en `REVENUECAT_PRODUCTOS_MENSUAL`, `_ANUAL` y `_PASE` (listas separadas por comas) o déjalos: el servidor deduce el plan del evento y lo avisa en el registro. El entitlement (`REVENUECAT_ENTITLEMENT` y `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`), la oferta (`EXPO_PUBLIC_REVENUECAT_OFERTA`) y el paquete del pase (`EXPO_PUBLIC_REVENUECAT_PAQUETE_PASE`) también se pueden cambiar.

| Plan                 | App Store                                           | Google Play                                                     | Paquete en la oferta de RevenueCat |
| -------------------- | --------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| Pro mensual 6.99     | `wayio_pro_mensual` (renovable, 1 mes)              | suscripción `wayio_pro`, plan base `mensual` (renovable, 1 mes) | `$rc_monthly`                      |
| Pro anual 49.99      | `wayio_pro_anual` (renovable, 1 año)                | suscripción `wayio_pro`, plan base `anual` (renovable, 1 año)   | `$rc_annual`                       |
| Pase de 30 días 4.99 | `wayio_pase_30_dias` (suscripción **no renovable**) | producto único `wayio_pase_30_dias` (**consumible**)            | a medida: `pase_30_dias`           |

### App Store Connect (Apple)

1. Programa de desarrolladores de Apple (99 USD/año) y la app `com.wayio.app` creada en App Store Connect.
2. **Business → Paid Apps Agreement**, firmado por el titular de la cuenta, con datos **fiscales y bancarios**. Sin él no funcionan ni las compras de prueba (sandbox).
3. Inscríbete en el **App Store Small Business Program** para pagar el 15 % en vez del 30 %.
4. **Monetization → Subscriptions**: crea el grupo «Wayio Pro» con `wayio_pro_mensual` (1 mes, 6.99) y `wayio_pro_anual` (1 año, 49.99). Ponles nombre, descripción y una captura de la pantalla de planes para la revisión.
5. **Monetization → In-App Purchases**: crea `wayio_pase_30_dias` como **Non-Renewing Subscription** (4.99).
6. **Users and Access → Integrations → In-App Purchase**: genera una **In-App Purchase Key** (.p8) y apunta el **Issuer ID**. Súbelos a RevenueCat; con el SDK actual son obligatorios, sin ellos las compras no se registran. El «App-Specific Shared Secret» ya es legado.
7. **App Information → App Store Server Notifications**: versión 2, con la URL que te da RevenueCat, en Production y en Sandbox. El botón «Apply in App Store Connect» de RevenueCat lo hace solo.
8. **Users and Access → Sandbox Testers**: crea testers de prueba. En el iPhone (iOS 18+), entra en Ajustes → Desarrollador → Sandbox Apple Account. En sandbox, 1 mes dura 5 minutos y 1 año dura 1 hora.
9. Metadatos: pon el enlace a los **Términos de uso** (`https://<tu-dominio>/terminos`, o la EULA estándar de Apple) en la descripción o en el campo EULA, y la **Política de privacidad** (`/privacidad`).
10. Las primeras compras integradas se envían a revisión **junto con una versión nueva de la app**. En las notas para la revisión, da una cuenta de prueba de Wayio: comprar exige sesión. Los revisores compran en sandbox y el webhook acepta esos eventos, que el admin marca como «App Store · prueba» y no suman al MRR.
11. En la tienda de **EE. UU.**, Apple ya permite además un botón hacia el pago web. En la app se activa con `EXPO_PUBLIC_CHECKOUT_WEB_EEUU=true` (solo iOS). Fuera de EE. UU. está prohibido sin un permiso especial de la 3.1.1(a), que hoy existe para la UE, Japón y Brasil.

### Google Play Console

1. Cuenta de desarrollador (25 USD) y **perfil de pagos** de comerciante vinculado.
2. **Cuenta personal creada después del 13-nov-2023**: antes de pedir acceso a producción necesitas una **prueba cerrada con al menos 12 testers inscritos de forma continua durante 14 días**. Si alguien sale y vuelve a entrar, su cuenta de 14 días empieza de cero. Empieza pronto: es lo que más tarda.
3. Sube un primer AAB (`com.wayio.app`) a una pista de prueba: sin él no se pueden crear productos.
4. **Monetize with Play → Products → Subscriptions**: suscripción `wayio_pro` con los planes base `mensual` (renovación automática, 1 mes, 6.99) y `anual` (1 año, 49.99). Los ids de los planes base no se pueden reutilizar.
5. **Monetize with Play → Products → One-time products**: `wayio_pase_30_dias` (4.99). En RevenueCat déjalo como **consumible** (el valor por defecto).
6. Credenciales para RevenueCat. Tardan **hasta 36 h** en funcionar:
   - en Google Cloud, activa «Google Play Android Developer API» y «Google Play Developer Reporting API»;
   - crea una cuenta de servicio con los roles **Pub/Sub Editor** y **Monitoring Viewer**, y genera su clave JSON;
   - en Play Console → Users and permissions, invítala con permiso para ver la información de la app y los informes masivos, ver los datos financieros, gestionar pedidos y suscripciones, y gestionar la presencia en la tienda;
   - sube el JSON a RevenueCat.
7. **Notificaciones en tiempo real (RTDN)**: en RevenueCat pulsa «Connect to Google», que crea el topic de Pub/Sub. Pega su id en **Monetize with Play → Monetization setup**, marca suscripciones, compras anuladas y todos los productos únicos, y usa «Send test notification».
8. **License testing**: añade los correos de los testers (tarjetas de prueba; 1 mes dura 5 minutos y como mucho se renueva 6 veces).
9. Requisito técnico: las apps nuevas y las actualizaciones necesitan **Play Billing Library 8 o superior** desde el 1-nov-2026. `react-native-purchases` 10.16 trae la 8.3.
10. En EE. UU., el EEE y el Reino Unido, Google permite desde el 30-jun-2026 ofrecer otro pago junto a Play Billing. Exige inscribirse en su programa y pagar su tarifa, así que la app **no** lo ofrece en Android.

### RevenueCat

1. Crea el proyecto «Wayio» en app.revenuecat.com con dos apps: App Store (`com.wayio.app`, con la clave .p8 y el Issuer ID) y Play Store (`com.wayio.app`, con el JSON de la cuenta de servicio).
2. **Product catalog → Products**: importa los productos de las dos tiendas. En Google las suscripciones aparecen como `wayio_pro:mensual` y `wayio_pro:anual`.
3. **Entitlements**: crea `pro` y adjúntale **solo** las suscripciones (`wayio_pro_mensual`, `wayio_pro_anual`, `wayio_pro:mensual`, `wayio_pro:anual`). El pase **no** se adjunta.
4. **Offerings**: crea `default`, márcala como actual («current») y añade los paquetes `$rc_monthly` (los dos mensuales), `$rc_annual` (los dos anuales) y uno a medida, `pase_30_dias` (los dos pases).
5. **Project settings → API keys**: copia la clave pública de cada app en `mobile/.env` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY` y `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`). Las claves secretas (`sk_…`) nunca van en la app.
6. **Integrations → Webhooks**: URL `https://<tu-dominio>/api/revenuecat/webhook`, con «Authorization header value» igual a `REVENUECAT_WEBHOOK_AUTH` (con o sin `Bearer `) y eventos de producción y sandbox. Pulsa «Send test event»: debe responder 200.
7. **Project settings → Restore behavior**: deja «Transfer to new App User ID» (el valor por defecto). El webhook mueve la compra a la cuenta que restaura (evento `TRANSFER`).
8. «Test Store» de RevenueCat: sirve solo en builds de depuración (en TestFlight y en las pistas de prueba de Play el SDK se cuelga a propósito) y no admite suscripciones no renovables. Además, el webhook ignora sus eventos: prueba con el sandbox de cada tienda.

### App y servidor

- Vercel: `REVENUECAT_WEBHOOK_AUTH` (un secreto largo, `openssl rand -hex 32`) y la migración `supabase/migrations/20261105130000_compras_en_tienda.sql` aplicada. Su CHECK de `source` es aditivo: conserva los valores que ya existan (por ejemplo, `creem`) y suma los de la tienda. `npm run verificar` lo comprueba («Migración 7» y «REVENUECAT_WEBHOOK_AUTH»).
- `mobile/.env`: las dos claves públicas, y nada más. `EXPO_PUBLIC_CHECKOUT_WEB_EEUU=true` solo si quieres el pago web en EE. UU. (iOS).
- `react-native-purchases` va fijado en la **10.x**: la 11.0 pide a las apps Expo quedarse en la 10.x mientras no salga su pod en CocoaPods. Es código nativo: haz un _development build_ nuevo (`npx expo run:ios` o `npx expo run:android`, o `eas build --profile development`). En Expo Go el SDK entra en «Preview API Mode»: se ve la pantalla, pero no se compra de verdad.
- Si compilas iOS con **Xcode 27**, RevenueCat avisa de que Expo SDK ≤ 56 necesita un ajuste `post_install` en el Podfile. Revisa qué Xcode usa la imagen de EAS antes de la primera build.
- Prueba en sandbox, de punta a punta:
  1. compra mensual: en Supabase, `subscriptions` pasa a `source = app_store` (o `play_store`), `store_environment = SANDBOX` y `current_period_end` unos minutos después;
  2. deja que renueve y caduque: la fila vuelve a Gratis tras el último periodo, más 3 h;
  3. compra el pase: 30 días desde la compra;
  4. borra la app, vuelve a entrar con la misma cuenta y toca «Restaurar compras»;
  5. entra con otra cuenta de Wayio en el mismo teléfono y restaura: la compra pasa a esa cuenta.

**Fuentes (consultadas el 2026-11-05):**

- Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (última actualización: 16-oct-2026) · [Suscripciones](https://developer.apple.com/app-store/subscriptions/) · [Small Business Program](https://developer.apple.com/app-store/small-business-program/) · [Configurar compras integradas](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases) · [StoreKit External Purchase](https://developer.apple.com/documentation/storekit/external-purchase).
- Google Play: [Política de pagos](https://support.google.com/googleplay/android-developer/answer/9858738) · [Comisiones](https://support.google.com/googleplay/android-developer/answer/112622) · [Cambios de facturación (blog, 24-jun-2026)](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html) · [Requisito de prueba para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465) · [Plazos de Play Billing Library](https://developer.android.com/google/play/billing/deprecation-faq) · [Productos únicos](https://developer.android.com/google/play/billing/one-time-products) · [Pruebas](https://developer.android.com/google/play/billing/test).
- RevenueCat: [Instalación en Expo](https://www.revenuecat.com/docs/getting-started/installation/expo) · [Identificar clientes](https://www.revenuecat.com/docs/customers/identifying-customers) · [Restaurar compras](https://www.revenuecat.com/docs/getting-started/restoring-purchases) · [Comportamiento de restauración](https://www.revenuecat.com/docs/projects/restore-behavior) · [Webhooks](https://www.revenuecat.com/docs/integrations/webhooks) · [Tipos de evento y campos](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields) · [Clave In-App Purchase de Apple](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/in-app-purchase-key-configuration) · [Credenciales de Play](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials) · [Notificaciones de Google](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications) · [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store) · [Precios](https://www.revenuecat.com/pricing/) · [Notas de la versión 11.0.0 del SDK](https://github.com/RevenueCat/react-native-purchases/releases/tag/11.0.0).
- Expo: [Compras integradas](https://docs.expo.dev/guides/in-app-purchases/) (última actualización: 25-sep-2026) · [Development builds](https://docs.expo.dev/develop/development-builds/introduction/) (última actualización: 2-nov-2026).
- Notas completas de la investigación, con lo no verificado marcado como tal: `investigacion-compras-integradas.md` en la carpeta de notas de la sesión. No está en el repo.

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

- Afiliados y analítica: los mismos IDs de la sección 5 con `EXPO_PUBLIC_*` (también `EXPO_PUBLIC_VIATOR_PID`, `_VIATOR_MCID`, `_CIVITATIS_AID` y `_GYG_PARTNER_ID` para «Reservar» por actividad) y `EXPO_PUBLIC_POSTHOG_KEY` / `_HOST` para medir los clics. Expo incrusta estas variables al compilar: tras cambiarlas, nueva build.
- **Expo Go ya no abre este proyecto** (Expo Go va por un SDK más nuevo que el 54 del proyecto, y el mapa, la ubicación en segundo plano y los enlaces `wayio://` necesitan código nativo). Haz un _development build_: `cd mobile && npx expo install expo-dev-client expo-system-ui && npx expo run:android` (Android Studio) o `eas build --profile development`.
- Publicar en tiendas: Apple Developer (99 USD/año) y Google Play (25 USD, pago único). Para vender Pro dentro de la app: sección 6b (RevenueCat, compras integradas y prueba cerrada de Google Play).
