#!/usr/bin/env node
/**
 * Comprueba que cada servicio de Wayio está configurado y responde, sin
 * imprimir nunca un valor secreto. Solo hace peticiones de lectura (listar
 * modelos, leer el esquema, un ping), así que no gasta tokens de IA ni crea
 * datos. Con GEOAPIFY_API_KEY gasta 2 créditos de su cuota diaria (una
 * geocodificación y una ruta a pie).
 *
 *   npm run verificar            # lee .env.local (y .env si existe)
 *
 * Estados: OK · FALTA (obligatorio sin configurar) · ERROR (configurado pero
 * no responde o la clave no vale) · OPCIONAL (sin configurar, la app funciona
 * sin él) · AVISO (funciona, pero hay algo que revisar).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')

// ── Variables: .env.local y .env, sin pisar lo que ya venga del entorno ─────
for (const archivo of ['.env.local', '.env']) {
  const ruta = join(RAIZ, archivo)
  if (!existsSync(ruta)) continue
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea)
    if (!m) continue
    const valor = m[2].replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor
  }
}
const env = (k) => process.env[k]?.trim() || ''

const resultados = []
const anotar = (grupo, nombre, estado, detalle = '') =>
  resultados.push({ grupo, nombre, estado, detalle })

async function pedir(url, init = {}, ms = 10_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
  let cuerpo = null
  const tipo = res.headers.get('content-type') ?? ''
  try {
    cuerpo = tipo.includes('json') ? await res.json() : await res.text()
  } catch {
    cuerpo = null
  }
  return { status: res.status, ok: res.ok, cuerpo }
}

const motivo = (e) =>
  e?.name === 'TimeoutError'
    ? 'no respondió en 10 s'
    : (e?.message ?? String(e))

// ── IA ──────────────────────────────────────────────────────────────────────
async function ia() {
  const proveedor = env('AI_PROVIDER') || 'anthropic'
  if (proveedor === 'groq') {
    if (!env('GROQ_API_KEY'))
      return anotar(
        'IA',
        'Groq',
        'FALTA',
        'GROQ_API_KEY vacía (AI_PROVIDER=groq)'
      )
    try {
      const r = await pedir('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${env('GROQ_API_KEY')}` },
      })
      if (!r.ok)
        return anotar(
          'IA',
          'Groq',
          'ERROR',
          `HTTP ${r.status}: la clave no es válida`
        )
      const ids = (r.cuerpo?.data ?? []).map((m) => m.id)
      const modelo = env('GROQ_MODEL') || 'openai/gpt-oss-120b'
      anotar(
        'IA',
        'Groq',
        ids.includes(modelo) ? 'OK' : 'AVISO',
        ids.includes(modelo)
          ? `modelo ${modelo} disponible`
          : `el modelo ${modelo} no aparece en la cuenta`
      )
    } catch (e) {
      anotar('IA', 'Groq', 'ERROR', motivo(e))
    }
    return
  }
  if (!env('ANTHROPIC_API_KEY')) {
    return anotar(
      'IA',
      'Anthropic (Claude)',
      'FALTA',
      'ANTHROPIC_API_KEY vacía: la app solo mostrará el viaje de ejemplo'
    )
  }
  try {
    const r = await pedir('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': env('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
      },
    })
    if (r.status === 401)
      return anotar(
        'IA',
        'Anthropic (Claude)',
        'ERROR',
        'la clave no es válida (401)'
      )
    if (!r.ok)
      return anotar('IA', 'Anthropic (Claude)', 'ERROR', `HTTP ${r.status}`)
    const ids = (r.cuerpo?.data ?? []).map((m) => m.id)
    const necesarios = [
      env('AI_ITINERARY_MODEL') || 'claude-opus-5-5',
      env('AI_FAST_MODEL') || 'claude-haiku-5-5',
    ]
    const faltan = necesarios.filter((m) => !ids.includes(m))
    anotar(
      'IA',
      'Anthropic (Claude)',
      faltan.length ? 'AVISO' : 'OK',
      faltan.length
        ? `la cuenta no lista: ${faltan.join(', ')}`
        : `clave válida; modelos ${necesarios.join(' y ')} disponibles`
    )
  } catch (e) {
    anotar('IA', 'Anthropic (Claude)', 'ERROR', motivo(e))
  }
}

// ── Tope global de gasto diario de IA (src/lib/ai/presupuesto.ts) ──────────
async function topeIa() {
  const crudo = env('AI_DAILY_BUDGET_USD')
  const tope = Number.parseFloat(crudo)
  if (!crudo) {
    return anotar(
      'IA',
      'Tope diario de gasto',
      'OPCIONAL',
      'AI_DAILY_BUDGET_USD vacía: sin tope global (recomendado en producción)'
    )
  }
  anotar(
    'IA',
    'Tope diario de gasto',
    Number.isFinite(tope) && tope > 0 ? 'OK' : 'ERROR',
    Number.isFinite(tope) && tope > 0
      ? `US$${tope} por día de RD (necesita la service role y la migración 4)`
      : `AI_DAILY_BUDGET_USD="${crudo}" no es un número > 0: se ignora (sin tope)`
  )
}

// ── Supabase: conexión, migraciones, admin y auth ───────────────────────────
const TABLAS_MIG_1 = [
  'profiles',
  'trips',
  'trip_cache',
  'trip_members',
  'activity_votes',
  'group_messages',
  'group_expenses',
  'subscriptions',
  'referrals',
  'ai_logs',
  'feature_flags',
  'announcements',
  'device_tokens',
  'admin_audit_log',
  'app_settings',
]
const TABLAS_MIG_3 = [
  'referral_redemptions',
  'activity_states',
  'reservations',
  'stripe_events',
]
const RPC_MIG_3 = [
  'join_trip',
  'get_shared_trip',
  'is_trip_member',
  'my_effective_tier',
  'my_referral_code',
  'apply_referral',
  'register_device',
]
const RPC_MIG_4 = ['ai_gasto_desde']
const TABLAS_MIG_5 = ['usage_counters', 'admin_private_settings']
const RPC_MIG_5 = ['consumir_cupo', 'devolver_cupo']

async function supabase() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const faltan = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !service && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)
  if (faltan.length) {
    return anotar(
      'Base de datos',
      'Supabase',
      'FALTA',
      `vacías: ${faltan.join(', ')} (sin esto no hay login, ni guardar viajes, ni grupos, ni admin)`
    )
  }
  let esquema
  try {
    const r = await pedir(`${url}/rest/v1/`, {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        Accept: 'application/openapi+json',
      },
    })
    if (r.status === 401 || r.status === 403) {
      return anotar(
        'Base de datos',
        'Supabase',
        'ERROR',
        'la SUPABASE_SERVICE_ROLE_KEY no es válida para este proyecto'
      )
    }
    if (!r.ok)
      return anotar(
        'Base de datos',
        'Supabase',
        'ERROR',
        `HTTP ${r.status} (¿proyecto pausado?)`
      )
    esquema = r.cuerpo
  } catch (e) {
    return anotar(
      'Base de datos',
      'Supabase',
      'ERROR',
      `${motivo(e)} (¿proyecto pausado o URL mal escrita?)`
    )
  }
  anotar(
    'Base de datos',
    'Conexión',
    'OK',
    'proyecto accesible con la service role'
  )

  const rutas = Object.keys(esquema?.paths ?? {})
  const hay = (t) => rutas.includes(`/${t}`)
  const hayRpc = (f) => rutas.includes(`/rpc/${f}`)
  const falta1 = TABLAS_MIG_1.filter((t) => !hay(t))
  anotar(
    'Base de datos',
    'Migración 1 · esquema inicial',
    falta1.length ? 'FALTA' : 'OK',
    falta1.length
      ? `faltan tablas: ${falta1.join(', ')} → ejecuta 20260101000000_initial_schema.sql`
      : `${TABLAS_MIG_1.length} tablas`
  )
  anotar(
    'Base de datos',
    'Migración 2 · alta de usuarios',
    hayRpc('gen_referral_code') ? 'OK' : 'FALTA',
    hayRpc('gen_referral_code')
      ? 'función de alta y referidos'
      : 'ejecuta 20260627120000_auth_signup_provisioning.sql'
  )
  const falta3 = [
    ...TABLAS_MIG_3.filter((t) => !hay(t)),
    ...RPC_MIG_3.filter((f) => !hayRpc(f)).map((f) => `rpc ${f}`),
  ]
  anotar(
    'Base de datos',
    'Migración 3 · seguridad y flujos',
    falta3.length ? 'FALTA' : 'OK',
    falta3.length
      ? `faltan: ${falta3.join(', ')} → ejecuta 20261008120000_seguridad_y_flujos.sql`
      : 'RLS, compartir, grupos, referidos y reservas'
  )
  const falta4 = RPC_MIG_4.filter((f) => !hayRpc(f))
  anotar(
    'Base de datos',
    'Migración 4 · gasto diario de IA',
    falta4.length ? 'FALTA' : 'OK',
    falta4.length
      ? `faltan: ${falta4.map((f) => `rpc ${f}`).join(', ')} → ejecuta 20261017120000_ai_gasto_diario.sql (sin ella el tope AI_DAILY_BUDGET_USD queda abierto)`
      : 'RPC del tope diario de IA'
  )
  const falta5 = [
    ...TABLAS_MIG_5.filter((t) => !hay(t)),
    ...RPC_MIG_5.filter((f) => !hayRpc(f)).map((f) => `rpc ${f}`),
  ]
  anotar(
    'Base de datos',
    'Migración 5 · cupos y rentabilidad',
    falta5.length ? 'FALTA' : 'OK',
    falta5.length
      ? `faltan: ${falta5.join(', ')} → ejecuta 20261017130000_cupos_y_rentabilidad.sql (sin ella el cupo del plan Gratis queda abierto)`
      : 'cupos del plan Gratis y ajustes privados del admin'
  )

  if (hay('profiles')) {
    try {
      const r = await fetch(`${url}/rest/v1/profiles?select=id&role=eq.admin`, {
        method: 'HEAD',
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
          Prefer: 'count=exact',
        },
        signal: AbortSignal.timeout(10_000),
      })
      const total = Number(
        (r.headers.get('content-range') ?? '').split('/')[1] ?? 0
      )
      anotar(
        'Base de datos',
        'Administradores',
        total > 0 ? 'OK' : 'AVISO',
        total > 0
          ? `${total} cuenta(s) con rol admin`
          : "ninguna: regístrate y ejecuta update profiles set role = 'admin' where id = '<tu id>'"
      )
    } catch (e) {
      anotar('Base de datos', 'Administradores', 'ERROR', motivo(e))
    }
  }

  try {
    const r = await pedir(`${url}/auth/v1/settings`, {
      headers: { apikey: anon },
    })
    if (!r.ok)
      return anotar(
        'Base de datos',
        'Auth',
        'ERROR',
        `HTTP ${r.status}: revisa la NEXT_PUBLIC_SUPABASE_ANON_KEY`
      )
    const ext = r.cuerpo?.external ?? {}
    const proveedores =
      ['email', 'google'].filter((p) => ext[p]).join(' y ') || 'ninguno'
    anotar(
      'Base de datos',
      'Auth',
      ext.email ? 'OK' : 'AVISO',
      `clave anon válida; acceso con: ${proveedores}${r.cuerpo?.mailer_autoconfirm ? ' (confirma emails solo, sin correo)' : ''}`
    )
  } catch (e) {
    anotar('Base de datos', 'Auth', 'ERROR', motivo(e))
  }
}

// ── Límites de uso (Upstash) ────────────────────────────────────────────────
async function upstash() {
  const url = env('UPSTASH_REDIS_REST_URL').replace(/\/+$/, '')
  const token = env('UPSTASH_REDIS_REST_TOKEN')
  if (!url || !token) {
    return anotar(
      'Plataforma',
      'Upstash Redis',
      'OPCIONAL',
      'en local basta; en producción es OBLIGATORIO para que los límites protejan tu factura de IA'
    )
  }
  try {
    const r = await pedir(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    anotar(
      'Plataforma',
      'Upstash Redis',
      r.ok ? 'OK' : 'ERROR',
      r.ok ? 'responde PONG' : `HTTP ${r.status}: token o URL incorrectos`
    )
  } catch (e) {
    anotar('Plataforma', 'Upstash Redis', 'ERROR', motivo(e))
  }
}

// ── Mapa, geocodificación, rutas y clima ────────────────────────────────────
async function mapa() {
  const ua = `Wayio/1.0 (verificación; ${env('NOMINATIM_EMAIL') || 'sin email'})`
  anotar(
    'Mapa y clima',
    'NOMINATIM_EMAIL',
    env('NOMINATIM_EMAIL') ? 'OK' : 'AVISO',
    env('NOMINATIM_EMAIL')
      ? 'puesto'
      : 'recomendado: lo pide la política de uso de Nominatim'
  )
  try {
    const r = await pedir(
      'https://nominatim.openstreetmap.org/search?q=Santo%20Domingo&format=json&limit=1',
      { headers: { 'User-Agent': ua } }
    )
    anotar(
      'Mapa y clima',
      'Geocodificación (Nominatim)',
      r.ok && r.cuerpo?.length ? 'OK' : 'ERROR',
      r.ok ? 'responde' : `HTTP ${r.status}`
    )
  } catch (e) {
    anotar('Mapa y clima', 'Geocodificación (Nominatim)', 'ERROR', motivo(e))
  }
  const pie =
    env('OSRM_FOOT_URL') ||
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
  try {
    const r = await pedir(
      `${pie}/-69.8836,18.4735;-69.8858,18.4737?overview=false`,
      { headers: { 'User-Agent': ua } }
    )
    anotar(
      'Mapa y clima',
      'Rutas por calles (OSRM)',
      r.ok && r.cuerpo?.code === 'Ok' ? 'OK' : 'ERROR',
      r.ok
        ? env('OSRM_FOOT_URL')
          ? 'servidor propio'
          : 'servidores públicos de FOSSGIS (uso justo)'
        : `HTTP ${r.status}`
    )
  } catch (e) {
    anotar(
      'Mapa y clima',
      'Rutas por calles (OSRM)',
      'ERROR',
      `${motivo(e)} (el mapa dibujará arcos)`
    )
  }
  await geoapify()
  try {
    const r = await pedir('https://tiles.openfreemap.org/styles/positron')
    anotar(
      'Mapa y clima',
      'Teselas (OpenFreeMap)',
      r.ok ? 'OK' : 'ERROR',
      r.ok ? 'responde' : `HTTP ${r.status}`
    )
  } catch (e) {
    anotar('Mapa y clima', 'Teselas (OpenFreeMap)', 'ERROR', motivo(e))
  }
  const clave = env('OPENWEATHER_API_KEY')
  if (!clave)
    return anotar(
      'Mapa y clima',
      'Clima (OpenWeather)',
      'OPCIONAL',
      'sin clave el itinerario sale sin pronóstico'
    )
  try {
    const r = await pedir(
      `https://api.openweathermap.org/data/2.5/weather?q=Santo%20Domingo&appid=${encodeURIComponent(clave)}`
    )
    anotar(
      'Mapa y clima',
      'Clima (OpenWeather)',
      r.ok ? 'OK' : 'ERROR',
      r.ok
        ? 'clave activa'
        : r.status === 401
          ? 'clave no activa (las nuevas tardan hasta 2 h)'
          : `HTTP ${r.status}`
    )
  } catch (e) {
    anotar('Mapa y clima', 'Clima (OpenWeather)', 'ERROR', motivo(e))
  }
}

// Geoapify: geocodificación y rutas comerciales (sin la clave, Nominatim/OSRM)
async function geoapify() {
  const clave = env('GEOAPIFY_API_KEY')
  if (!clave) {
    return anotar(
      'Mapa y clima',
      'Geoapify (geocodificación y rutas)',
      'AVISO',
      'sin GEOAPIFY_API_KEY se usan Nominatim y OSRM públicos, no aptos para uso comercial intensivo'
    )
  }
  const base = (
    env('GEOAPIFY_BASE_URL') || 'https://api.geoapify.com/v1'
  ).replace(/\/+$/, '')
  // La clave va en cabecera, nunca en la URL.
  const init = { headers: { 'x-api-key': clave } }
  const fallo = (r) =>
    r.status === 401 || r.status === 403
      ? `HTTP ${r.status}: la clave no es válida o sus restricciones bloquean el servidor`
      : r.status === 429
        ? 'HTTP 429: cuota diaria agotada o demasiadas peticiones por segundo'
        : `HTTP ${r.status}`
  try {
    const params = new URLSearchParams({
      text: 'Zona Colonial, Santo Domingo',
      lang: 'es',
      limit: '1',
      format: 'json',
      filter: 'countrycode:do',
      bias: 'countrycode:none',
    })
    const r = await pedir(`${base}/geocode/search?${params}`, init)
    const hay = Boolean(r.cuerpo?.results?.length)
    anotar(
      'Mapa y clima',
      'Geocodificación (Geoapify)',
      r.ok && hay ? 'OK' : 'ERROR',
      r.ok ? (hay ? 'responde' : 'responde, pero sin resultados') : fallo(r)
    )
  } catch (e) {
    anotar('Mapa y clima', 'Geocodificación (Geoapify)', 'ERROR', motivo(e))
  }
  try {
    // Waypoints en lat,lon (al revés que OSRM).
    const params = new URLSearchParams({
      waypoints: '18.4735,-69.8836|18.4737,-69.8858',
      mode: 'walk',
    })
    const r = await pedir(`${base}/routing?${params}`, init)
    const tramo = r.cuerpo?.features?.[0]?.properties?.legs?.[0]
    anotar(
      'Mapa y clima',
      'Rutas por calles (Geoapify)',
      r.ok && tramo ? 'OK' : 'ERROR',
      r.ok
        ? tramo
          ? `ruta a pie de ${Math.round(tramo.distance)} m en Santo Domingo`
          : 'responde, pero sin ruta'
        : `${fallo(r)} (el mapa dibujará arcos)`
    )
  } catch (e) {
    anotar(
      'Mapa y clima',
      'Rutas por calles (Geoapify)',
      'ERROR',
      `${motivo(e)} (el mapa dibujará arcos)`
    )
  }
}

// ── Búsqueda real y afiliados ───────────────────────────────────────────────
async function busqueda() {
  const clave = env('VIATOR_API_KEY')
  if (!clave) {
    anotar(
      'Búsqueda y afiliados',
      'Viator (actividades con precio)',
      'OPCIONAL',
      'sin clave se enlaza a Viator sin precios'
    )
  } else {
    try {
      const base = (
        env('VIATOR_API_URL') || 'https://api.viator.com/partner'
      ).replace(/\/+$/, '')
      const r = await pedir(`${base}/search/freetext`, {
        method: 'POST',
        headers: {
          'exp-api-key': clave,
          Accept: 'application/json;version=2.0',
          'Accept-Language': 'es-ES',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm: 'Punta Cana',
          searchTypes: [
            { searchType: 'PRODUCTS', pagination: { start: 1, count: 1 } },
          ],
          currency: 'USD',
        }),
      })
      anotar(
        'Búsqueda y afiliados',
        'Viator (actividades con precio)',
        r.ok ? 'OK' : 'ERROR',
        r.ok ? 'búsqueda de prueba correcta' : `HTTP ${r.status}`
      )
    } catch (e) {
      anotar(
        'Búsqueda y afiliados',
        'Viator (actividades con precio)',
        'ERROR',
        motivo(e)
      )
    }
  }
  const afiliados = {
    'Booking (hoteles)': ['NEXT_PUBLIC_BOOKING_AID'],
    'Viator (comisión)': ['NEXT_PUBLIC_VIATOR_PID', 'NEXT_PUBLIC_VIATOR_MCID'],
    'Vuelos (Skyscanner o Travelpayouts)': [
      'NEXT_PUBLIC_SKYSCANNER_ASSOCIATE_ID|NEXT_PUBLIC_TP_MARKER',
    ],
    'Airalo (eSIM)': ['NEXT_PUBLIC_AIRALO_REF'],
  }
  for (const [nombre, claves] of Object.entries(afiliados)) {
    const ok = claves.every((k) => k.split('|').some((x) => env(x)))
    anotar(
      'Búsqueda y afiliados',
      `Afiliado · ${nombre}`,
      ok ? 'OK' : 'OPCIONAL',
      ok ? 'ID puesto' : 'el enlace funciona, pero sin comisión'
    )
  }
}

// ── Pagos (Stripe) ──────────────────────────────────────────────────────────
async function stripe() {
  const clave = env('STRIPE_SECRET_KEY')
  if (!clave)
    return anotar(
      'Pagos',
      'Stripe',
      'OPCIONAL',
      'sin clave los planes de pago quedan desactivados'
    )
  const modo =
    clave.startsWith('sk_live') || clave.startsWith('rk_live')
      ? 'PRODUCCIÓN'
      : 'prueba'
  const precios = [
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_ANNUAL',
    'STRIPE_PRICE_PER_TRIP',
    'STRIPE_PRICE_GROUP',
  ]
  for (const k of precios) {
    if (!env(k)) {
      anotar('Pagos', k, 'FALTA', 'precio sin configurar')
      continue
    }
    try {
      const r = await pedir(
        `https://api.stripe.com/v1/prices/${encodeURIComponent(env(k))}`,
        { headers: { Authorization: `Bearer ${clave}` } }
      )
      anotar(
        'Pagos',
        k,
        r.ok ? 'OK' : 'ERROR',
        r.ok
          ? `${(r.cuerpo.unit_amount ?? 0) / 100} ${String(r.cuerpo.currency).toUpperCase()} (modo ${modo})`
          : r.status === 401
            ? 'STRIPE_SECRET_KEY no válida'
            : `HTTP ${r.status}: el price no existe en esta cuenta`
      )
    } catch (e) {
      anotar('Pagos', k, 'ERROR', motivo(e))
    }
  }
  anotar(
    'Pagos',
    'STRIPE_WEBHOOK_SECRET',
    env('STRIPE_WEBHOOK_SECRET') ? 'OK' : 'FALTA',
    env('STRIPE_WEBHOOK_SECRET')
      ? 'puesto (se valida al llegar el primer evento)'
      : 'sin él los pagos no activan el plan'
  )
}

// ── App, analítica y errores ────────────────────────────────────────────────
function plataforma() {
  const base = env('NEXT_PUBLIC_BASE_URL')
  anotar(
    'Plataforma',
    'NEXT_PUBLIC_BASE_URL',
    base ? 'OK' : 'FALTA',
    base || 'pon http://localhost:3000 en local y tu dominio en producción'
  )
  anotar(
    'Plataforma',
    'NEXT_PUBLIC_CONTACT_EMAIL',
    env('NEXT_PUBLIC_CONTACT_EMAIL') ? 'OK' : 'OPCIONAL',
    env('NEXT_PUBLIC_CONTACT_EMAIL')
      ? 'puesto'
      : '/contacto dirá que el canal llega pronto'
  )
  anotar(
    'Plataforma',
    'PostHog (analítica)',
    env('NEXT_PUBLIC_POSTHOG_KEY') ? 'OK' : 'OPCIONAL',
    env('NEXT_PUBLIC_POSTHOG_KEY') ? 'clave puesta' : 'sin analítica'
  )
  anotar(
    'Plataforma',
    'Sentry (errores)',
    env('NEXT_PUBLIC_SENTRY_DSN') ? 'OK' : 'OPCIONAL',
    env('NEXT_PUBLIC_SENTRY_DSN') ? 'DSN puesto' : 'sin captura de errores'
  )
}

// ── Ejecución e informe ─────────────────────────────────────────────────────
const tieneEnv = existsSync(join(RAIZ, '.env.local'))
await Promise.all([
  ia(),
  topeIa(),
  supabase(),
  upstash(),
  mapa(),
  busqueda(),
  stripe(),
])
plataforma()

const ICONO = { OK: '✔', FALTA: '✖', ERROR: '✖', AVISO: '!', OPCIONAL: '·' }
const ORDEN = [
  'IA',
  'Base de datos',
  'Plataforma',
  'Mapa y clima',
  'Búsqueda y afiliados',
  'Pagos',
]
console.log(
  `\nWayio · verificación de servicios${tieneEnv ? '' : ' (no hay .env.local)'}\n`
)
for (const grupo of ORDEN) {
  const filas = resultados.filter((r) => r.grupo === grupo)
  if (!filas.length) continue
  console.log(grupo.toUpperCase())
  for (const r of filas) {
    console.log(
      `  ${ICONO[r.estado]} ${r.estado.padEnd(8)} ${r.nombre.padEnd(34)} ${r.detalle}`
    )
  }
  console.log('')
}
const bloqueantes = resultados.filter(
  (r) => r.estado === 'FALTA' || r.estado === 'ERROR'
)
console.log(
  bloqueantes.length
    ? `${bloqueantes.length} punto(s) por resolver antes de dar la app por funcional.`
    : 'Todo lo obligatorio está configurado y responde.'
)
process.exitCode = bloqueantes.length ? 1 : 0
