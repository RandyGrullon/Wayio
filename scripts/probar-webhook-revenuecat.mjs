#!/usr/bin/env node
/**
 * Prueba de punta a punta del webhook de RevenueCat
 * (POST /api/revenuecat/webhook) y del plan efectivo de GET /api/cupo, sin
 * Supabase ni RevenueCat reales:
 *
 *  1. Levanta un Supabase SIMULADO en memoria (PostgREST para subscriptions,
 *     revenuecat_events y usage_counters, con la FK a profiles y los CHECK de
 *     la migración 20261105130000; y /auth/v1/user para el Bearer).
 *  2. Arranca `next dev` en un puerto libre apuntando a ese mock, con un
 *     REVENUECAT_WEBHOOK_AUTH de prueba.
 *  3. Manda eventos con la forma del webhook de RevenueCat y comprueba la
 *     fila resultante, la idempotencia, el orden y /api/cupo.
 *
 *   npm run probar:revenuecat
 *
 * Datos ficticios: ninguna cuenta, compra ni clave real.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { join } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const SECRETO = 'secreto-de-prueba-0123456789abcdef'
const DIA = 86_400_000
const HORA = 3_600_000

// ── Cuentas ficticias ───────────────────────────────────────────────────────
const U = {
  ana: '00000000-0000-4000-8000-00000000000a',
  beto: '00000000-0000-4000-8000-00000000000b',
  carla: '00000000-0000-4000-8000-00000000000c',
  dario: '00000000-0000-4000-8000-00000000000d',
  eva: '00000000-0000-4000-8000-00000000000e',
  fer: '00000000-0000-4000-8000-0000000000f0',
}
const SIN_PERFIL = '00000000-0000-4000-8000-0000000000ff'
const PERFILES = new Set(Object.values(U))
const TOKENS = { 'token-ana': U.ana }

// ── Supabase simulado ───────────────────────────────────────────────────────
const SOURCES = ['system', 'stripe', 'admin', 'app_store', 'play_store']
const ESTADOS = [
  'active',
  'canceled',
  'past_due',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
]
const tablas = {
  subscriptions: new Map(),
  revenuecat_events: new Map(),
  usage_counters: new Map(),
}
const mock = { fallarEscrituras: false, peticiones: 0 }

function filaNueva(userId) {
  return {
    id: randomUUID(),
    user_id: userId,
    plan_id: 'free',
    tier: 'free',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
    source: 'system',
    store_product_id: null,
    store_transaction_id: null,
    store_environment: null,
    created_at: new Date().toISOString(),
  }
}

/** CHECK de la migración: devuelve el error de Postgres o null. */
function violaCheck(fila) {
  if (!SOURCES.includes(fila.source)) return 'subscriptions_source_check'
  if (!ESTADOS.includes(fila.status)) return 'subscriptions_status_check'
  if (!['free', 'pro', 'grupo'].includes(fila.tier)) return 'tier_check'
  if (
    fila.store_environment !== null &&
    !['SANDBOX', 'PRODUCTION'].includes(fila.store_environment)
  ) {
    return 'subscriptions_store_environment_check'
  }
  return null
}

const json = (res, status, cuerpo) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo))
}

async function leerCuerpo(req) {
  let texto = ''
  for await (const trozo of req) texto += trozo
  return texto ? JSON.parse(texto) : null
}

function filtrosDe(url) {
  const ignorar = new Set(['select', 'on_conflict', 'order', 'limit', 'offset'])
  return [...url.searchParams].filter(([k]) => !ignorar.has(k))
}

const coincide = (fila, filtros) =>
  filtros.every(
    ([k, v]) => v.startsWith('eq.') && String(fila[k]) === v.slice(3)
  )

