/**
 * Rutas reales por calles entre las paradas de cada día (POST /api/ruta), el
 * mismo contrato que la web (src/components/map/useRutasReales.ts):
 *
 *   { tramos: [{ desde: [lng, lat], hasta: [lng, lat], modo? }] }
 *   → { tramos: [{ coords, distancia (m), duracion (s), modo, fuente }] }
 *
 * - La ruta no exige sesión (límite por IP en el servidor); igual va por
 *   lib/api/http.ts, que añade el Bearer si hay sesión y pone tiempo límite.
 * - Con Geoapify cada tramo cuesta un crédito: se guarda cada tramo en
 *   memoria (toda la sesión de la app) y en AsyncStorage (30 días) para no
 *   volver a pedirlo al cambiar de día, de pantalla o al reabrir la app. Las
 *   estimaciones (fuente 'estimado': el proveedor no respondió) solo quedan en
 *   memoria, para reintentarlas en la próxima apertura.
 * - Las peticiones se agrupan en lotes de 60 tramos, no se repiten los tramos
 *   que ya van en camino (el mapa en vivo y el del itinerario comparten la
 *   caché) y tras un fallo se espera un minuto (el doble con cada fallo
 *   seguido, hasta 10, o el Retry-After del 429); al acabar la pausa se avisa
 *   a los mapas montados para que vuelvan a pedir.
 * - Al cerrar sesión, vaciarCacheRutas() (tasks/limpiar.ts) borra la memoria
 *   y el disco y descarta las respuestas que aún estaban en camino.
 * - Si falla, el mapa dibuja el respaldo (arco o línea recta, ver trazo.ts):
 *   nunca rompe el itinerario.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BackendError, postJSON } from '../api/http'

export type ModoTramo = 'pie' | 'auto' | 'directo'
export type FuenteTramo = 'osrm' | 'geoapify' | 'estimado'

export interface RutaTramo {
  /** [lng, lat] de la ruta por calles (o estimada). */
  coords: [number, number][]
  modo: ModoTramo
  /** Metros y segundos de la ruta real (o estimados). */
  distancia: number
  duracion: number
  fuente?: FuenteTramo
}

/** Lo mínimo de una parada para trazar su tramo (Activity o PlanningActivity). */
export interface ParadaRuta {
  lat: number
  lng: number
  puertoCrucero?: boolean
  tipo?: string
}

export interface TramoPedido {
  clave: string
  desde: [number, number]
  hasta: [number, number]
  modo?: ModoTramo
}

interface RespuestaRuta {
  tramos: Array<Partial<RutaTramo> | null>
}

interface EntradaDisco extends RutaTramo {
  /** Momento en que llegó del servidor (ms); se conserva al volver a guardar. */
  at: number
}

// v2 como en la web: con Geoapify cambian las geometrías.
const CLAVE_DISCO = 'wayio:rutas:v2'
const MAX_EN_DISCO = 300
/** Tope del JSON guardado (Android limita cada entrada a ~2 MB). */
const MAX_CHARS_DISCO = 1_000_000
const TTL_DISCO_MS = 30 * 24 * 60 * 60 * 1000
const POR_PETICION = 60
const TIEMPO_LIMITE_MS = 30_000
/** Pausa tras un fallo; se dobla con cada fallo seguido hasta PAUSA_MAX_MS. */
const PAUSA_TRAS_FALLO_MS = 60_000
const PAUSA_MAX_MS = 10 * 60_000
const RETRASO_GUARDADO_MS = 1_500

const memoria = new Map<string, RutaTramo>()
/** Momento en que llegó cada tramo (para el TTL y para guardar los nuevos). */
const llegadas = new Map<string, number>()
const enVuelo = new Set<string>()
const oyentes = new Set<() => void>()
let version = 0
/** Cambia al vaciar la caché: descarta respuestas y cargas de la sesión anterior. */
let generacion = 0
let carga: Promise<void> | null = null
let pausaHasta = 0
let fallosSeguidos = 0
let reintento: ReturnType<typeof setTimeout> | null = null
let guardadoPendiente: ReturnType<typeof setTimeout> | null = null
let guardando: Promise<void> | null = null

// ── Claves y tramos (idénticos a la web) ────────────────────────────────────

export const tieneCoords = (a: Pick<ParadaRuta, 'lat' | 'lng'>): boolean =>
  Number.isFinite(a.lat) &&
  Number.isFinite(a.lng) &&
  !(a.lat === 0 && a.lng === 0)

const fmt = (n: number): string => n.toFixed(5)

/** Clave estable de un tramo (coordenadas redondeadas a ~1 m + modo forzado). */
export function claveTramo(
  a: Pick<ParadaRuta, 'lat' | 'lng'>,
  b: Pick<ParadaRuta, 'lat' | 'lng'>,
  modo?: ModoTramo
): string {
  return `${fmt(a.lng)},${fmt(a.lat)}>${fmt(b.lng)},${fmt(b.lat)}${modo ? `|${modo}` : ''}`
}

