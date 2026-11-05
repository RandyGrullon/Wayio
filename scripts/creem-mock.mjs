#!/usr/bin/env node
/**
 * Simulador LOCAL de Creem para probar el cobro sin cuenta ni claves.
 *
 * Imita las llamadas que hace Wayio (src/lib/pagos/creem/server.ts) y la
 * página de pago, y manda a la app los webhooks FIRMADOS igual que Creem
 * (cabecera creem-signature = HMAC-SHA256 hex del cuerpo con el secreto).
 * Formas de los objetos según docs.creem.io (leídas el 5-nov-2026).
 *
 * Uso (en .env.local, además de Supabase de DESARROLLO):
 *   PAYMENTS_PROVIDER=creem
 *   CREEM_API_KEY=creem_test_simulador
 *   CREEM_API_URL=http://localhost:4010        ← solo para el simulador
 *   CREEM_WEBHOOK_SECRET=whsec_simulador
 *   CREEM_PRODUCT_MONTHLY=prod_sim_mensual
 *   CREEM_PRODUCT_ANNUAL=prod_sim_anual
 *   CREEM_PRODUCT_PER_TRIP=prod_sim_pase
 *   CREEM_PRODUCT_GROUP=prod_sim_grupo
 * y luego, en dos terminales: `npm run creem:mock` y `npm run dev`.
 *
 * En /precios, «Continuar al pago» abre la página del simulador; «Pagar»
 * completa el pago, manda checkout.completed (+ subscription.active y
 * subscription.paid si es recurrente) y vuelve a /cuenta?pago=ok. El portal
 * («Gestionar pagos») permite cancelar YA, como el portal real.
 *
 * Variables opcionales: CREEM_MOCK_PORT (4010), CREEM_MOCK_WEBHOOK_URL
 * (http://localhost:3000/api/creem/webhook).
 *
 * Utilidades para pruebas (JSON):
 *   GET  /__mock/estado                       todo lo que hay en memoria
 *   POST /__mock/pagar/:checkoutId            paga sin pasar por la página
 *   POST /__mock/renovar/:subId               nuevo periodo + subscription.paid
 *   POST /__mock/reembolsar/:orderId          reembolso total + refund.created
 *   POST /__mock/estado/:subId {status}       cambia el estado + su evento
 *   POST /__mock/reenviar/:eventId[?nuevo=1]  vuelve a mandar un evento (mismo
 *                                             id, o uno nuevo como el panel)
 */
import { createHmac, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

try {
  process.loadEnvFile('.env.local')
} catch {
  // sin .env.local: solo variables del entorno
}

const env = (k, d = '') => process.env[k]?.trim() || d
const PUERTO = Number(env('CREEM_MOCK_PORT', '4010'))
const BASE = `http://localhost:${PUERTO}`
const WEBHOOK = env(
  'CREEM_MOCK_WEBHOOK_URL',
  'http://localhost:3000/api/creem/webhook'
)
const SECRETO = env('CREEM_WEBHOOK_SECRET', 'whsec_simulador')
const CLAVE = env('CREEM_API_KEY')

const ahora = () => new Date().toISOString()
const id = (prefijo) => `${prefijo}_${randomBytes(9).toString('base64url')}`
const masDias = (iso, dias) =>
  new Date(Date.parse(iso) + dias * 86_400_000).toISOString()

// ── Catálogo: los productos de las variables CREEM_PRODUCT_* ────────────────
const CATALOGO = [
  [
    'CREEM_PRODUCT_MONTHLY',
    'Pro Viajero Mensual',
    699,
    'recurring',
    'every-month',
    30,
  ],
  [
    'CREEM_PRODUCT_ANNUAL',
    'Pro Viajero Anual',
    4999,
    'recurring',
    'every-year',
    365,
  ],
  ['CREEM_PRODUCT_PER_TRIP', 'Pase Pro de 30 días', 499, 'onetime', 'once', 0],
  [
    'CREEM_PRODUCT_GROUP',
    'Pro Grupo Mensual',
    1299,
    'recurring',
    'every-month',
    30,
  ],
]
const productos = new Map()
for (const [k, name, price, billing_type, billing_period, dias] of CATALOGO) {
  const pid = env(k)
  if (!pid) continue
  productos.set(pid, {
    id: pid,
    object: 'product',
    name,
    description: name,
    price,
    currency: 'USD',
    billing_type,
    billing_period,
    status: 'active',
    tax_mode: 'exclusive',
    tax_category: 'saas',
    mode: 'test',
    _dias: dias,
  })
}

const checkouts = new Map()
const clientes = new Map()
const suscripciones = new Map()
const pedidos = new Map()
const eventos = new Map()

const publico = (o) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')))

function clienteDe(datos) {
  if (datos?.id && clientes.has(datos.id)) return clientes.get(datos.id)
  const email = datos?.email || `cliente-${clientes.size + 1}@ejemplo.test`
  for (const c of clientes.values()) if (c.email === email) return c
  const c = {
    id: id('cust'),
    object: 'customer',
    email,
    name: 'Cliente de prueba',
    country: 'DO',
    created_at: ahora(),
    updated_at: ahora(),
    mode: 'test',
  }
  clientes.set(c.id, c)
  return c
}

function suscripcionCompleta(sub) {
  return {
    ...publico(sub),
    product: publico(productos.get(sub.product)),
    customer: clientes.get(sub.customer),
  }
}

// ── Webhooks firmados ───────────────────────────────────────────────────────
async function entregar(evento) {
  const cuerpo = JSON.stringify(evento)
  const firma = createHmac('sha256', SECRETO).update(cuerpo).digest('hex')
  try {
    const r = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'creem-signature': firma },
      body: cuerpo,
    })
    const texto = await r.text()
    console.log(
      `→ ${evento.eventType} ${evento.id}: HTTP ${r.status} ${texto.slice(0, 160)}`
    )
    return { status: r.status, cuerpo: texto }
  } catch (e) {
    console.log(
      `→ ${evento.eventType} ${evento.id}: sin respuesta (${e.message})`
    )
    return { status: 0, cuerpo: String(e.message) }
  }
}

