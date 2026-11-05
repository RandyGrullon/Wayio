/**
 * Configuración remota de la app (GET /api/config?platform=mobile): feature
 * flags y modo mantenimiento que guarda el admin.
 *
 * - Una sola copia (store de módulo) compartida por todas las pantallas, con
 *   caché de 60 s: se pide al montar el primer componente y se refresca al
 *   volver la app a primer plano si ya caducó.
 * - Nunca rompe: sin EXPO_PUBLIC_API_URL, sin red o con un error del servidor
 *   se conserva lo último leído (o los valores por defecto: sin
 *   mantenimiento y sin flags, ver useFlag). Tiempo límite de 8 s.
 * - Solo sirve para la UI: el servidor decide (las rutas de generar y
 *   ajustar responden 503 `{ error, code: 'mantenimiento' }` por su cuenta).
 */
import { useEffect, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { getJSON } from '../lib/api/http'

export interface FlagRemoto {
  enabled: boolean
  value: unknown
}

export interface MantenimientoRemoto {
  activo: boolean
  /** Mensaje configurado por el admin (o el de por defecto). */
  mensaje: string
}

export interface ConfigRemota {
  flags: Readonly<Record<string, FlagRemoto>>
  mantenimiento: MantenimientoRemoto
  /** true cuando ya hubo una respuesta válida del servidor. */
  cargada: boolean
}

/** `code` del 503 de generar y ajustar durante el mantenimiento. */
export const CODIGO_MANTENIMIENTO = 'mantenimiento'

/** Texto por defecto (el del seed de supabase/schema.sql). */
export const MENSAJE_MANTENIMIENTO =
  'Estamos en mantenimiento, volvemos pronto.'

const RUTA_CONFIG = '/api/config?platform=mobile'
const VIDA_MS = 60_000
const TIEMPO_LIMITE_MS = 8_000
const MAX_MENSAJE = 500

const POR_DEFECTO: ConfigRemota = {
  flags: {},
  mantenimiento: { activo: false, mensaje: MENSAJE_MANTENIMIENTO },
  cargada: false,
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Valida el cuerpo de /api/config; null si no tiene la forma esperada. */
function leerCuerpo(data: unknown): ConfigRemota | null {
  if (!esObjeto(data)) return null
  const flags: Record<string, FlagRemoto> = {}
  const crudos = data['flags']
  if (esObjeto(crudos)) {
    for (const [clave, f] of Object.entries(crudos)) {
      if (esObjeto(f) && typeof f['enabled'] === 'boolean') {
        flags[clave] = { enabled: f['enabled'], value: f['value'] ?? null }
      }
    }
  }
  const m = esObjeto(data['maintenance']) ? data['maintenance'] : {}
  const texto = m['message']
  const mensaje =
    typeof texto === 'string' && texto.trim()
      ? texto.trim().slice(0, MAX_MENSAJE)
      : MENSAJE_MANTENIMIENTO
  return {
    flags,
    mantenimiento: { activo: m['enabled'] === true, mensaje },
    cargada: true,
  }
}

// ── Store de módulo ────────────────────────────────────────────────────────

let actual: ConfigRemota = POR_DEFECTO
let leidaEn = 0
let enCurso: Promise<ConfigRemota> | null = null
const oyentes = new Set<() => void>()

function publicar(siguiente: ConfigRemota): void {
  actual = siguiente
  oyentes.forEach((oyente) => oyente())
}

async function pedir(): Promise<ConfigRemota> {
  try {
    const leida = leerCuerpo(
      await getJSON<unknown>(RUTA_CONFIG, { timeoutMs: TIEMPO_LIMITE_MS })
    )
    if (leida) publicar(leida)
  } catch {
    // Sin backend, sin red o error del servidor: se conserva lo último.
  } finally {
    leidaEn = Date.now()
  }
  return actual
}

/**
 * La configuración, pedida de nuevo si caducó (o siempre con `forzar`).
 * Nunca lanza; varias llamadas a la vez comparten la misma petición.
 */
export function refrescarConfigRemota(forzar = false): Promise<ConfigRemota> {
  if (enCurso) return enCurso
  if (!forzar && Date.now() - leidaEn < VIDA_MS) return Promise.resolve(actual)
  enCurso = pedir().finally(() => {
    enCurso = null
  })
  return enCurso
}

/**
 * El servidor respondió 503 code 'mantenimiento' (p. ej. se activó después
 * de la última lectura): se muestra ya el aviso con su mensaje.
 */
export function marcarMantenimiento(mensaje?: string | null): void {
  publicar({
    ...actual,
    mantenimiento: {
      activo: true,
      mensaje: mensaje?.trim() || actual.mantenimiento.mensaje,
    },
  })
}

/** ¿Es el 503 `code: 'mantenimiento'` de generar o ajustar? */
export function esMantenimiento(
  status: number | null | undefined,
  code: string | null | undefined
): boolean {
  return status === 503 && code === CODIGO_MANTENIMIENTO
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

const leer = (): ConfigRemota => actual

// ── Hooks ──────────────────────────────────────────────────────────────────

/** Configuración remota (flags y mantenimiento) con caché corta. */
export function useConfigRemota(): ConfigRemota {
  const config = useSyncExternalStore(suscribir, leer, leer)

  useEffect(() => {
    void refrescarConfigRemota()
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void refrescarConfigRemota()
    })
    return () => sub.remove()
  }, [])

  return config
}

/** Modo mantenimiento: `activo` y el mensaje configurado por el admin. */
export function useMantenimiento(): MantenimientoRemoto {
  return useConfigRemota().mantenimiento
}