/** ¿El tramo va por mar (escala de crucero)? Entonces no hay calles. */
export function modoForzado(
  a: ParadaRuta,
  b: ParadaRuta,
  crucero: boolean
): ModoTramo | undefined {
  return crucero && (a.puertoCrucero === true || b.puertoCrucero === true)
    ? 'directo'
    : undefined
}

/** Tramos consecutivos de cada día (solo paradas con coordenadas). */
export function tramosDe(
  dias: readonly (readonly ParadaRuta[])[],
  crucero: boolean
): TramoPedido[] {
  const tramos: TramoPedido[] = []
  for (const dia of dias) {
    const pts = dia.filter(tieneCoords)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!a || !b) continue
      const modo = modoForzado(a, b, crucero)
      tramos.push({
        clave: claveTramo(a, b, modo),
        desde: [a.lng, a.lat],
        hasta: [b.lng, b.lat],
        ...(modo ? { modo } : {}),
      })
    }
  }
  return tramos
}

// ── Caché compartida (memoria + AsyncStorage) ───────────────────────────────

function avisar(): void {
  version += 1
  for (const oyente of oyentes) oyente()
}

/** Suscripción para useSyncExternalStore (hooks/useRutasReales.ts). */
export function suscribirRutas(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Cambia cada vez que llegan rutas nuevas. */
export function versionRutas(): number {
  return version
}

export function rutaEnCache(clave: string): RutaTramo | undefined {
  return memoria.get(clave)
}

function esModo(v: unknown): v is ModoTramo {
  return v === 'pie' || v === 'auto' || v === 'directo'
}

function esCoords(v: unknown): v is [number, number][] {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    v.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1])
    )
  )
}

/** Ruta válida del servidor o del disco, o null. */
function normalizar(
  r: Partial<RutaTramo> | null | undefined
): RutaTramo | null {
  if (!r || !esCoords(r.coords) || !esModo(r.modo)) return null
  return {
    coords: r.coords.map((p): [number, number] => [p[0], p[1]]),
    modo: r.modo,
    distancia: Number.isFinite(r.distancia) ? Number(r.distancia) : 0,
    duracion: Number.isFinite(r.duracion) ? Number(r.duracion) : 0,
    ...(r.fuente ? { fuente: r.fuente } : {}),
  }
}

/** Carga una sola vez lo guardado en el teléfono (nunca lanza). */
export function cargarCacheRutas(): Promise<void> {
  carga ??= (async () => {
    const gen = generacion
    try {
      const raw = await AsyncStorage.getItem(CLAVE_DISCO)
      if (!raw || gen !== generacion) return
      const datos = JSON.parse(raw) as Record<string, EntradaDisco>
      const limite = Date.now() - TTL_DISCO_MS
      let nuevas = 0
      for (const [clave, entrada] of Object.entries(datos)) {
        if (!entrada || !(entrada.at > limite) || memoria.has(clave)) continue
        const ruta = normalizar(entrada)
        if (!ruta) continue
        memoria.set(clave, ruta)
        llegadas.set(clave, entrada.at)
        nuevas += 1
      }
      if (nuevas > 0) avisar()
    } catch {
      // Sin almacenamiento o datos corruptos: se piden de nuevo.
    }
  })()
  return carga
}

const redondear = (n: number): number => Math.round(n * 1e5) / 1e5

/**
 * Guarda en disco las rutas reales (no las estimaciones): las que llegaron
 * más recientemente, hasta MAX_EN_DISCO / MAX_CHARS_DISCO, cada una con su
 * fecha de llegada (así el TTL de 30 días vence de verdad).
 */
function programarGuardado(): void {
  if (guardadoPendiente) return
  guardadoPendiente = setTimeout(() => {
    guardadoPendiente = null
    const gen = generacion
    guardando = (async () => {
      try {
        const limite = Date.now() - TTL_DISCO_MS
        const candidatas = [...memoria.entries()]
          .map(([clave, ruta]) => ({
            clave,
            ruta,
            at: llegadas.get(clave) ?? 0,
          }))
          .filter((c) => c.ruta.fuente !== 'estimado' && c.at > limite)
          .sort((a, b) => b.at - a.at)
        const salida: Record<string, EntradaDisco> = {}
        let chars = 2
        let cuantas = 0
        for (const { clave, ruta, at } of candidatas) {
          const entrada: EntradaDisco = {
            ...ruta,
            coords: ruta.coords.map((p): [number, number] => [
              redondear(p[0]),
              redondear(p[1]),
            ]),
            at,
          }
          const largo = clave.length + JSON.stringify(entrada).length + 4
          if (cuantas >= MAX_EN_DISCO || chars + largo > MAX_CHARS_DISCO) break
          salida[clave] = entrada
          chars += largo
          cuantas += 1
        }
        // Si se vació la caché (cierre de sesión) mientras tanto, no se escribe.
        if (gen !== generacion) return
        await AsyncStorage.setItem(CLAVE_DISCO, JSON.stringify(salida))
      } catch {
        // Disco lleno o no disponible: basta la caché en memoria.
      }
    })().finally(() => {
      guardando = null
    })
  }, RETRASO_GUARDADO_MS)
}

