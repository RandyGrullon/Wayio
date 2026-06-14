# Guía paso a paso — API keys de Wayio

> Todo va en `.env.local` (no lo subas a git). Reinicia `npm run dev` tras editarlo.
> Sin ninguna key, la app corre en **modo demo** (datos de Tokio).

---

## 1. Amadeus (vuelos) — `AMADEUS_CLIENT_ID` y `AMADEUS_CLIENT_SECRET`

Gratis en entorno **test**, autoservicio. El código ya apunta a `test.api.amadeus.com`.

1. Entra a **https://developers.amadeus.com** y haz clic en **Register** (arriba a la derecha).
2. Crea la cuenta con tu email y confírmalo desde el correo que te llega.
3. Inicia sesión y ve a **My Self-Service Workspace** (menú de tu usuario) →
   **My apps**.
4. Pulsa **Create new app**:
   - **App name**: `Wayio` (lo que quieras).
   - Acepta los términos.
5. Al crearla verás dos valores en la pestaña de la app:
   - **API Key** → es tu `AMADEUS_CLIENT_ID`
   - **API Secret** → es tu `AMADEUS_CLIENT_SECRET`
6. Pégalos en `.env.local`:
   ```
   AMADEUS_CLIENT_ID=tu_api_key
   AMADEUS_CLIENT_SECRET=tu_api_secret
   ```

**Notas**

- El entorno **test** es gratis pero devuelve datos limitados/cacheados — perfecto
  para desarrollo. Para producción real hay que pasar la app a entorno
  **Production** (botón en la misma página) y meter método de pago; ahí cambiarías
  la URL base de `test.api.amadeus.com` a `api.amadeus.com` en
  `src/lib/api/amadeus.ts`.
- Con la misma cuenta tienes **Hotel Search API** si más adelante quieres hoteles
  reales sin pelear con Booking.com.

---

## 2. Sentry (monitoreo de errores) — `SENTRY_ORG`, `SENTRY_PROJECT` (y `SENTRY_DSN`)

1. Crea cuenta en **https://sentry.io/signup/** (plan free sirve).
2. En el onboarding, **crea un proyecto**:
   - **Platform**: elige **Next.js**.
   - **Project name**: `wayio` (o el que quieras).
3. Al terminar te muestra el **DSN** (una URL tipo
   `https://abc123@o456.ingest.sentry.io/789`). Eso es `SENTRY_DSN`.
   - Si lo pierdes: **Settings → Projects → wayio → Client Keys (DSN)**.
4. **`SENTRY_ORG`**: es el _slug_ de tu organización. Lo ves en la URL del
   dashboard: `https://<ORG-SLUG>.sentry.io/...` o en
   **Settings → General Settings → Organization Slug**.
5. **`SENTRY_PROJECT`**: es el nombre/slug del proyecto que creaste (`wayio`).
   Lo confirmas en **Settings → Projects** (la columna del slug).
6. En `.env.local`:
   ```
   SENTRY_DSN=https://...ingest.sentry.io/...
   SENTRY_ORG=tu-org-slug
   SENTRY_PROJECT=wayio
   ```

**Nota**: `SENTRY_ORG` y `SENTRY_PROJECT` los usa el plugin de build para subir
los _source maps_. El `SENTRY_DSN` es el que captura los errores en runtime.
Es 100% opcional para que la app funcione.

---

## 3. PostHog (analítica de producto) — `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

1. Crea cuenta en **https://posthog.com** → **Get started — free**.
2. Durante el registro eliges la **región de datos**:
   - **US** → host `https://us.i.posthog.com`
   - **EU** → host `https://eu.i.posthog.com`
   - Ese valor es tu `NEXT_PUBLIC_POSTHOG_HOST`.
3. Te crea un proyecto por defecto. Ve a
   **Settings (⚙️) → Project → Project API Key**.
4. Copia la **Project API Key** (empieza por `phc_...`).
   → es tu `NEXT_PUBLIC_POSTHOG_KEY`.
   - ⚠️ Usa la **Project API Key** (pública, `phc_`), **no** la Personal API Key.
5. En `.env.local`:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_tuclave
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```

**Nota**: como tienen prefijo `NEXT_PUBLIC_`, se exponen al navegador (es lo
esperado para PostHog). Si la key está vacía, PostHog simplemente no se inicializa.

---

## 4. (Opcional recomendado) OpenWeather — `OPENWEATHER_API_KEY`

Gratis, mejora el clima real en la pantalla de resultado.

1. Cuenta en **https://openweathermap.org/api** → **Sign up**.
2. **My API keys** (menú de tu usuario) → copia la **Default** key.
3. `OPENWEATHER_API_KEY=tu_key`
4. ⏳ La key tarda hasta ~1–2 horas en activarse la primera vez.

---

## 5. Booking.com — por qué NO ahora

`BOOKING_API_KEY` requiere ser **partner afiliado aprobado** de Booking
(Demand API / Distribution XML): proceso B2B, manual, con revisión. **No es
autoservicio.** Recomendación: deja `BOOKING_API_KEY` vacío y, si quieres hoteles
reales, usa **Amadeus Hotel Search** (misma cuenta del paso 1) o **Hotelbeds**.
Mientras tanto la IA ya propone hoteles por nombre y categoría.

---

## Prioridad sugerida

1. `GROQ_API_KEY` (gratis) o `ANTHROPIC_API_KEY` → **imprescindible** para IA real.
2. `NEXT_PUBLIC_SUPABASE_*` → login + guardar viajes.
3. `OPENWEATHER_API_KEY` → clima real (rápido y gratis).
4. `AMADEUS_*` → vuelos reales.
5. Sentry / PostHog → cuando quieras observabilidad/analítica.
6. Stripe → solo si vas a cobrar.
