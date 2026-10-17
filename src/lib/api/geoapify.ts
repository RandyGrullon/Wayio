import 'server-only'
import { unstable_cache } from 'next/cache'

/**
 * Cliente de Geoapify (https://www.geoapify.com/): geocodificación y rutas por
 * calles sobre datos de OpenStreetMap, con licencia de uso comercial.
 *
 * Solo se usa si hay GEOAPIFY_API_KEY; sin ella, geocode.ts y rutas.ts siguen
 * con Nominatim y OSRM públicos. Aquí vive todo lo propio del proveedor:
 *  - la clave viaja en la cabecera `x-api-key`, nunca en la URL (las URLs
 *    acaban en logs);
 *  - un limitador por instancia: como máximo GEOAPIFY_RPS peticiones por
 *    segundo (4 por defecto; el plan Free admite 5), 4 en vuelo y 8 s como
 *    mucho de espera en la cola (pasado ese plazo la petición se da por
 *    fallida y quien llama usa su estimación);
 *  - un presupuesto global de créditos por día (GEOAPIFY_CREDITOS_DIA, 3000
 *    por defecto, contado en Upstash si está configurado): al agotarse no se
 *    llama a Geoapify, las rutas salen estimadas y los lugares sin verificar,
 *    así nadie puede gastar la cuota de todos ni generar sobrecostes;
 *  - un reintento ante 429 por ritmo, 5xx o fallo de red; una cuota agotada
 *    (429 «Quota exceeded»), una clave no válida (401/403) o un presupuesto
 *    agotado no se reintentan, y la clave no válida o la cuota agotada
 *    repetida cortan las llamadas durante 60 s;
 *  - un aviso en el log (sin la clave ni la URL) cuando la clave falla, se
 *    agota la cuota o el presupuesto;
 *  - la caché persistente (caché de datos de Next, compartida entre
 *    instancias): los términos de Geoapify permiten guardar los resultados;
 *  - parsers puros de las respuestas, sin red, para poder probarlos.
 *
 * Coste: 1 crédito por geocodificación y (paradas − 1) por ruta. El plan Free
 * da 3000 créditos/día y obliga a mostrar «Powered by Geoapify» y el crédito
 * de OpenStreetMap donde se muestran sus datos (mapa web y app móvil).
 */

const BASE_POR_DEFECTO = 'https://api.geoapify.com/v1'
const TIMEOUT_MS = 9000
const ESPERA_REINTENTO_MS = 700
/** Si Retry-After pide esperar más que esto, no se reintenta. */
const MAX_ESPERA_REINTENTO_MS = 5000
const MAX_EN_VUELO = 4
const RPS_POR_DEFECTO = 4
/** Espera máxima por un turno del limitador. */
const MAX_ESPERA_COLA_MS = 8000
/** Pausa de las llamadas tras una clave no válida o una cuota agotada. */
const CORTE_MS = 60_000
/** 429 de cuota seguidos que abren el corte (uno suelto puede ser ritmo). */
const CUOTAS_PARA_CORTE = 3
const CREDITOS_DIA_POR_DEFECTO = 3000
const AVISO_CADA_MS = 60_000

function claveApi(): string | undefined {
  return process.env['GEOAPIFY_API_KEY']?.trim() || undefined
}

/** ¿Hay clave de Geoapify? Se lee en cada llamada, no al cargar el módulo. */
export function geoapifyConfigurado(): boolean {
  return claveApi() !== undefined
}

/** Base de la API: la de UE (api-eu) o un mock local con GEOAPIFY_BASE_URL. */
function baseUrl(): string {
  const base = process.env['GEOAPIFY_BASE_URL']?.trim().replace(/\/+$/, '')
  return base || BASE_POR_DEFECTO
}

function rps(): number {
  const n = Number(process.env['GEOAPIFY_RPS'])
  return Number.isFinite(n) && n > 0 ? n : RPS_POR_DEFECTO
}

