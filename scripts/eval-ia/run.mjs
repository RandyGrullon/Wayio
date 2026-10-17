#!/usr/bin/env node
/**
 * Evaluación de la IA de Wayio contra un servidor en marcha.
 *
 *   node scripts/eval-ia/run.mjs [--base http://localhost:3000] [--solo id1,id2]
 *        [--concurrencia 2] [--juez] [--interpret] [--sin-generar]
 *
 * - Llama a POST /api/generate (sin caché) con cada caso de casos.mjs y aplica
 *   validaciones automáticas (días, horarios, coordenadas, presupuesto,
 *   idioma, adherencia a la descripción…).
 * - --interpret evalúa además POST /api/interpret con CASOS_INTERPRET.
 * - --juez añade una nota de calidad de Claude (requiere ANTHROPIC_API_KEY en
 *   el entorno de este proceso; se lee también de .env.local).
 *
 * Escribe un informe en scripts/eval-ia/resultados/<fecha>/ (resumen.md +
 * un JSON por caso) y termina con código 1 si algún caso tiene errores.
 *
 * Sesión: /api/generate exige cuenta. Si existe EVAL_IA_BEARER (en el entorno
 * o en .env.local) se envía como `Authorization: Bearer <token>` en las
 * llamadas a /api/generate y /api/interpret: pon el access_token de una
 * cuenta de pruebas (el JWT de Supabase, caduca en ~1 h). Sin él solo
 * funciona en desarrollo sin Supabase (modo local sin cuentas).
 * Cada caso consume cupo del límite por cuenta (6/hora, 20/día en producción
 * o con RATE_LIMIT_ENFORCE=true) y del tope diario AI_DAILY_BUDGET_USD.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CASOS, CASOS_INTERPRET } from './casos.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def
}

const BASE = opt('base', 'http://localhost:3000').replace(/\/$/, '')
const SOLO = opt('solo', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const CONCURRENCIA = Math.max(1, Number(opt('concurrencia', '2')) || 2)
const USAR_JUEZ = flag('juez')
const EVAL_INTERPRET = flag('interpret')
const SIN_GENERAR = flag('sin-generar')

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Cabeceras de las llamadas a la app (con Bearer si hay EVAL_IA_BEARER). */
function cabecerasApp() {
  const token = process.env.EVAL_IA_BEARER?.trim()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function loadEnvLocal() {
  const file = path.join(root, '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

function isoLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fechas(inicio, dias) {
  const a = new Date()
  a.setHours(12, 0, 0, 0)
  a.setDate(a.getDate() + inicio)
  const b = new Date(a)
  b.setDate(b.getDate() + dias - 1)
  return { fechaInicio: isoLocal(a), fechaFin: isoLocal(b) }
}

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59) return null
  return h * 60 + min
}

function haversineKm(a, b) {
  const R = 6371
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function median(nums) {
  const s = [...nums].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function pool(items, n, fn) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(n, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    }
  )
  await Promise.all(workers)
  return out
}

// ---------------------------------------------------------------------------
// Validaciones del itinerario
// ---------------------------------------------------------------------------

const STOP_ES = [
  ' de ',
  ' la ',
  ' el ',
  ' y ',
  ' en ',
  ' los ',
  ' las ',
  ' del ',
  ' para ',
  ' con ',
  ' una ',
  ' por ',
  ' al ',
]
const STOP_EN = [
  ' the ',
  ' and ',
  ' of ',
  ' to ',
  ' with ',
  ' for ',
  ' in the ',
  ' your ',
  ' visit ',
]

function contar(texto, palabras) {
  const t = ` ${texto} `
  return palabras.reduce((n, w) => n + (t.split(w).length - 1), 0)
}

/**
 * Valida un resultado de /api/generate. Devuelve una lista de hallazgos
 * { nivel: 'error' | 'aviso', regla, detalle }.
 */
function validar(caso, form, result, headers) {
  const out = []
  const err = (regla, detalle) => out.push({ nivel: 'error', regla, detalle })
  const aviso = (regla, detalle) => out.push({ nivel: 'aviso', regla, detalle })
  const espera = caso.espera ?? {}

  if (headers.demo !== '0') {
    err(
      'no-demo',
      `La respuesta es de demostración (X-Demo=${headers.demo})${result?.motivo ? `: ${result.motivo}` : ''}`
    )
    return out
  }

  for (const tier of ['basico', 'confort', 'premium']) {
    if (!result?.[tier]?.dias) err('tiers', `Falta el paquete ${tier}`)
  }
  if (out.length) return out

  const trip = result.confort
  const dias = trip.dias

  // Duración
  for (const tier of ['basico', 'confort', 'premium']) {
    const n = result[tier].dias.length
    if (n !== caso.dias) {
      err('num-dias', `${tier}: ${n} días generados, se esperaban ${caso.dias}`)
    }
  }

  // Moneda
  if (trip.moneda && trip.moneda !== form.moneda) {
    err('moneda', `El viaje dice ${trip.moneda} y se pidió ${form.moneda}`)
  } else if (!trip.moneda) {
    aviso('moneda', 'El viaje no guarda la moneda')
  }

  // Sorpresa
  if (
    espera.sorpresa &&
    (/sorpresa/i.test(trip.destino) || String(trip.destino).length < 3)
  ) {
    err('sorpresa', `Destino sorpresa sin resolver: "${trip.destino}"`)
  }

  // Ids, números, horarios, coordenadas
  const ids = new Set()
  const nombres = new Map()
  let sinCoords = 0
  let totalActs = 0
  const horaMin = espera.horaMinima ? toMin(espera.horaMinima) : null

  dias.forEach((d, di) => {
    if (d.numero !== di + 1)
      err('numeracion', `Día en posición ${di + 1} tiene numero=${d.numero}`)
    if (!d.ciudad) err('ciudad', `Día ${di + 1} sin ciudad`)
    if (!d.titulo) aviso('titulo', `Día ${di + 1} sin título`)
    const acts = d.actividades ?? []
    totalActs += acts.length
    const extremo = di === 0 || di === dias.length - 1
    if (acts.length === 0) err('actividades', `Día ${di + 1} sin actividades`)
    else if (acts.length < 2 && !extremo && caso.dias > 1)
      aviso('actividades', `Día ${di + 1} con solo ${acts.length} actividad`)
    if (acts.length > 9)
      aviso(
        'actividades',
        `Día ${di + 1} sobrecargado (${acts.length} actividades)`
      )

    let finPrev = null
    const conCoords = []
    acts.forEach((a, ai) => {
      const ref = `D${di + 1}#${ai + 1} "${a.nombre}"`
      if (!a.id) err('id', `${ref} sin id`)
      else if (ids.has(a.id)) err('id-duplicado', `${ref} repite id ${a.id}`)
      else ids.add(a.id)

      for (const k of [
        'precioEstimado',
        'lat',
        'lng',
        'duracionMinutos',
        'radioGeofencingMetros',
      ]) {
        if (typeof a[k] !== 'number' || !Number.isFinite(a[k]))
          err('numero', `${ref}: ${k}=${JSON.stringify(a[k])}`)
      }
      if (a.precioEstimado < 0) err('precio', `${ref}: precio negativo`)

      const ini = toMin(a.horaInicio)
      const fin = toMin(a.horaFin)
      if (ini === null || fin === null) {
        err('hora-formato', `${ref}: horas "${a.horaInicio}"–"${a.horaFin}"`)
      } else {
        if (fin <= ini && !(fin < 6 * 60))
          err(
            'hora-orden',
            `${ref}: termina (${a.horaFin}) antes de empezar (${a.horaInicio})`
          )
        if (finPrev !== null && ini < finPrev - 5)
          err(
            'solape',
            `${ref} empieza ${a.horaInicio} antes de que termine la anterior`
          )
        if (horaMin !== null && a.tipo !== 'traslado' && ini < horaMin)
          err(
            'hora-minima',
            `${ref} empieza a las ${a.horaInicio} (pidió no antes de ${espera.horaMinima})`
          )
        finPrev = fin < ini ? 24 * 60 + fin : fin
      }

      if (!a.lat && !a.lng) sinCoords++
      else conCoords.push(a)

      if (a.tipo !== 'traslado') {
        const key = norm(a.nombre).replace(/\s+/g, ' ').trim()
        if (
          key &&
          !/hotel|check|aeropuerto|regreso|llegada|salida|desayuno|almuerzo|cena|descanso/.test(
            key
          )
        ) {
          nombres.set(key, (nombres.get(key) ?? 0) + 1)
        }
      }
    })

    // Dispersión del día: cada actividad cerca de la mediana del día.
    if (conCoords.length >= 3) {
      const c = {
        lat: median(conCoords.map((a) => a.lat)),
        lng: median(conCoords.map((a) => a.lng)),
      }
      const radio = espera.radioKm ?? 60
      for (const a of conCoords) {
        const km = haversineKm(c, a)
        if (km > radio) {
          err(
            'coords-dispersas',
            `D${di + 1} "${a.nombre}" a ${Math.round(km)} km del resto del día (máx ${radio})`
          )
        }
      }
    }
  })

  if (totalActs && sinCoords / totalActs > 0.5) {
    aviso(
      'coords-faltantes',
      `${sinCoords}/${totalActs} actividades sin coordenadas`
    )
  }
  for (const [nombre, n] of nombres) {
    if (n > 1) aviso('repetida', `"${nombre}" aparece ${n} veces`)
  }

  // Presupuesto
  const totales = Object.fromEntries(
    ['basico', 'confort', 'premium'].map((t) => [t, result[t].presupuestoTotal])
  )
  for (const t of ['basico', 'confort', 'premium']) {
    const r = result[t]
    const suma = r.dias.reduce((s, d) => s + (Number(d.presupuestoDia) || 0), 0)
    if (!Number.isFinite(r.presupuestoTotal))
      err('presupuesto', `${t}: total no numérico`)
    else if (suma > 0 && Math.abs(suma - r.presupuestoTotal) / suma > 0.05)
      aviso(
        'presupuesto-suma',
        `${t}: total ${r.presupuestoTotal} ≠ suma de días ${Math.round(suma)}`
      )
  }
  if (
    !(totales.basico <= totales.confort && totales.confort <= totales.premium)
  ) {
    err('tiers-orden', `Totales no crecientes: ${JSON.stringify(totales)}`)
  }
  // El presupuesto del usuario incluye los vuelos salvo que diga lo contrario.
  const sinVuelo = /sin (contar )?(el )?vuelo/i.test(
    String(form.descripcion ?? '')
  )
  const vuelos = sinVuelo
    ? 0
    : (Number(trip.vueloEstimadoPorPersona) || 0) * form.personas
  const ratio = (totales.confort + vuelos) / form.presupuesto
  if (espera.advierte) {
    const adv = norm((trip.advertencias ?? []).join(' '))
    if (!/presupuesto|insuficiente|ajustad|no alcanza|excede/.test(adv)) {
      err(
        'advertencia',
        'Presupuesto irreal y no hay advertencia sobre el presupuesto'
      )
    }
  } else if (ratio > 1.25) {
    const adv = norm((trip.advertencias ?? []).join(' '))
    const avisado = /presupuesto|no alcanza|insuficiente|excede|ajustad/.test(
      adv
    )
    ;(avisado ? aviso : err)(
      'presupuesto-excedido',
      `Confort + vuelos cuesta ${Math.round(ratio * 100)}% del presupuesto${avisado ? ' (con advertencia)' : ' sin advertirlo'}`
    )
  } else if (ratio > 1.05) {
    aviso(
      'presupuesto-excedido',
      `Confort + vuelos cuesta ${Math.round(ratio * 100)}% del presupuesto`
    )
  } else if (ratio < 0.35 && form.paquete !== 'basico') {
    aviso(
      'presupuesto-infrautilizado',
      `Confort + vuelos usa solo el ${Math.round(ratio * 100)}% del presupuesto`
    )
  }

  // Idioma
  const textos = norm(
    [
      trip.resumenViaje,
      ...dias.flatMap((d) => [
        d.titulo,
        d.descripcion,
        ...(d.actividades ?? []).map((a) => a.descripcion),
      ]),
    ].join(' ')
  )
  const es = contar(textos, STOP_ES)
  const en = contar(textos, STOP_EN)
  if (en > es) err('idioma', `Texto mayormente en inglés (es=${es}, en=${en})`)

  // Adherencia
  const todo = norm(JSON.stringify(trip))
  for (const palabra of espera.menciona ?? []) {
    if (!todo.includes(norm(palabra)))
      err('menciona', `No aparece "${palabra}"`)
  }
  for (const palabra of espera.noMenciona ?? []) {
    if (todo.includes(norm(palabra))) err('no-menciona', `Aparece "${palabra}"`)
  }
  for (const ciudad of espera.ciudades ?? []) {
    const n = norm(ciudad)
    if (
      !dias.some(
        (d) => norm(d.ciudad).includes(n) || n.includes(norm(d.ciudad))
      )
    ) {
      err(
        'ciudades',
        `Ningún día en "${ciudad}" (ciudades: ${[...new Set(dias.map((d) => d.ciudad))].join(', ')})`
      )
    }
  }
  if (espera.crucero) {
    const puerto = dias.some((d) =>
      (d.actividades ?? []).some((a) => a.puertoCrucero)
    )
    if (!puerto)
      err('crucero', 'Ninguna actividad marcada como puerto de crucero')
  }

  return out
}

// ---------------------------------------------------------------------------
// Juez (Claude) opcional
// ---------------------------------------------------------------------------

const JUEZ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    adherencia: {
      type: 'integer',
      description: '1-5: respeta la descripción y restricciones del viajero',
    },
    realismo: {
      type: 'integer',
      description:
        '1-5: lugares reales, abiertos en esos horarios, precios plausibles',
    },
    logistica: {
      type: 'integer',
      description:
        '1-5: orden geográfico, traslados, ritmo, días de llegada/salida',
    },
    presupuesto: {
      type: 'integer',
      description: '1-5: coherencia con el presupuesto y el paquete',
    },
    redaccion: {
      type: 'integer',
      description: '1-5: español natural, útil y concreto',
    },
    problemas: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'adherencia',
    'realismo',
    'logistica',
    'presupuesto',
    'redaccion',
    'problemas',
  ],
}