const servidorMock = createServer(async (req, res) => {
  mock.peticiones += 1
  const url = new URL(req.url ?? '/', 'http://mock')
  let cuerpo
  try {
    cuerpo = await leerCuerpo(req)
  } catch {
    return json(res, 400, { message: 'json no válido' })
  }

  if (url.pathname === '/auth/v1/user') {
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1]
    const id = token ? TOKENS[token] : undefined
    if (!id) return json(res, 401, { message: 'invalid JWT' })
    return json(res, 200, {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'prueba@ejemplo.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    })
  }

  const m = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)
  if (!m) return json(res, 404, { message: 'ruta no simulada' })
  const nombre = m[1]
  const tabla = tablas[nombre]
  const filtros = filtrosDe(url)

  if (req.method === 'GET') {
    const filas = tabla
      ? [...tabla.values()].filter((f) => coincide(f, filtros))
      : []
    return json(res, 200, filas)
  }
  if (!tabla) return json(res, 404, { code: '42P01', message: 'sin tabla' })
  if (mock.fallarEscrituras) {
    return json(res, 500, { code: 'XX000', message: 'fallo simulado' })
  }

  if (req.method === 'POST') {
    const filas = Array.isArray(cuerpo) ? cuerpo : [cuerpo]
    const fusionar = (req.headers.prefer ?? '').includes('merge-duplicates')
    for (const datos of filas) {
      if (nombre === 'revenuecat_events') {
        if (tabla.has(datos.id)) {
          return json(res, 409, { code: '23505', message: 'duplicado' })
        }
        tabla.set(datos.id, { ...datos, processed_at: new Date() })
        continue
      }
      if (nombre !== 'subscriptions') continue
      if (!PERFILES.has(datos.user_id)) {
        return json(res, 409, {
          code: '23503',
          message: 'violates foreign key constraint subscriptions_user_id_fkey',
        })
      }
      const previa = tabla.get(datos.user_id)
      if (previa && !fusionar) {
        return json(res, 409, { code: '23505', message: 'duplicado' })
      }
      const nueva = { ...(previa ?? filaNueva(datos.user_id)), ...datos }
      const check = violaCheck(nueva)
      if (check) return json(res, 400, { code: '23514', message: check })
      tabla.set(datos.user_id, nueva)
    }
    return json(res, 201)
  }

  if (req.method === 'PATCH') {
    for (const fila of [...tabla.values()].filter((f) =>
      coincide(f, filtros)
    )) {
      const nueva = { ...fila, ...cuerpo }
      const check = violaCheck(nueva)
      if (check) return json(res, 400, { code: '23514', message: check })
      tabla.set(fila.user_id, nueva)
    }
    return json(res, 204)
  }
  return json(res, 405, { message: 'método no simulado' })
})

// ── Utilidades ──────────────────────────────────────────────────────────────
const escuchar = (servidor) =>
  new Promise((resolver) =>
    servidor.listen(0, '127.0.0.1', () => resolver(servidor.address().port))
  )

async function puertoLibre() {
  const s = createServer()
  const puerto = await escuchar(s)
  await new Promise((r) => s.close(r))
  return puerto
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

let base = ''
const resultados = []

function comprobar(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok })
  console.log(
    `  ${ok ? '✔' : '✖'} ${nombre}${ok || !detalle ? '' : ` → ${detalle}`}`
  )
}