/** Tope de créditos por día (UTC) para toda la app. */
function creditosDia(): number {
  const n = Number(process.env['GEOAPIFY_CREDITOS_DIA'])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : CREDITOS_DIA_POR_DEFECTO
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

const ultimosAvisos = new Map<string, number>()

/** Aviso en el log, como mucho uno por minuto y tipo. Nunca con la clave. */
function avisar(tipo: string, texto: string): void {
  const ahora = Date.now()
  if (ahora - (ultimosAvisos.get(tipo) ?? 0) < AVISO_CADA_MS) return
  ultimosAvisos.set(tipo, ahora)
  // eslint-disable-next-line no-console
  console.warn(`[geoapify] ${texto}`)
}

// ---------------------------------------------------------------------------
// Limitador por instancia: arranques separados ≥ 1/RPS s y ≤ 4 en vuelo
// ---------------------------------------------------------------------------

let enVuelo = 0
let proximoInicio = 0
let temporizador: ReturnType<typeof setTimeout> | null = null
const enEspera: Array<() => void> = []

function despachar(): void {
  if (temporizador) return
  while (enVuelo < MAX_EN_VUELO) {
    const siguiente = enEspera[0]
    if (!siguiente) return
    const ahora = Date.now()
    if (ahora < proximoInicio) {
      temporizador = setTimeout(() => {
        temporizador = null
        despachar()
      }, proximoInicio - ahora)
      return
    }
    enEspera.shift()
    enVuelo++
    proximoInicio = ahora + 1000 / rps()
    siguiente()
  }
}

/**
 * Espera un turno del limitador. false si pasan MAX_ESPERA_COLA_MS o se
 * cancela `signal` antes de obtenerlo: entonces sale de la cola sin ocupar
 * hueco. JS es de un hilo, así que o lo despacha `despachar` (y ya no está en
 * `enEspera`) o lo retira el plazo: `enVuelo` nunca se descuadra.
 */
function esperarTurno(signal: AbortSignal | undefined): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    const turno = (): void => {
      limpiar()
      resolve(true)
    }
    const retirar = (): void => {
      const i = enEspera.indexOf(turno)
      if (i < 0) return // ya tenía turno
      enEspera.splice(i, 1)
      limpiar()
      resolve(false)
    }
    const reloj = setTimeout(retirar, MAX_ESPERA_COLA_MS)
    const limpiar = (): void => {
      clearTimeout(reloj)
      signal?.removeEventListener('abort', retirar)
    }
    signal?.addEventListener('abort', retirar, { once: true })
    enEspera.push(turno)
    despachar()
  })
}

/** Ejecuta `fn` con turno del limitador; null si no lo obtuvo a tiempo. */
async function conTurno<T>(
  fn: () => Promise<T>,
  signal: AbortSignal | undefined
): Promise<T | null> {
  if (!(await esperarTurno(signal))) return null
  try {
    return await fn()
  } finally {
    enVuelo--
    despachar()
  }
}

// ---------------------------------------------------------------------------
// Corte (clave no válida o cuota agotada) y presupuesto diario de créditos
// ---------------------------------------------------------------------------

let cortadoHasta = 0
let statusCorte: number | null = null
let cuotasSeguidas = 0

function cortar(status: number): void {
  cortadoHasta = Date.now() + CORTE_MS
  statusCorte = status
}

/** Fallo inmediato mientras dura el corte; null si no hay corte. */
function enCorte(): RespuestaGeoapify | null {
  if (Date.now() >= cortadoHasta) return null
  return { ok: false, transitorio: statusCorte === 429, status: statusCorte }
}

let presupuestoAgotadoHasta = 0
let usoLocal = { dia: '', creditos: 0 }

/**
 * Reserva `n` créditos del presupuesto diario (día UTC) antes de llamar. Con
 * Upstash el contador es global (INCRBY, caduca a los 2 días); sin Upstash, o
 * si no responde, se cuenta por instancia. false si se pasa del tope.
 */
async function reservarCreditos(n: number): Promise<boolean> {
  const ahora = Date.now()
  if (ahora < presupuestoAgotadoHasta) return false
  const dia = new Date(ahora).toISOString().slice(0, 10)
  const tope = creditosDia()
  let total: number | null = null
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (url && token) {
    const clave = `geoapify:creditos:${dia}`
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCRBY', clave, String(n)],
          ['EXPIRE', clave, String(2 * 24 * 60 * 60)],
        ]),
        cache: 'no-store',
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) {
        const data = (await res.json()) as Array<{ result?: unknown }>
        const valor = Number(data[0]?.result)
        if (Number.isFinite(valor)) total = valor
      }
    } catch {
      // Upstash no responde: se cuenta en esta instancia.
    }
  }
  if (total === null) {
    if (usoLocal.dia !== dia) usoLocal = { dia, creditos: 0 }
    usoLocal.creditos += n
    total = usoLocal.creditos
  }
  if (total <= tope) return true
  // Agotado: esta instancia deja de preguntar durante un minuto.
  presupuestoAgotadoHasta = ahora + CORTE_MS
  avisar(
    'presupuesto',
    `presupuesto diario agotado (${tope} créditos, GEOAPIFY_CREDITOS_DIA): rutas estimadas y lugares sin verificar hasta el día siguiente (UTC)`
  )
  return false
}

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

