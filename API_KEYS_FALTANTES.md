# API keys — estado y lo que falta

> Estado al 2026-06-14. Comparación entre `.env.example` y tu `.env.local`.
> Los **valores** de tus claves no se muestran aquí (siguen solo en `.env.local`,
> que está en `.gitignore` y nunca se sube a GitHub).
>
> La app corre en **modo demo** sin ninguna key. Cada sección explica qué
> desbloqueas al añadir cada una.

## 🔴 Crítico (bloquea funciones core)

| Variable                    | Estado actual                         | Qué desbloquea                                                             |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **Incorrecta** (es la _anon key_)  | Panel admin, guardar viajes server-side, caché de viajes, compartir viajes |
| `ANTHROPIC_API_KEY`         | ❌ Vacía (ahora usas Groq, ver abajo) | IA de producción con cuota real                                            |

### `SUPABASE_SERVICE_ROLE_KEY` ⚠️

Está **puesta pero es la clave equivocada**: su payload JWT dice `"role":"anon"`,
es decir, copiaste la _anon key_ en su lugar (es idéntica a
`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

- **Dónde**: Supabase → tu proyecto → **Settings → API → Project API keys →
  `service_role`** (la marcada como _secret_).
- **Pégala** en `.env.local` reemplazando el valor actual.
- Sin esto fallan: `/admin`, guardado de viajes (`/api/trips`), `trip_cache` y el
  botón **Compartir** (que guarda el viaje antes de generar el link público).

### `ANTHROPIC_API_KEY` ❌

Vacía. Hoy la IA funciona porque tienes **`AI_PROVIDER=groq`** y `GROQ_API_KEY`
configurada (plan gratis: ~100k tokens/día, 6k/min — se agota rápido).

- Para producción: consigue la key en <https://console.anthropic.com> →
  **API Keys**, pégala y cambia `AI_PROVIDER=anthropic`.
- Alternativa rápida si agotas Groq: `GROQ_MODEL=llama-3.1-8b-instant` (más cuota).

## 🟡 Mejoran la experiencia (opcionales, recomendadas)

| Variable                                      | Estado    | Qué desbloquea                                                                |
| --------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY`                         | ❌ Vacía  | Tiempos de viaje reales entre actividades (ahora se estiman)                  |
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | ❌ Vacías | Búsqueda real de vuelos/hoteles (tier de test gratis)                         |
| `BOOKING_API_KEY` / `VIATOR_API_KEY`          | ❌ N/A    | Stubs en `src/lib/api/` (no están en `.env.example`; añádelas si las activas) |

- **Google Maps**: <https://console.cloud.google.com> → APIs & Services →
  Credentials. Habilita **Distance Matrix API**.
- **Amadeus**: <https://developers.amadeus.com> → My Self-Service Workspace →
  crea una app (test environment) → `API Key` y `API Secret`.

## 💳 Monetización — Stripe (todas vacías)

Solo si vas a cobrar (paywall, reservas, grupos). Todas en
<https://dashboard.stripe.com> (usa **modo test** primero):

| Variable                             | Dónde                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| `STRIPE_SECRET_KEY`                  | Developers → API keys → _Secret key_                   |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Developers → API keys → _Publishable key_              |
| `STRIPE_WEBHOOK_SECRET`              | Developers → Webhooks → tu endpoint → _Signing secret_ |
| `STRIPE_PRICE_MONTHLY`               | Products → precio mensual → `price_…`                  |
| `STRIPE_PRICE_ANNUAL`                | Products → precio anual → `price_…`                    |
| `STRIPE_PRICE_PER_TRIP`              | Products → precio por viaje → `price_…`                |
| `STRIPE_PRICE_GROUP`                 | Products → precio grupo → `price_…`                    |

## 📊 Analítica y monitoreo (opcionales)

| Variable                  | Estado   | Qué desbloquea                                           |
| ------------------------- | -------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY` | ❌ Vacía | Analítica de producto (PostHog). `..._HOST` ya está.     |
| `SENTRY_ORG`              | ❌ Vacía | Subida de source maps en el build (`SENTRY_DSN` ya está) |
| `SENTRY_PROJECT`          | ❌ Vacía | Igual que arriba                                         |

- **PostHog**: <https://us.posthog.com> → Project settings → _Project API Key_.
- **Sentry**: <https://sentry.io> → Settings → tu org/proyecto (el _slug_).

## ✅ Ya configuradas (referencia)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GROQ_API_KEY` (+ `GROQ_MODEL`, `GROQ_VISION_MODEL`), `AI_PROVIDER=groq`
- `OPENWEATHER_API_KEY` (clima real)
- `NEXT_PUBLIC_POSTHOG_HOST`, `SENTRY_DSN`, `NEXT_PUBLIC_BASE_URL`

> Sin coste extra: el **mapa** usa MapLibre + OpenFreeMap y la **geocodificación**
> usa OpenStreetMap/Nominatim — ninguno requiere API key.