let anthropic = null
async function juzgar(form, trip) {
  if (!anthropic) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    anthropic = new Anthropic()
  }
  const compacto = {
    destino: trip.destino,
    resumen: trip.resumenViaje,
    presupuestoTotal: trip.presupuestoTotal,
    moneda: trip.moneda,
    advertencias: trip.advertencias,
    dias: trip.dias.map((d) => ({
      n: d.numero,
      ciudad: d.ciudad,
      titulo: d.titulo,
      acts: d.actividades.map(
        (a) =>
          `${a.horaInicio}-${a.horaFin} ${a.nombre} (${a.tipo}, ${a.precioEstimado}) — ${a.descripcion}`
      ),
    })),
  }
  const msg = await anthropic.messages.create({
    model: process.env.EVAL_JUEZ_MODEL ?? 'claude-sonnet-5-5',
    max_tokens: 4000,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: JUEZ_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: `Eres un agente de viajes experto y exigente. Evalúa este itinerario generado por una app frente a lo que pidió el viajero. Sé estricto: un 5 es excelente sin reparos.\n\nPEDIDO DEL VIAJERO:\n${JSON.stringify(form, null, 1)}\n\nITINERARIO (paquete confort):\n${JSON.stringify(compacto, null, 1)}`,
      },
    ],
  })
  const text = msg.content.find((b) => b.type === 'text')?.text ?? '{}'
  return JSON.parse(text)
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