async function emitir(eventType, object) {
  const evento = { id: id('evt'), eventType, created_at: Date.now(), object }
  eventos.set(evento.id, evento)
  return { evento: evento.id, ...(await entregar(evento)) }
}

async function emitirSuscripcion(eventType, sub) {
  return emitir(eventType, suscripcionCompleta(sub))
}

// ── Pago de un checkout ─────────────────────────────────────────────────────
async function pagar(ch) {
  if (ch.status === 'completed') return { yaPagado: true }
  const prod = productos.get(ch.product)
  const cliente = clienteDe(ch._cliente)
  const pedido = {
    object: 'order',
    id: id('ord'),
    customer: cliente.id,
    product: prod.id,
    amount: prod.price,
    currency: prod.currency,
    sub_total: prod.price,
    tax_amount: 0,
    amount_due: prod.price,
    amount_paid: prod.price,
    status: 'paid',
    type: prod.billing_type,
    transaction: id('tran'),
    created_at: ahora(),
    updated_at: ahora(),
    mode: 'test',
    _checkout: ch.id,
  }
  pedidos.set(pedido.id, pedido)
  let sub = null
  if (prod.billing_type === 'recurring') {
    const inicio = ahora()
    sub = {
      id: id('sub'),
      object: 'subscription',
      product: prod.id,
      customer: cliente.id,
      collection_method: 'charge_automatically',
      status: 'active',
      current_period_start_date: inicio,
      current_period_end_date: masDias(inicio, prod._dias),
      canceled_at: null,
      created_at: inicio,
      updated_at: inicio,
      metadata: ch.metadata ?? null,
      mode: 'test',
    }
    suscripciones.set(sub.id, sub)
  }
  ch.status = 'completed'
  ch.order = pedido.id
  ch.customer = cliente.id
  ch.subscription = sub?.id ?? null

  const resultados = []
  resultados.push(
    await emitir('checkout.completed', {
      id: ch.id,
      object: 'checkout',
      request_id: ch.request_id ?? null,
      order: publico(pedido),
      product: publico(prod),
      units: 1,
      customer: cliente,
      ...(sub ? { subscription: publico(sub) } : {}),
      custom_fields: [],
      status: 'completed',
      metadata: ch.metadata ?? null,
      mode: 'test',
    })
  )
  if (sub) {
    resultados.push(await emitirSuscripcion('subscription.active', sub))
    resultados.push(await emitirSuscripcion('subscription.paid', sub))
  }
  return {
    pedido: pedido.id,
    suscripcion: sub?.id ?? null,
    webhooks: resultados,
  }
}

function urlExito(ch) {
  const u = new URL(ch.success_url || 'http://localhost:3000/cuenta?pago=ok')
  u.searchParams.set('checkout_id', ch.id)
  u.searchParams.set('order_id', ch.order ?? '')
  u.searchParams.set('customer_id', ch.customer ?? '')
  if (ch.subscription) u.searchParams.set('subscription_id', ch.subscription)
  u.searchParams.set('product_id', ch.product)
  if (ch.request_id) u.searchParams.set('request_id', ch.request_id)
  return u.toString()
}

async function cambiarEstado(sub, status) {
  sub.status = status
  sub.updated_at = ahora()
  if (status === 'canceled') sub.canceled_at = ahora()
  const evento =
    status === 'active' ? 'subscription.active' : `subscription.${status}`
  return emitirSuscripcion(evento, sub)
}

