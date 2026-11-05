'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Configuración remota de la web (GET /api/config?platform=web): feature
 * flags y modo mantenimiento que guarda el admin.
 *
 * - Una sola copia por pestaña (store de módulo) compartida por todos los
 *   componentes, con caché de 60 s: se pide al montar el primero y se
 *   refresca al volver a la pestaña si ya caducó. La respuesta trae además
 *   Cache-Control de 30 s (misma URL que AnnouncementBanner).
 * - Nunca rompe: sin Supabase (modo demo) no se pide nada; si la petición
 *   falla o tarda más de 5 s se conserva lo último leído (o los valores por
 *   defecto: sin mantenimiento y sin flags, ver useFlag).
 * - Solo sirve para la UI: el servidor decide (las rutas de generar y ajustar
 *   responden 503 code 'mantenimiento' por su cuenta).
 */

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

/** Texto por defecto (el del seed de supabase/schema.sql). */
export const MENSAJE_MANTENIMIENTO =
  'Estamos en mantenimiento, volvemos pronto.'

const URL_CONFIG = '/api/config?platform=web'
const VIDA_MS = 60_000
const TIEMPO_LIMITE_MS = 5_000
const MAX_MENSAJE = 500

const POR_DEFECTO: ConfigRemota = {
  flags: {},
  mantenimiento: { activo: false, mensaje: MENSAJE_MANTENIMIENTO },
  cargada: false,
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Valida el cuerpo de /api/config; null si no tiene la forma esperada. */
function leerCuerpo(data: unknown): ConfigRemota | null {
  if (!esObjeto(data)) return null
  const flags: Record<string, FlagRemoto> = {}
  if (esObjeto(data['flags'])) {
    for (const [clave, f] of Object.entries(data['flags'])) {
      if (esObjeto(f) && typeof f['enabled'] === 'boolean') {
        flags[clave] = { enabled: f['enabled'], value: f['value'] ?? null }
      }
    }
  }
  const m = esObjeto(data['maintenance']) ? data['maintenance'] : {}
  const mensaje =
    typeof m['message'] === 'string' && m['message'].trim()
      ? m['message'].trim().slice(0, MAX_MENSAJE)
      : MENSAJE_MANTENIMIENTO
  return {
    flags,
    mantenimiento: { activo: m['enabled'] === true, mensaje },
    cargada: true,
  }
}

// ─── Store de módulo ──────────────────────────────────────────────────────

let actual: ConfigRemota = POR_DEFECTO
let leidaEn = 0
let enCurso: Promise<void> | null = null
const oyentes = new Set<() => void>()

async function pedir(): Promise<void> {
  const control = new AbortController()
  const temporizador = window.setTimeout(
    () => control.abort(),
    TIEMPO_LIMITE_MS
  )
  try {
    const res = await fetch(URL_CONFIG, {
      headers: { Accept: 'application/json' },
      signal: control.signal,
    })
    const leida = res.ok ? leerCuerpo(await res.json()) : null
    if (leida) {
      actual = leida
      oyentes.forEach((oyente) => oyente())
    }
  } catch {
    // Sin red o sin respuesta: se conserva lo último leído.
  } finally {
    window.clearTimeout(temporizador)
    leidaEn = Date.now()
  }
}

/**
 * Pide la configuración si caducó (o siempre con `forzar`, p. ej. tras un
 * 503 code 'mantenimiento'). Nunca lanza; varias llamadas a la vez comparten
 * la misma petición.
 */
export function refrescarConfigRemota(forzar = false): Promise<void> {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    return Promise.resolve()
  }
  if (enCurso) return enCurso
  if (!forzar && Date.now() - leidaEn < VIDA_MS) return Promise.resolve()
  enCurso = pedir().finally(() => {
    enCurso = null
  })
  return enCurso
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

const leer = (): ConfigRemota => actual
const enServidor = (): ConfigRemota => POR_DEFECTO

// ─── Hooks ────────────────────────────────────────────────────────────────

/** Configuración remota (flags y mantenimiento) con caché corta. */
export function useConfigRemota(): ConfigRemota {
  const config = useSyncExternalStore(suscribir, leer, enServidor)

  useEffect(() => {
    void refrescarConfigRemota()
    const alVolver = () => {
      if (document.visibilityState === 'visible') void refrescarConfigRemota()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [])

  return config
}

/** Modo mantenimiento: `activo` y el mensaje configurado por el admin. */
export function useMantenimiento(): MantenimientoRemoto {
  return useConfigRemota().mantenimiento
}