export type RespuestaGeoapify =
  | { ok: true; json: unknown }
  /**
   * `status` es null si no hubo respuesta: red, timeout, sin turno en la
   * cola, presupuesto agotado, petición cancelada o sin clave.
   */
  | { ok: false; transitorio: boolean; status: number | null }

export interface OpcionesGeoapify {
  /** Créditos que cuesta: 1 por geocodificación, paradas − 1 por ruta. */
  creditos?: number
  /** Cancela la espera en la cola y la petición (p. ej. el cliente se fue). */
  signal?: AbortSignal
}

const SIN_RESPUESTA: RespuestaGeoapify = {
  ok: false,
  transitorio: true,
  status: null,
}

interface Intento {
  respuesta: RespuestaGeoapify
  /** Milisegundos antes de reintentar; null = no reintentar. */
  reintentarEn: number | null
}

/** Mensaje del cuerpo de error ({statusCode, error, message}) o su texto. */
async function leerMensaje(res: Response): Promise<string> {
  let texto = ''
  try {
    texto = await res.text()
    const j: unknown = JSON.parse(texto)
    if (esObjeto(j) && typeof j['message'] === 'string') return j['message']
  } catch {
    // cuerpo vacío o que no es JSON: se devuelve tal cual
  }
  return texto
}

/** Espera antes del reintento respetando Retry-After (segundos o fecha). */
function esperaReintento(res: Response): number | null {
  const cabecera = res.headers.get('retry-after')?.trim()
  if (!cabecera) return ESPERA_REINTENTO_MS
  const segundos = Number(cabecera)
  const ms = Number.isFinite(segundos)
    ? segundos * 1000
    : Date.parse(cabecera) - Date.now()
  if (!Number.isFinite(ms)) return ESPERA_REINTENTO_MS
  if (ms > MAX_ESPERA_REINTENTO_MS) return null
  return Math.max(ESPERA_REINTENTO_MS, ms)
}

async function intentar(
  url: string,
  ruta: string,
  clave: string,
  creditos: number,
  signal: AbortSignal | undefined
): Promise<Intento> {
  // El corte pudo abrirse mientras esperaba turno.
  const corte = enCorte()
  if (corte) return { respuesta: corte, reintentarEn: null }
  if (signal?.aborted || !(await reservarCreditos(creditos))) {
    return { respuesta: SIN_RESPUESTA, reintentarEn: null }
  }
  let res: Response
  try {
    const plazo = AbortSignal.timeout(TIMEOUT_MS)
    res = await fetch(url, {
      headers: { 'x-api-key': clave },
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, plazo]) : plazo,
    })
  } catch {
    return {
      respuesta: SIN_RESPUESTA,
      reintentarEn: signal?.aborted ? null : ESPERA_REINTENTO_MS,
    }
  }
  if (res.ok) {
    cuotasSeguidas = 0
    try {
      const json: unknown = await res.json()
      return { respuesta: { ok: true, json }, reintentarEn: null }
    } catch {
      // Cuerpo cortado o inválido: se trata como un fallo de red.
      return {
        respuesta: { ok: false, transitorio: true, status: res.status },
        reintentarEn: signal?.aborted ? null : ESPERA_REINTENTO_MS,
      }
    }
  }
  const mensaje = await leerMensaje(res)
  const detalle = mensaje
    .split(clave)
    .join('***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
  const conDetalle = detalle ? ` («${detalle}»)` : ''
  const fallo: RespuestaGeoapify = {
    ok: false,
    transitorio: res.status === 429 || res.status >= 500,
    status: res.status,
  }
  if (res.status === 401 || res.status === 403) {
    cortar(res.status)
    avisar(
      String(res.status),
      `${ruta} → HTTP ${res.status}: clave no válida o restringida (revisa GEOAPIFY_API_KEY)${conDetalle}`
    )
    return { respuesta: fallo, reintentarEn: null }
  }
  if (res.status === 429) {
    // La cuota diaria no vuelve en 700 ms: no se reintenta y, si se repite,
    // se corta un minuto para no gastar turnos ni duplicar llamadas.
    if (/quota/i.test(mensaje)) {
      cuotasSeguidas++
      if (cuotasSeguidas >= CUOTAS_PARA_CORTE) cortar(429)
      avisar('429', `${ruta} → HTTP 429: cuota agotada${conDetalle}`)
      return { respuesta: fallo, reintentarEn: null }
    }
    avisar(
      '429',
      `${ruta} → HTTP 429: demasiadas peticiones por segundo${conDetalle}`
    )
  }
  return {
    respuesta: fallo,
    reintentarEn:
      fallo.transitorio && !signal?.aborted ? esperaReintento(res) : null,
  }
}