async function correrCaso(caso) {
  const form = {
    destinoSorpresa: false,
    ...caso.form,
    ...fechas(caso.inicio, caso.dias),
  }
  const t0 = Date.now()
  let res
  let result = null
  let errorRed = null
  try {
    res = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: cabecerasApp(),
      body: JSON.stringify({ ...form, noCache: true }),
      signal: AbortSignal.timeout(330_000),
    })
    result = await res.json().catch(() => null)
  } catch (e) {
    errorRed = e instanceof Error ? e.message : String(e)
  }
  const ms = Date.now() - t0
  const headers = {
    demo: res?.headers.get('x-demo') ?? '?',
    cache: res?.headers.get('x-cache') ?? '?',
  }

  let hallazgos
  if (errorRed || !res?.ok) {
    hallazgos = [
      {
        nivel: 'error',
        regla: 'http',
        detalle:
          errorRed ??
          `HTTP ${res?.status}: ${JSON.stringify(result)?.slice(0, 300)}`,
      },
    ]
  } else {
    hallazgos = validar(caso, form, result, headers)
  }

  let juez = null
  if (USAR_JUEZ && result?.confort?.dias && headers.demo === '0') {
    try {
      juez = await juzgar(form, result.confort)
    } catch (e) {
      juez = { error: e instanceof Error ? e.message : String(e) }
    }
  }

  const errores = hallazgos.filter((h) => h.nivel === 'error').length
  const avisos = hallazgos.length - errores
  const nota =
    juez && !juez.error
      ? (
          (juez.adherencia +
            juez.realismo +
            juez.logistica +
            juez.presupuesto +
            juez.redaccion) /
          5
        ).toFixed(1)
      : '–'
  console.log(
    `${errores ? '✗' : '✓'} ${caso.id.padEnd(24)} ${String(Math.round(ms / 1000)).padStart(4)}s  errores=${errores} avisos=${avisos} juez=${nota}`
  )
  for (const h of hallazgos.filter((x) => x.nivel === 'error').slice(0, 6)) {
    console.log(`    · [${h.regla}] ${h.detalle}`)
  }
  return {
    caso: caso.id,
    titulo: caso.titulo,
    form,
    ms,
    headers,
    hallazgos,
    juez,
    result,
  }
}