// ── HTTP ────────────────────────────────────────────────────────────────────
const json = (res, status, cuerpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(cuerpo))
}
const html = (res, cuerpo) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Simulador de pago</title><body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 16px">${cuerpo}</body>`
  )
}
async function leer(req) {
  let datos = ''
  for await (const trozo of req) datos += trozo
  if (!datos) return {}
  try {
    return JSON.parse(datos)
  } catch {
    return Object.fromEntries(new URLSearchParams(datos))
  }
}
const noEncontrado = (res) =>
  json(res, 404, { message: ['Not Found'], trace_id: id('trace') })

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, BASE)
  const partes = url.pathname.split('/').filter(Boolean)
  try {
    // API de Creem (x-api-key)
    if (partes[0] === 'v1') {
      const clave = req.headers['x-api-key']
      if (!clave) return json(res, 401, { message: ['Missing API key'] })
      if (CLAVE && clave !== CLAVE) {
        return json(res, 403, { message: ['Invalid API key'] })
      }
      const ruta = `${req.method} /${partes.slice(1).join('/')}`
      if (ruta === 'POST /checkouts') {
        const b = await leer(req)
        if (!productos.has(b.product_id)) {
          return json(res, 404, { message: ['Product not found'] })
        }
        const ch = {
          id: id('ch'),
          object: 'checkout',
          status: 'pending',
          request_id: b.request_id ?? null,
          product: b.product_id,
          units: b.units ?? 1,
          success_url: b.success_url ?? null,
          metadata: b.metadata ?? null,
          mode: 'test',
          _cliente: b.customer ?? null,
        }
        ch.checkout_url = `${BASE}/pagar/${ch.id}`
        checkouts.set(ch.id, ch)
        return json(res, 200, publico(ch))
      }
      if (ruta === 'POST /customers/billing') {
        const b = await leer(req)
        if (!clientes.has(b.customer_id)) return noEncontrado(res)
        return json(res, 200, {
          customer_portal_link: `${BASE}/portal/${b.customer_id}`,
        })
      }
      if (ruta === 'GET /subscriptions') {
        const sub = suscripciones.get(url.searchParams.get('subscription_id'))
        return sub
          ? json(res, 200, suscripcionCompleta(sub))
          : noEncontrado(res)
      }
      if (req.method === 'POST' && partes[1] === 'subscriptions' && partes[3]) {
        const sub = suscripciones.get(partes[2])
        if (!sub) return noEncontrado(res)
        if (partes[3] === 'cancel') {
          const b = await leer(req)
          if (b.mode === 'scheduled')
            await cambiarEstado(sub, 'scheduled_cancel')
          else await cambiarEstado(sub, 'canceled')
          return json(res, 200, suscripcionCompleta(sub))
        }
        if (partes[3] === 'resume') {
          if (sub.status !== 'scheduled_cancel') {
            return json(res, 400, {
              message: ['Subscription is not scheduled to cancel'],
            })
          }
          await cambiarEstado(sub, 'active')
          return json(res, 200, suscripcionCompleta(sub))
        }
      }
      if (req.method === 'GET' && partes[1] === 'products' && partes[2]) {
        const p = productos.get(partes[2])
        return p ? json(res, 200, publico(p)) : noEncontrado(res)
      }
      return noEncontrado(res)
    }

    // Página de pago
    if (partes[0] === 'pagar' && partes[1]) {
      const ch = checkouts.get(partes[1])
      if (!ch) return noEncontrado(res)
      if (req.method === 'POST') {
        await pagar(ch)
        res.writeHead(303, { Location: urlExito(ch) })
        return res.end()
      }
      const p = productos.get(ch.product)
      return html(
        res,
        `<p style="color:#8a6d00">Simulador local de Creem · modo test</p>
         <h1>${p.name}</h1><p>US$${(p.price / 100).toFixed(2)}${p.billing_type === 'recurring' ? ` · ${p.billing_period}` : ' · pago único'}</p>
         <form method="post"><button style="font-size:18px;padding:10px 18px">Pagar con 4111 1111 1111 1111</button></form>`
      )
    }

    // Portal del cliente
    if (partes[0] === 'portal' && partes[1]) {
      const cliente = clientes.get(partes[1])
      if (!cliente) return noEncontrado(res)
      if (req.method === 'POST') {
        const b = await leer(req)
        const sub = suscripciones.get(b.sub)
        if (sub && sub.customer === cliente.id)
          await cambiarEstado(sub, 'canceled')
        res.writeHead(303, { Location: url.pathname })
        return res.end()
      }
      const filas = [...suscripciones.values()]
        .filter((s) => s.customer === cliente.id)
        .map(
          (s) =>
            `<li>${productos.get(s.product)?.name} · ${s.status} · hasta ${s.current_period_end_date.slice(0, 10)}${
              s.status === 'canceled'
                ? ''
                : ` <form method="post" style="display:inline"><input type="hidden" name="sub" value="${s.id}"><button>Cancelar ya</button></form>`
            }</li>`
        )
        .join('')
      return html(
        res,
        `<p style="color:#8a6d00">Simulador local de Creem · portal</p><h1>${cliente.email}</h1><ul>${filas || '<li>Sin suscripciones</li>'}</ul>`
      )
    }

    // Utilidades de prueba
    if (partes[0] === '__mock') {
      if (req.method === 'GET' && partes[1] === 'estado') {
        return json(res, 200, {
          checkouts: [...checkouts.values()],
          clientes: [...clientes.values()],
          suscripciones: [...suscripciones.values()],
          pedidos: [...pedidos.values()],
          eventos: [...eventos.keys()],
        })
      }
      if (req.method === 'POST' && partes[1] === 'pagar') {
        const ch = checkouts.get(partes[2])
        return ch ? json(res, 200, await pagar(ch)) : noEncontrado(res)
      }
      if (req.method === 'POST' && partes[1] === 'renovar') {
        const sub = suscripciones.get(partes[2])
        if (!sub) return noEncontrado(res)
        const dias = productos.get(sub.product)._dias
        sub.current_period_start_date = sub.current_period_end_date
        sub.current_period_end_date = masDias(sub.current_period_end_date, dias)
        sub.status = 'active'
        sub.updated_at = ahora()
        return json(res, 200, await emitirSuscripcion('subscription.paid', sub))
      }
      if (req.method === 'POST' && partes[1] === 'estado') {
        const sub = suscripciones.get(partes[2])
        if (!sub) return noEncontrado(res)
        const b = await leer(req)
        return json(res, 200, await cambiarEstado(sub, String(b.status)))
      }
      if (req.method === 'POST' && partes[1] === 'reembolsar') {
        const pedido = pedidos.get(partes[2])
        if (!pedido) return noEncontrado(res)
        const ch = checkouts.get(pedido._checkout)
        const sub = ch?.subscription ? suscripciones.get(ch.subscription) : null
        return json(
          res,
          200,
          await emitir('refund.created', {
            id: id('ref'),
            object: 'refund',
            status: 'succeeded',
            refund_amount: pedido.amount_paid,
            refund_currency: pedido.currency,
            reason: 'requested_by_customer',
            transaction: {
              id: pedido.transaction,
              object: 'transaction',
              amount: pedido.amount,
              amount_paid: pedido.amount_paid,
              currency: pedido.currency,
              status: 'refunded',
              refunded_amount: pedido.amount_paid,
              order: pedido.id,
              subscription: sub?.id ?? null,
              customer: pedido.customer,
              mode: 'test',
            },
            ...(sub ? { subscription: publico(sub) } : {}),
            checkout: ch
              ? {
                  id: ch.id,
                  object: 'checkout',
                  product: ch.product,
                  metadata: ch.metadata,
                  status: ch.status,
                }
              : null,
            order: publico(pedido),
            customer: clientes.get(pedido.customer),
            created_at: Date.now(),
            mode: 'test',
          })
        )
      }
      if (req.method === 'POST' && partes[1] === 'reenviar') {
        const evento = eventos.get(partes[2])
        if (!evento) return noEncontrado(res)
        // ?nuevo=1: como el reenvío manual del panel (id y fecha nuevos).
        if (url.searchParams.get('nuevo') === '1') {
          const copia = { ...evento, id: id('evt'), created_at: Date.now() }
          eventos.set(copia.id, copia)
          return json(res, 200, {
            evento: copia.id,
            ...(await entregar(copia)),
          })
        }
        return json(res, 200, {
          evento: evento.id,
          ...(await entregar(evento)),
        })
      }
    }
    return noEncontrado(res)
  } catch (e) {
    console.error(e)
    return json(res, 500, { message: [String(e?.message ?? e)] })
  }
})

servidor.listen(PUERTO, () => {
  console.log(`Simulador de Creem en ${BASE}`)
  console.log(`Webhooks → ${WEBHOOK} (firma con CREEM_WEBHOOK_SECRET)`)
  console.log(
    productos.size
      ? `Productos: ${[...productos.keys()].join(', ')}`
      : 'Sin productos: pon CREEM_PRODUCT_* en .env.local'
  )
  if (!env('CREEM_API_URL')) {
    console.log(
      `Recuerda: CREEM_API_URL=${BASE} en .env.local para que la app lo use.`
    )
  }
})