/**
 * GET a la API de Geoapify (`ruta` relativa a la base, p. ej.
 * '/geocode/search'). Nunca lanza: devuelve el JSON o el tipo de fallo.
 * Reintenta una vez ante 429 por ritmo, 5xx o error de red; no reintenta
 * 400/401/403, la cuota o el presupuesto agotados ni una petición cancelada.
 */
export async function geoapifyGet(
  ruta: string,
  params: Record<string, string>,
  opciones: OpcionesGeoapify = {}
): Promise<RespuestaGeoapify> {
  const clave = claveApi()
  if (!clave) return { ok: false, transitorio: false, status: null }
  const corte = enCorte()
  if (corte) return corte
  const { signal } = opciones
  const creditos = Math.max(1, Math.ceil(opciones.creditos ?? 1))
  const url = `${baseUrl()}${ruta}?${new URLSearchParams(params)}`
  const llamar = (): Promise<Intento> =>
    intentar(url, ruta, clave, creditos, signal)
  const primero = await conTurno(llamar, signal)
  if (!primero) return SIN_RESPUESTA
  if (primero.respuesta.ok || primero.reintentarEn === null) {
    return primero.respuesta
  }
  await sleep(primero.reintentarEn)
  if (signal?.aborted) return primero.respuesta
  const segundo = await conTurno(llamar, signal)
  return segundo?.respuesta ?? SIN_RESPUESTA
}

// ---------------------------------------------------------------------------
// Caché persistente (caché de datos de Next)
// ---------------------------------------------------------------------------

/**
 * Lo lanza la consulta envuelta en `cachePersistente` ante cualquier fallo
 * del proveedor, para que ese fallo no se guarde.
 */
export class FalloGeoapify extends Error {
  constructor() {
    super('Geoapify no devolvió una respuesta válida')
    this.name = 'FalloGeoapify'
  }
}

/**
 * Ejecuta `consultar` a través de la caché de datos de Next (compartida entre
 * instancias). `consultar` debe lanzar FalloGeoapify cuando falle, así solo se
 * guardan respuestas válidas (un «sin resultados» también lo es). Fuera del
 * servidor de Next, sin caché disponible, consulta directamente.
 *
 * unstable_cache identifica la entrada por el texto de la función envuelta
 * (siempre el mismo: el de aquí dentro) más `clave`. Por eso también sirve
 * para solo mirar si hay algo guardado, con un `consultar` que lance
 * FalloGeoapify, y para guardar un valor ya calculado. `revalidarSegundos`
 * false = sin caducidad propia (entonces la caducidad va en la clave).
 */
export async function cachePersistente<T>(
  clave: string[],
  revalidarSegundos: number | false,
  consultar: () => Promise<T>
): Promise<{ ok: true; valor: T } | { ok: false }> {
  const calculado: T[] = []
  const conCache = unstable_cache(
    async (): Promise<T> => {
      const valor = await consultar()
      calculado.push(valor)
      return valor
    },
    clave,
    { revalidate: revalidarSegundos }
  )
  try {
    return { ok: true, valor: await conCache() }
  } catch (err) {
    if (err instanceof FalloGeoapify) return { ok: false }
    // Falló la propia caché: si la consulta llegó a hacerse, vale su valor.
    if (calculado.length) return { ok: true, valor: calculado[0] as T }
  }
  try {
    return { ok: true, valor: await consultar() }
  } catch {
    return { ok: false }
  }
}

// ---------------------------------------------------------------------------
// Parsers puros
// ---------------------------------------------------------------------------

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

export interface PuntoGeoapify {
  lat: number
  lng: number
  displayName: string
  /** Código ISO de país en minúsculas, si viene. */
  countryCode?: string
}