async function webhook(cuerpo, auth = `Bearer ${SECRETO}`) {
  const res = await fetch(`${base}/api/revenuecat/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: auth } : {}),
    },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  })
  let datos = null
  try {
    datos = await res.json()
  } catch {
    datos = null
  }
  return { status: res.status, datos }
}

async function cupo(token) {
  const res = await fetch(`${base}/api/cupo`, {
    headers: { authorization: `Bearer ${token}` },
  })
  return { status: res.status, datos: await res.json() }
}

/** Cuerpo del webhook con la forma de RevenueCat (api_version 1.0). */
function evento(tipo, campos = {}) {
  const ahora = Date.now()
  return {
    api_version: '1.0',
    event: {
      id: randomUUID().toUpperCase(),
      type: tipo,
      app_id: 'app-de-prueba',
      app_user_id: U.ana,
      original_app_user_id: U.ana,
      aliases: [U.ana],
      event_timestamp_ms: ahora,
      product_id: 'wayio_pro_mensual',
      entitlement_ids: ['pro'],
      period_type: 'NORMAL',
      purchased_at_ms: ahora,
      expiration_at_ms: ahora + 30 * DIA,
      environment: 'SANDBOX',
      store: 'APP_STORE',
      transaction_id: 'tx-ana-1',
      original_transaction_id: 'tx-ana-1',
      currency: 'USD',
      price: 6.99,
      country_code: 'DO',
      ...campos,
    },
  }
}

const fila = (uid) => tablas.subscriptions.get(uid) ?? null
const fin = (uid) => Date.parse(fila(uid)?.current_period_end ?? '') || 0
const cerca = (a, b, margen = 5_000) => Math.abs(a - b) <= margen

// ── Escenarios ──────────────────────────────────────────────────────────────
async function escenarios() {
  console.log('\nAutorización y formato')
  let r = await webhook(evento('TEST'), null)
  comprobar('sin Authorization → 401', r.status === 401, `HTTP ${r.status}`)
  r = await webhook(evento('TEST'), 'Bearer otro-secreto')
  comprobar('Authorization incorrecta → 401', r.status === 401)
  r = await webhook(evento('TEST'), SECRETO)
  comprobar(
    'Authorization sin «Bearer » también vale',
    r.status === 200,
    `HTTP ${r.status}`
  )
  r = await webhook('{no es json')
  comprobar('JSON roto → 400', r.status === 400, `HTTP ${r.status}`)
  r = await webhook({ event: { type: 'RENEWAL' } })
  comprobar('evento sin id → 400', r.status === 400, `HTTP ${r.status}`)
  r = await webhook(evento('TEST'))
  comprobar(
    'TEST → 200 ignorado',
    r.status === 200 && r.datos?.estado === 'ignorado'
  )

  console.log('\nSuscripción del App Store (Ana)')
  const compra = evento('INITIAL_PURCHASE')
  r = await webhook(compra)
  let f = fila(U.ana)
  comprobar(
    'INITIAL_PURCHASE crea Pro mensual de app_store',
    r.status === 200 &&
      f?.plan_id === 'pro_mensual' &&
      f.tier === 'pro' &&
      f.status === 'active' &&
      f.source === 'app_store' &&
      f.store_product_id === 'wayio_pro_mensual' &&
      f.store_transaction_id === 'tx-ana-1' &&
      f.store_environment === 'SANDBOX' &&
      f.stripe_subscription_id === null,
    JSON.stringify({ status: r.status, datos: r.datos, f })
  )
  comprobar(
    'periodo hasta expiration_at_ms',
    cerca(fin(U.ana), compra.event.expiration_at_ms)
  )
  r = await webhook(compra)
  comprobar(
    'mismo event.id otra vez → duplicate, sin cambios',
    r.status === 200 && r.datos?.duplicate === true
  )
  comprobar(
    'revenuecat_events guarda el evento una vez',
    tablas.revenuecat_events.has(compra.event.id) &&
      tablas.revenuecat_events.size >= 1
  )

  let c = await cupo('token-ana')
  comprobar(
    '/api/cupo reconoce Pro de la tienda (cupos null)',
    c.status === 200 && c.datos?.tier === 'pro' && c.datos?.cupos === null,
    JSON.stringify(c)
  )

  const finNuevo = Date.now() + 60 * DIA
  r = await webhook(evento('RENEWAL', { expiration_at_ms: finNuevo }))
  comprobar('RENEWAL alarga el periodo', cerca(fin(U.ana), finNuevo))
  r = await webhook(
    evento('RENEWAL', { expiration_at_ms: Date.now() + 30 * DIA })
  )
  comprobar(
    'RENEWAL viejo (fuera de orden) no acorta el periodo',
    r.status === 200 && cerca(fin(U.ana), finNuevo)
  )

  r = await webhook(
    evento('CANCELLATION', {
      cancel_reason: 'UNSUBSCRIBE',
      expiration_at_ms: finNuevo,
    })
  )
  f = fila(U.ana)
  comprobar(
    'CANCELLATION: no renovará pero sigue en Pro',
    f?.cancel_at_period_end === true && f.tier === 'pro'
  )
  c = await cupo('token-ana')
  comprobar('/api/cupo sigue en Pro tras cancelar', c.datos?.tier === 'pro')

  r = await webhook(
    evento('EXPIRATION', { expiration_at_ms: Date.now() + 30 * DIA })
  )
  comprobar(
    'EXPIRATION de un periodo anterior se ignora',
    r.datos?.estado === 'ignorado' && fila(U.ana)?.tier === 'pro',
    JSON.stringify(r.datos)
  )
  r = await webhook(
    evento('EXPIRATION', {
      expiration_at_ms: finNuevo,
      original_transaction_id: 'tx-de-otra-compra',
      transaction_id: 'tx-de-otra-compra',
    })
  )
  comprobar(
    'EXPIRATION de otra compra no toca la vigente',
    r.datos?.estado === 'ignorado' && fila(U.ana)?.tier === 'pro'
  )
  r = await webhook(evento('EXPIRATION', { expiration_at_ms: finNuevo }))
  f = fila(U.ana)
  comprobar(
    'EXPIRATION de la vigente → Gratis',
    f?.tier === 'free' && f.plan_id === 'free' && f.status === 'canceled',
    JSON.stringify(f)
  )
  c = await cupo('token-ana')
  comprobar(
    '/api/cupo vuelve a Gratis con cupos',
    c.datos?.tier === 'free' && c.datos?.cupos !== null,
    JSON.stringify(c.datos)
  )

  r = await webhook(
    evento('INITIAL_PURCHASE', {
      product_id: 'wayio_pro_anual',
      expiration_at_ms: Date.now() + 365 * DIA,
      transaction_id: 'tx-ana-2',
      original_transaction_id: 'tx-ana-2',
    })
  )
  comprobar('nueva compra anual', fila(U.ana)?.plan_id === 'pro_anual')
  r = await webhook(
    evento('BILLING_ISSUE', {
      product_id: 'wayio_pro_anual',
      expiration_at_ms: Date.now() + 365 * DIA + 16 * DIA,
      transaction_id: 'tx-ana-2',
      original_transaction_id: 'tx-ana-2',
    })
  )
  f = fila(U.ana)
  comprobar(
    'BILLING_ISSUE → past_due, conserva Pro (gracia de la tienda)',
    f?.status === 'past_due' && f.tier === 'pro'
  )

  console.log('\nMargen de 3 h tras el fin del periodo (/api/cupo)')
  tablas.subscriptions.set(U.ana, {
    ...fila(U.ana),
    status: 'active',
    current_period_end: new Date(Date.now() - 1 * HORA).toISOString(),
  })
  c = await cupo('token-ana')
  comprobar('vencida hace 1 h → sigue Pro', c.datos?.tier === 'pro')
  tablas.subscriptions.set(U.ana, {
    ...fila(U.ana),
    current_period_end: new Date(Date.now() - 4 * HORA).toISOString(),
  })
  c = await cupo('token-ana')
  comprobar('vencida hace 4 h → Gratis', c.datos?.tier === 'free')

  console.log('\nPase Pro de 30 días en Google Play (Beto)')
  const compraPase = Date.now() - 2 * DIA
  r = await webhook(
    evento('NON_RENEWING_PURCHASE', {
      app_user_id: U.beto,
      original_app_user_id: U.beto,
      aliases: [U.beto],
      store: 'PLAY_STORE',
      environment: 'PRODUCTION',
      product_id: 'wayio_pase_30_dias',
      entitlement_ids: null,
      purchased_at_ms: compraPase,
      expiration_at_ms: null,
      transaction_id: 'GPA.0000-0000-0000-00001',
      original_transaction_id: 'GPA.0000-0000-0000-00001',
    })
  )
  f = fila(U.beto)
  comprobar(
    'NON_RENEWING_PURCHASE → pase de 30 días desde la compra',
    f?.plan_id === 'pro_por_viaje' &&
      f.tier === 'pro' &&
      f.source === 'play_store' &&
      f.store_environment === 'PRODUCTION' &&
      cerca(fin(U.beto), compraPase + 30 * DIA),
    JSON.stringify({ r: r.datos, f })
  )
  r = await webhook(
    evento('CANCELLATION', {
      app_user_id: U.beto,
      original_app_user_id: U.beto,
      aliases: [U.beto],
      store: 'PLAY_STORE',
      product_id: 'wayio_pase_30_dias',
      cancel_reason: 'CUSTOMER_SUPPORT',
      expiration_at_ms: Date.now(),
      transaction_id: 'GPA.0000-0000-0000-00001',
      original_transaction_id: 'GPA.0000-0000-0000-00001',
    })
  )
  f = fila(U.beto)
  comprobar(
    'reembolso (CUSTOMER_SUPPORT) quita el plan al momento',
    f?.tier === 'free' && f.status === 'canceled'
  )

  console.log('\nNo pisa Stripe ni cuentas ajenas')
  tablas.subscriptions.set(U.carla, {
    ...filaNueva(U.carla),
    plan_id: 'pro_mensual',
    tier: 'pro',
    status: 'active',
    source: 'stripe',
    stripe_subscription_id: 'sub_de_prueba_123',
    current_period_end: new Date(Date.now() + 20 * DIA).toISOString(),
  })
  r = await webhook(
    evento('INITIAL_PURCHASE', {
      app_user_id: U.carla,
      original_app_user_id: U.carla,
      aliases: [U.carla],
      transaction_id: 'tx-carla-1',
      original_transaction_id: 'tx-carla-1',
    })
  )
  f = fila(U.carla)
  comprobar(
    'con suscripción de Stripe activa no se cambia el plan',
    r.datos?.estado === 'ignorado' &&
      f?.source === 'stripe' &&
      f.stripe_subscription_id === 'sub_de_prueba_123'
  )
  r = await webhook(
    evento('INITIAL_PURCHASE', {
      app_user_id: SIN_PERFIL,
      original_app_user_id: SIN_PERFIL,
      aliases: [],
    })
  )
  comprobar(
    'cuenta que ya no existe (FK) → 200 ignorado, sin reintentos',
    r.status === 200 && r.datos?.estado === 'ignorado',
    JSON.stringify(r)
  )
  r = await webhook(
    evento('INITIAL_PURCHASE', {
      app_user_id: '$RCAnonymousID:0000000000000000000000000000000a',
      original_app_user_id: '$RCAnonymousID:0000000000000000000000000000000a',
      aliases: [],
    })
  )
  comprobar(
    'compra anónima (sin cuenta de Wayio) → ignorada',
    r.status === 200 && r.datos?.estado === 'ignorado'
  )
  r = await webhook(
    evento('INITIAL_PURCHASE', { store: 'STRIPE', app_user_id: U.eva })
  )
  comprobar(
    'otras tiendas (Stripe vía RevenueCat) → ignoradas',
    r.datos?.estado === 'ignorado' && fila(U.eva) === null
  )

  console.log('\nTransferencia al restaurar con otra cuenta (Ana → Darío)')
  r = await webhook(
    evento('RENEWAL', {
      product_id: 'wayio_pro_anual',
      expiration_at_ms: Date.now() + 300 * DIA,
      transaction_id: 'tx-ana-2',
      original_transaction_id: 'tx-ana-2',
    })
  )
  const finAna = fin(U.ana)
  r = await webhook({
    api_version: '1.0',
    event: {
      id: randomUUID(),
      type: 'TRANSFER',
      app_id: 'app-de-prueba',
      event_timestamp_ms: Date.now(),
      store: 'APP_STORE',
      environment: 'SANDBOX',
      transferred_from: [U.ana],
      transferred_to: [U.dario],
    },
  })
  const fa = fila(U.ana)
  const fd = fila(U.dario)
  comprobar(
    'TRANSFER copia la compra a la cuenta de destino',
    fd?.tier === 'pro' &&
      fd.plan_id === 'pro_anual' &&
      fd.store_transaction_id === 'tx-ana-2' &&
      cerca(fin(U.dario), finAna),
    JSON.stringify({ r: r.datos, fd })
  )
  comprobar(
    'y la quita de la de origen',
    fa?.tier === 'free' && fa.store_transaction_id === null
  )

  console.log('\nIds de producto propios (solo con las claves)')
  const deFer = (campos) =>
    evento('INITIAL_PURCHASE', {
      app_user_id: U.fer,
      original_app_user_id: U.fer,
      aliases: [U.fer],
      transaction_id: `tx-fer-${randomUUID()}`,
      ...campos,
    })
  const conTx = (e) => ({
    ...e,
    event: { ...e.event, original_transaction_id: e.event.transaction_id },
  })
  r = await webhook(
    conTx(
      deFer({
        product_id: 'com.otro.suscripcion.mes',
        entitlement_ids: null,
        expiration_at_ms: Date.now() + 31 * DIA,
      })
    )
  )
  comprobar(
    'id desconocido de 1 mes → Pro mensual (deducido)',
    fila(U.fer)?.plan_id === 'pro_mensual',
    JSON.stringify(r.datos)
  )
  r = await webhook(
    conTx(
      deFer({
        product_id: 'com.otro.suscripcion.año',
        entitlement_ids: ['pro'],
        expiration_at_ms: Date.now() + 365 * DIA,
      })
    )
  )
  comprobar(
    'id desconocido de 1 año → Pro anual (deducido)',
    fila(U.fer)?.plan_id === 'pro_anual'
  )
  r = await webhook(
    conTx(
      deFer({
        product_id: 'mi_anual_propio',
        expiration_at_ms: Date.now() + 20 * DIA,
      })
    )
  )
  comprobar(
    'id de REVENUECAT_PRODUCTOS_ANUAL manda sobre la duración',
    fila(U.fer)?.plan_id === 'pro_anual' &&
      fila(U.fer)?.store_product_id === 'mi_anual_propio'
  )
  const antes = fila(U.fer)?.store_product_id
  r = await webhook(
    conTx(
      deFer({
        product_id: 'otra_app_monedas',
        entitlement_ids: ['monedas'],
      })
    )
  )
  comprobar(
    'producto de otro entitlement → ignorado',
    r.datos?.estado === 'ignorado' && fila(U.fer)?.store_product_id === antes
  )

  console.log('\nReintentos')
  mock.fallarEscrituras = true
  const fallido = evento('INITIAL_PURCHASE', {
    app_user_id: U.eva,
    original_app_user_id: U.eva,
    aliases: [U.eva],
    transaction_id: 'tx-eva-1',
    original_transaction_id: 'tx-eva-1',
  })
  r = await webhook(fallido)
  comprobar(
    'si la BD falla → 500 (RevenueCat reintenta)',
    r.status === 500 && !tablas.revenuecat_events.has(fallido.event.id)
  )
  mock.fallarEscrituras = false
  r = await webhook(fallido)
  comprobar(
    'el reintento con el mismo id se aplica',
    r.status === 200 && fila(U.eva)?.tier === 'pro'
  )
}

// ── Next dev contra el mock ─────────────────────────────────────────────────
function pararArbol(hijo) {
  if (!hijo?.pid || hijo.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  } else {
    try {
      process.kill(-hijo.pid, 'SIGTERM')
    } catch {
      hijo.kill('SIGTERM')
    }
  }
}

async function main() {
  const puertoMock = await escuchar(servidorMock)
  const puertoApp = await puertoLibre()
  base = `http://127.0.0.1:${puertoApp}`
  const urlMock = `http://127.0.0.1:${puertoMock}`
  console.log(`Supabase simulado en ${urlMock}; next dev en ${base}`)

  let registro = ''
  const hijo = spawn(
    process.execPath,
    [
      join(RAIZ, 'node_modules/next/dist/bin/next'),
      'dev',
      '--webpack',
      '-p',
      String(puertoApp),
      '-H',
      '127.0.0.1',
    ],
    {
      cwd: RAIZ,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: urlMock,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-de-prueba-0123456789',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-de-prueba',
        REVENUECAT_WEBHOOK_AUTH: SECRETO,
        REVENUECAT_PRODUCTOS_ANUAL:
          'wayio_pro_anual,wayio_pro:anual,mi_anual_propio',
        NEXT_PUBLIC_POSTHOG_KEY: '',
        NEXT_PUBLIC_SENTRY_DSN: '',
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    }
  )
  hijo.stdout.on('data', (d) => (registro += d))
  hijo.stderr.on('data', (d) => (registro += d))
  const salir = () => pararArbol(hijo)
  process.on('SIGINT', () => {
    salir()
    process.exit(130)
  })

  try {
    // Espera a que la ruta compile (la primera vez tarda).
    const limite = Date.now() + 240_000
    for (;;) {
      try {
        const r = await fetch(`${base}/api/revenuecat/webhook`, {
          method: 'POST',
          body: '{}',
          signal: AbortSignal.timeout(60_000),
        })
        if (r.status === 401) break
      } catch {
        // todavía arrancando
      }
      if (Date.now() > limite || hijo.exitCode !== null) {
        throw new Error(`next dev no respondió:\n${registro.slice(-2000)}`)
      }
      await esperar(1_500)
    }
    await escenarios()
  } finally {
    salir()
    servidorMock.close()
  }

  const fallos = resultados.filter((r) => !r.ok)
  console.log(
    `\n${resultados.length - fallos.length}/${resultados.length} comprobaciones correctas` +
      ` (${mock.peticiones} peticiones al Supabase simulado).`
  )
  if (fallos.length) {
    console.log(`\nRegistro de next dev (final):\n${registro.slice(-3000)}`)
  }
  process.exitCode = fallos.length ? 1 : 0
}

await main()