/**
 * Tras un fallo: pausa (que se dobla con cada fallo seguido, o el
 * Retry-After del 429) y aviso a los suscriptores al acabar, para que los
 * mapas montados vuelvan a pedir (hooks/useRutasReales.ts).
 */
function pausarTrasFallo(e: unknown): void {
  if (reintento) clearTimeout(reintento)
  reintento = null
  // Sin backend configurado no tiene sentido reintentar.
  if (e instanceof BackendError && e.code === 'no_config') {
    pausaHasta = Number.POSITIVE_INFINITY
    return
  }
  fallosSeguidos += 1
  const porFallos = Math.min(
    PAUSA_MAX_MS,
    PAUSA_TRAS_FALLO_MS * 2 ** (fallosSeguidos - 1)
  )
  const espera =
    e instanceof BackendError && e.retryAfter
      ? Math.max(e.retryAfter * 1000, 1_000)
      : porFallos
  pausaHasta = Date.now() + espera
  const gen = generacion
  reintento = setTimeout(() => {
    reintento = null
    if (gen !== generacion) return
    // Por si el temporizador llega un pelo antes de pausaHasta.
    pausaHasta = 0
    avisar()
  }, espera)
}

/**
 * Vacía la caché de rutas en memoria y en el teléfono (cierre de sesión): las
 * geometrías dicen por dónde se mueve el viajero. Nunca lanza.
 */
export async function vaciarCacheRutas(): Promise<void> {
  generacion += 1
  memoria.clear()
  llegadas.clear()
  enVuelo.clear()
  pausaHasta = 0
  fallosSeguidos = 0
  if (reintento) clearTimeout(reintento)
  reintento = null
  if (guardadoPendiente) clearTimeout(guardadoPendiente)
  guardadoPendiente = null
  // El disco queda vacío tras borrar: no hace falta volver a leerlo.
  carga = Promise.resolve()
  avisar()
  try {
    // Un guardado que ya estaba escribiendo termina antes de borrar.
    await guardando
    await AsyncStorage.removeItem(CLAVE_DISCO)
  } catch {
    // Sin almacenamiento disponible: nada que borrar.
  }
}

// ── Petición ────────────────────────────────────────────────────────────────

/**
 * Pide al backend los tramos que aún no están en caché ni en camino. Nunca
 * lanza: si falla, el mapa sigue con el respaldo y se reintenta al acabar la
 * pausa (pausarTrasFallo avisa a los suscriptores).
 */
export async function pedirRutas(
  tramos: readonly TramoPedido[]
): Promise<void> {
  await cargarCacheRutas()
  if (Date.now() < pausaHasta) return
  const gen = generacion
  const vistos = new Set<string>()
  const faltan = tramos.filter((t) => {
    if (memoria.has(t.clave) || enVuelo.has(t.clave) || vistos.has(t.clave)) {
      return false
    }
    vistos.add(t.clave)
    return true
  })
  if (faltan.length === 0) return

  for (const t of faltan) enVuelo.add(t.clave)
  try {
    for (let i = 0; i < faltan.length; i += POR_PETICION) {
      const lote = faltan.slice(i, i + POR_PETICION)
      let respuesta: RespuestaRuta
      try {
        respuesta = await postJSON<RespuestaRuta>(
          '/api/ruta',
          {
            tramos: lote.map((t) => ({
              desde: t.desde,
              hasta: t.hasta,
              ...(t.modo ? { modo: t.modo } : {}),
            })),
          },
          { timeoutMs: TIEMPO_LIMITE_MS }
        )
      } catch (e) {
        if (gen === generacion) pausarTrasFallo(e)
        return
      }
      // Cerró sesión mientras tanto: las rutas eran de la cuenta anterior.
      if (gen !== generacion) return
      fallosSeguidos = 0
      const rutas = Array.isArray(respuesta.tramos) ? respuesta.tramos : []
      const ahora = Date.now()
      let nuevas = 0
      lote.forEach((t, k) => {
        const ruta = normalizar(rutas[k])
        if (ruta) {
          memoria.set(t.clave, ruta)
          llegadas.set(t.clave, ahora)
          nuevas += 1
        }
      })
      if (nuevas > 0) {
        programarGuardado()
        avisar()
      }
    }
  } finally {
    if (gen === generacion) for (const t of faltan) enVuelo.delete(t.clave)
  }
}