const CONFIANZA_MINIMA = 0.2
/** Aciertos demasiado gruesos para el pin de una actividad. */
const TIPOS_GRUESOS = new Set([
  'country',
  'state',
  'county',
  'city',
  'postcode',
])
/** 'disrict' va con la errata literal de la API de Geoapify. */
const COINCIDENCIAS_GRUESAS = new Set([
  'match_by_city_or_disrict',
  'match_by_country_or_state',
])

/**
 * Primer resultado útil de /geocode/search (format=json). Con `nivelLugar`
 * (la consulta es una actividad) descarta los aciertos de ciudad, región,
 * país o código postal: mejor sin pin que un pin en el centro de la ciudad.
 */
export function parsearGeocodificacion(
  json: unknown,
  opciones: { nivelLugar: boolean }
): PuntoGeoapify | null {
  if (!esObjeto(json)) return null
  const resultados = json['results']
  if (!Array.isArray(resultados)) return null
  for (const r of resultados as unknown[]) {
    if (!esObjeto(r)) continue
    const lat = numero(r['lat'])
    const lng = numero(r['lon'])
    if (lat === null || lng === null) continue
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    const rankBruto = r['rank']
    const rank: Record<string, unknown> = esObjeto(rankBruto) ? rankBruto : {}
    const confianza = numero(rank['confidence'])
    if (confianza !== null && confianza < CONFIANZA_MINIMA) continue
    if (opciones.nivelLugar) {
      const tipo = r['result_type']
      const coincidencia = rank['match_type']
      if (typeof tipo === 'string' && TIPOS_GRUESOS.has(tipo)) continue
      if (
        typeof coincidencia === 'string' &&
        COINCIDENCIAS_GRUESAS.has(coincidencia)
      ) {
        continue
      }
    }
    const pais = texto(r['country_code'])?.toLowerCase()
    return {
      lat,
      lng,
      displayName: texto(r['formatted']) ?? texto(r['name']) ?? '',
      ...(pais ? { countryCode: pais } : {}),
    }
  }
  return null
}

export interface TramoGeoapify {
  /** Geometría del tramo, [lng, lat]. */
  coords: [number, number][]
  /** Metros. */
  distancia: number
  /** Segundos. */
  duracion: number
}

/**
 * Tramos de una respuesta de /routing (GeoJSON por defecto): una LineString
 * de la MultiLineString y un `legs[i]` por cada par de paradas consecutivas.
 * null si la forma no es la esperada o no cuadra con `nParadas − 1` tramos.
 */
export function parsearRuta(
  json: unknown,
  nParadas: number
): TramoGeoapify[] | null {
  const nTramos = nParadas - 1
  if (!Number.isInteger(nTramos) || nTramos < 1) return null
  if (!esObjeto(json)) return null
  const features = json['features']
  if (!Array.isArray(features)) return null
  const ruta: unknown = features[0]
  if (!esObjeto(ruta)) return null
  const geometria = ruta['geometry']
  const props = ruta['properties']
  if (!esObjeto(geometria) || !esObjeto(props)) return null
  const legs = props['legs']
  if (!Array.isArray(legs) || legs.length !== nTramos) return null
  const lineas: unknown =
    geometria['type'] === 'MultiLineString'
      ? geometria['coordinates']
      : geometria['type'] === 'LineString' && nTramos === 1
        ? [geometria['coordinates']]
        : null
  if (!Array.isArray(lineas) || lineas.length !== nTramos) return null

  const tramos: TramoGeoapify[] = []
  for (let i = 0; i < nTramos; i++) {
    const leg: unknown = legs[i]
    const linea: unknown = lineas[i]
    if (!esObjeto(leg) || !Array.isArray(linea)) return null
    const distancia = numero(leg['distance'])
    const duracion = numero(leg['time'])
    if (distancia === null || duracion === null) return null
    if (distancia < 0 || duracion < 0) return null
    const coords: [number, number][] = []
    for (const c of linea as unknown[]) {
      if (!Array.isArray(c)) continue
      const lng = numero(c[0])
      const lat = numero(c[1])
      if (lng === null || lat === null) continue
      const ultimo = coords[coords.length - 1]
      if (
        ultimo &&
        Math.abs(ultimo[0] - lng) < 1e-6 &&
        Math.abs(ultimo[1] - lat) < 1e-6
      ) {
        continue
      }
      coords.push([lng, lat])
    }
    tramos.push({ coords, distancia, duracion })
  }
  return tramos
}
