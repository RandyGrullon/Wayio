/**
 * Copia sin conexión del VIAJE GUARDADO (pantalla de detalle), equivalente a
 * la copia en IndexedDB de la web (hooks/useOfflineTrip.ts + VistaViaje):
 * se guarda la fila que devuelve getTrip (y tras cada cambio guardado) y, si
 * no hay red o falla la carga, la pantalla la muestra con el aviso «copia
 * guardada del …».
 *
 * - Clave `wayio:trip:guardado:<id de la fila>`: distinta de la copia del modo
 *   en vivo (`wayio:trip:<id>`, lib/offline/storage.ts), pero con el mismo
 *   prefijo, así cerrar sesión (tasks/limpiar.ts) también la borra.
 * - Como mucho MAX_COPIAS viajes y MAX_TOTAL caracteres entre todas: en
 *   Android AsyncStorage tiene 6 MB por defecto y ahí vive también la sesión
 *   de Supabase, que no puede quedarse sin sitio. Se descartan primero los
 *   viajes abiertos hace más tiempo (y antes de escribir, no después).
 * - Todo es best-effort: el almacenamiento puede fallar y nunca debe romper
 *   la pantalla (devuelve null en vez de lanzar).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'
import type { TripRow } from '../../types/planning'

const PREFIJO = 'wayio:trip:guardado:'
/** Copias (id y tamaño), de la más antigua a la más reciente. */
const INDICE = 'wayio:trip:guardados'
const MAX_COPIAS = 20
/** ~1,5 MB entre todas las copias (en caracteres del JSON guardado). */
const MAX_TOTAL = 1_500_000

interface EntradaIndice {
  id: string
  /** Caracteres del JSON guardado. */
  tam: number
}

export interface CopiaViajeGuardado {
  fila: TripRow
  /** ISO de cuándo se guardó la copia. */
  guardadoEn: string
}

function esCopia(v: unknown): v is CopiaViajeGuardado {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  const fila = o['fila'] as Record<string, unknown> | null | undefined
  const data = fila?.['data'] as Record<string, unknown> | null | undefined
  return (
    typeof o['guardadoEn'] === 'string' &&
    typeof fila?.['id'] === 'string' &&
    typeof data?.['destino'] === 'string' &&
    Array.isArray(data['dias'])
  )
}

/**
 * Las escrituras van de una en una: dos guardados a la vez leerían el mismo
 * índice y uno borraría como huérfana la copia que acaba de escribir el otro.
 */
let cola: Promise<unknown> = Promise.resolve()
function enCola<T>(trabajo: () => Promise<T>): Promise<T> {
  const siguiente = cola.then(trabajo, trabajo)
  cola = siguiente.catch(() => undefined)
  return siguiente
}

function esEntrada(v: unknown): v is EntradaIndice {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o['id'] === 'string' &&
    typeof o['tam'] === 'number' &&
    Number.isFinite(o['tam']) &&
    o['tam'] >= 0
  )
}

async function leerIndice(): Promise<EntradaIndice[]> {
  const raw = await AsyncStorage.getItem(INDICE)
  if (!raw) return []
  const lista = JSON.parse(raw) as unknown
  return Array.isArray(lista) ? lista.filter(esEntrada) : []
}

/**
 * Deja en el almacenamiento solo las copias de `indice` (borra las que no
 * están: descartadas por número o tamaño, o huérfanas de un índice que no
 * llegó a escribirse) y guarda el índice.
 */
async function aplicarIndice(indice: EntradaIndice[]): Promise<void> {
  const vigentes = new Set(indice.map((e) => PREFIJO + e.id))
  const claves = await AsyncStorage.getAllKeys()
  const sobran = claves.filter((k) => k.startsWith(PREFIJO) && !vigentes.has(k))
  if (sobran.length > 0) await AsyncStorage.multiRemove(sobran)
  await AsyncStorage.setItem(INDICE, JSON.stringify(indice))
}

/**
 * Índice con `entrada` como la copia más reciente, recortado por número y por
 * tamaño total quitando las más antiguas (la nueva siempre se queda).
 */
function indiceCon(
  previo: EntradaIndice[],
  entrada: EntradaIndice
): EntradaIndice[] {
  const indice = [...previo.filter((e) => e.id !== entrada.id), entrada]
  let total = indice.reduce((s, e) => s + e.tam, 0)
  while (
    indice.length > 1 &&
    (indice.length > MAX_COPIAS || total > MAX_TOTAL)
  ) {
    const vieja = indice.shift()
    if (!vieja) break
    total -= vieja.tam
  }
  return indice
}

/**
 * Guarda (o reemplaza) la copia del viaje. Devuelve la fecha ISO de la copia,
 * o null si no se pudo guardar (o el viaje solo ya pasa del tope total).
 */
export function guardarCopiaViaje(fila: TripRow): Promise<string | null> {
  return enCola(() => guardar(fila))
}

async function guardar(fila: TripRow): Promise<string | null> {
  try {
    const guardadoEn = new Date().toISOString()
    const copia: CopiaViajeGuardado = { fila, guardadoEn }
    const raw = JSON.stringify(copia)
    const previo = await leerIndice().catch(() => [] as EntradaIndice[])
    if (raw.length > MAX_TOTAL) {
      // Demasiado grande para guardarlo sin arriesgar la sesión: fuera
      // también la copia vieja (ya no coincide con lo guardado).
      await aplicarIndice(previo.filter((e) => e.id !== fila.id))
      return null
    }
    const indice = indiceCon(previo, { id: fila.id, tam: raw.length })
    // Primero se hace sitio y después se escribe.
    await aplicarIndice(indice)
    try {
      await AsyncStorage.setItem(PREFIJO + fila.id, raw)
    } catch {
      await aplicarIndice(indice.filter((e) => e.id !== fila.id)).catch(
        () => undefined
      )
      return null
    }
    return guardadoEn
  } catch {
    return null
  }
}

/** La copia guardada del viaje, o null si no hay (o está dañada). */
export async function leerCopiaViaje(
  id: string
): Promise<CopiaViajeGuardado | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIJO + id)
    if (!raw) return null
    const copia = JSON.parse(raw) as unknown
    return esCopia(copia) && copia.fila.id === id ? copia : null
  } catch {
    return null
  }
}

/** Borra la copia (p. ej. al eliminar el viaje). Nunca lanza. */
export function borrarCopiaViaje(id: string): Promise<void> {
  return enCola(async () => {
    try {
      await AsyncStorage.removeItem(PREFIJO + id)
      const indice = await leerIndice()
      await AsyncStorage.setItem(
        INDICE,
        JSON.stringify(indice.filter((e) => e.id !== id))
      )
    } catch {
      // Sin almacenamiento: nada que borrar.
    }
  })
}

/**
 * ¿Hay red? Solo dice «no» cuando el sistema lo sabe seguro (sin red o sin
 * internet); si no se puede saber, se asume que sí.
 */
export async function hayConexion(): Promise<boolean> {
  try {
    const estado = await Network.getNetworkStateAsync()
    return estado.isConnected !== false && estado.isInternetReachable !== false
  } catch {
    return true
  }
}

/** Igual que hayConexion, para el estado de useNetworkState(). */
export function estaEnLinea(estado: Network.NetworkState): boolean {
  return estado.isConnected !== false && estado.isInternetReachable !== false
}
