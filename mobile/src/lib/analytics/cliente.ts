import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { config } from '../../config'
import { getSupabase } from '../supabase/client'
import { sanearUrls } from './sanitize'

/**
 * Cliente mínimo de PostHog para la app, sin dependencias: un POST por evento
 * al endpoint de captura (`<host>/i/v0/e/`) con la clave PÚBLICA del proyecto,
 * la misma que usa la web (NEXT_PUBLIC_POSTHOG_KEY → EXPO_PUBLIC_POSTHOG_KEY).
 *
 * - Dispara y olvida: nada se espera ni lanza; la analítica nunca rompe la app.
 * - Sin EXPO_PUBLIC_POSTHOG_KEY es un no-op.
 * - distinct_id = id del usuario de Supabase si hay sesión (el mismo con el
 *   que la web hace identify) o un id anónimo del dispositivo guardado en
 *   AsyncStorage. Sin sesión no se crea perfil de persona, como
 *   `person_profiles: 'identified_only'` en la web.
 * - No va por lib/api/http.ts a propósito: ese cliente añade el Bearer de
 *   Supabase, que nunca debe salir hacia un tercero.
 */

const CLAVE_ID_ANONIMO = 'wayio:analytics:idAnonimo'
const TIEMPO_LIMITE_MS = 10_000

let idAnonimo: Promise<string> | null = null

function uuid(): string {
  const nativo = globalThis.crypto?.randomUUID?.()
  if (nativo) return nativo
  // UUID v4 con Math.random: solo distingue este dispositivo ante PostHog.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : 8 + (r % 4)).toString(16)
  })
}

async function leerIdAnonimo(): Promise<string> {
  try {
    const guardado = await AsyncStorage.getItem(CLAVE_ID_ANONIMO)
    if (guardado) return guardado
  } catch {
    // Sin almacenamiento: un id nuevo solo para esta sesión de la app.
  }
  const nuevo = uuid()
  try {
    await AsyncStorage.setItem(CLAVE_ID_ANONIMO, nuevo)
  } catch {
    // Se queda en memoria hasta que se cierre la app.
  }
  return nuevo
}

function obtenerIdAnonimo(): Promise<string> {
  idAnonimo ??= leerIdAnonimo()
  return idAnonimo
}

/** Id del usuario con sesión (solo el id, nunca su email). */
async function idUsuario(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

function sistema(): string {
  if (Platform.OS === 'ios') return 'iOS'
  if (Platform.OS === 'android') return 'Android'
  return Platform.OS
}

async function enviar(
  evento: string,
  propiedades: Record<string, unknown>,
  timestamp: string
): Promise<void> {
  const limpias = sanearUrls(propiedades)
  // No se pudo limpiar: mejor perder el evento que mandar un token.
  if (!limpias) return
  const usuario = await idUsuario()
  const distinctId = usuario ?? (await obtenerIdAnonimo())
  const cuerpo = JSON.stringify({
    api_key: config.posthogKey,
    event: evento,
    distinct_id: distinctId,
    timestamp,
    properties: {
      ...limpias,
      $lib: 'wayio-movil',
      $os: sistema(),
      ...(usuario ? {} : { $process_person_profile: false }),
    },
  })
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), TIEMPO_LIMITE_MS)
  try {
    await fetch(`${config.posthogHost}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      signal: control.signal,
    })
  } finally {
    clearTimeout(reloj)
  }
}

/** ¿Hay clave de PostHog en esta build? */
export function analiticaActiva(): boolean {
  return Boolean(config.posthogKey)
}

/** Captura cruda (la usa `track`, que es la API tipada). Nunca lanza. */
export function capturar(
  evento: string,
  propiedades: Record<string, unknown> = {}
): void {
  if (!config.posthogKey) return
  try {
    const timestamp = new Date().toISOString()
    enviar(evento, { ...propiedades }, timestamp).catch(() => undefined)
  } catch {
    // La analítica nunca rompe la app.
  }
}