async function correrInterpret(caso) {
  const t0 = Date.now()
  let data = null
  let status = 0
  try {
    const res = await fetch(`${BASE}/api/interpret`, {
      method: 'POST',
      headers: cabecerasApp(),
      body: JSON.stringify({ texto: caso.texto, hoy: isoLocal(new Date()) }),
      signal: AbortSignal.timeout(120_000),
    })
    status = res.status
    data = await res.json().catch(() => null)
  } catch (e) {
    data = { error: String(e) }
  }
  const ms = Date.now() - t0
  const fallos = []
  const e = caso.espera
  const c = data?.campos ?? {}
  if (status !== 200) fallos.push(`HTTP ${status}`)
  else {
    if (e.destinoIncluye && !norm(c.destino).includes(norm(e.destinoIncluye)))
      fallos.push(`destino="${c.destino}"`)
    if (e.origenIncluye && !norm(c.origen).includes(norm(e.origenIncluye)))
      fallos.push(`origen="${c.origen}"`)
    for (const k of ['personas', 'presupuesto', 'moneda', 'tipo', 'paquete']) {
      if (e[k] !== undefined && c[k] !== e[k])
        fallos.push(`${k}=${JSON.stringify(c[k])} (esperado ${e[k]})`)
    }
    if (e.dias) {
      const d =
        c.fechaInicio && c.fechaFin
          ? Math.round(
              (Date.parse(c.fechaFin) - Date.parse(c.fechaInicio)) / 86_400_000
            ) + 1
          : null
      if (d !== e.dias && d !== e.dias + 1 && d !== e.dias - 1)
        fallos.push(`días=${d} (esperado ${e.dias})`)
    }
    if (e.mes && c.fechaInicio && Number(c.fechaInicio.slice(5, 7)) !== e.mes)
      fallos.push(`mes=${c.fechaInicio}`)
    if (c.fechaInicio && c.fechaInicio < isoLocal(new Date()))
      fallos.push(`fecha en el pasado ${c.fechaInicio}`)
    for (const f of e.faltanAlMenos ?? []) {
      if (!(data.faltantes ?? []).includes(f))
        fallos.push(`no marcó "${f}" como faltante`)
    }
  }
  console.log(
    `${fallos.length ? '✗' : '✓'} interpret:${caso.id.padEnd(16)} ${String(Math.round(ms / 1000)).padStart(3)}s ${fallos.join(' · ')}`
  )
  return { caso: caso.id, ms, status, data, fallos }
}

async function main() {
  loadEnvLocal()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = path.join(here, 'resultados', stamp)
  fs.mkdirSync(outDir, { recursive: true })

  console.log(`Wayio · evaluación de IA contra ${BASE}`)
  const casos = SOLO.length ? CASOS.filter((c) => SOLO.includes(c.id)) : CASOS

  let gen = []
  if (!SIN_GENERAR) {
    console.log(
      `\n▶ Generación (${casos.length} casos, concurrencia ${CONCURRENCIA}${USAR_JUEZ ? ', con juez' : ''})`
    )
    gen = await pool(casos, CONCURRENCIA, correrCaso)
    for (const r of gen) {
      fs.writeFileSync(
        path.join(outDir, `${r.caso}.json`),
        JSON.stringify(r, null, 2)
      )
    }
  }

  let interp = []
  if (EVAL_INTERPRET) {
    console.log(
      `\n▶ Interpretación de texto libre (${CASOS_INTERPRET.length} casos)`
    )
    interp = await pool(CASOS_INTERPRET, CONCURRENCIA, correrInterpret)
    fs.writeFileSync(
      path.join(outDir, 'interpret.json'),
      JSON.stringify(interp, null, 2)
    )
  }

  // Resumen
  const conError = gen.filter((r) =>
    r.hallazgos.some((h) => h.nivel === 'error')
  )
  const notas = gen.map((r) => r.juez).filter((j) => j && !j.error)
  const media = (k) =>
    notas.length
      ? (notas.reduce((s, j) => s + j[k], 0) / notas.length).toFixed(2)
      : '–'
  const lineas = [
    `# Evaluación IA — ${stamp}`,
    '',
    `Servidor: ${BASE}`,
    '',
    gen.length
      ? `**Generación:** ${gen.length - conError.length}/${gen.length} casos sin errores · latencia media ${Math.round(gen.reduce((s, r) => s + r.ms, 0) / gen.length / 1000)} s`
      : '',
    notas.length
      ? `**Juez (1-5):** adherencia ${media('adherencia')} · realismo ${media('realismo')} · logística ${media('logistica')} · presupuesto ${media('presupuesto')} · redacción ${media('redaccion')}`
      : '',
    interp.length
      ? `**Interpretación:** ${interp.filter((r) => !r.fallos.length).length}/${interp.length} casos correctos`
      : '',
    '',
    '| Caso | s | Errores | Avisos | Juez | Detalle |',
    '|---|---|---|---|---|---|',
    ...gen.map((r) => {
      const e = r.hallazgos.filter((h) => h.nivel === 'error')
      const a = r.hallazgos.length - e.length
      const j =
        r.juez && !r.juez.error
          ? (
              (r.juez.adherencia +
                r.juez.realismo +
                r.juez.logistica +
                r.juez.presupuesto +
                r.juez.redaccion) /
              5
            ).toFixed(1)
          : '–'
      return `| ${r.caso} | ${Math.round(r.ms / 1000)} | ${e.length} | ${a} | ${j} | ${e
        .map((h) => `${h.regla}: ${h.detalle}`)
        .join('<br>')
        .replace(/\|/g, '/')} |`
    }),
    '',
    ...(interp.length
      ? [
          '## Interpretación',
          '',
          ...interp.map(
            (r) =>
              `- ${r.fallos.length ? '✗' : '✓'} **${r.caso}** ${r.fallos.join(' · ')}`
          ),
        ]
      : []),
    '',
    ...(notas.length
      ? [
          '## Problemas señalados por el juez',
          '',
          ...gen
            .filter((r) => r.juez?.problemas?.length)
            .map((r) => `- **${r.caso}:** ${r.juez.problemas.join(' · ')}`),
        ]
      : []),
  ]
  fs.writeFileSync(
    path.join(outDir, 'resumen.md'),
    lineas.filter((l) => l !== undefined).join('\n')
  )
  console.log(
    `\nInforme: ${path.relative(root, path.join(outDir, 'resumen.md'))}`
  )
  const fallosInterp = interp.filter((r) => r.fallos.length).length
  process.exit(conError.length || fallosInterp ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
