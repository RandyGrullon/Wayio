import { OFFLINE_DB_NAME, OFFLINE_KEY_PREFIX } from './storage'

/**
 * Limpieza de los datos locales de Wayio en este navegador.
 *
 * Al cerrar sesión (sobre todo en un dispositivo compartido) hay que borrar lo
 * que el usuario dejó guardado para usar sin conexión: así el siguiente que
 * use el navegador no ve sus viajes. Todo es best-effort y nunca lanza.
 */

/** Prefijo de las cachés del service worker (public/sw.js). */
const SW_CACHE_PREFIX = 'wayio-'
/** Dueño de los datos offline guardados (id de usuario). */
const OWNER_KEY = `${OFFLINE_KEY_PREFIX}offlineOwner`

function enNavegador(): boolean {
  return typeof window !== 'undefined'
}

async function borrarCachesServiceWorker(): Promise<void> {
  if (!enNavegador() || !('caches' in window)) return
  try {
    const nombres = await window.caches.keys()
    await Promise.all(
      nombres
        .filter((n) => n.startsWith(SW_CACHE_PREFIX))
        .map((n) => window.caches.delete(n))
    )
  } catch {
    /* best effort */
  }
}

function borrarIndexedDB(nombre: string): Promise<void> {
  return new Promise((resolve) => {
    if (!enNavegador() || typeof indexedDB === 'undefined') {
      resolve()
      return
    }
    let hecho = false
    const fin = (): void => {
      if (hecho) return
      hecho = true
      resolve()
    }
    try {
      const req = indexedDB.deleteDatabase(nombre)
      req.onsuccess = fin
      req.onerror = fin
      // Si hay conexiones abiertas el borrado queda pendiente y se completa
      // al cerrarse; no bloqueamos el cierre de sesión por eso.
      req.onblocked = fin
      setTimeout(fin, 3000)
    } catch {
      fin()
    }
  })
}

function borrarClaves(storage: Storage | undefined): void {
  if (!storage) return
  try {
    const claves: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && k.startsWith(OFFLINE_KEY_PREFIX)) claves.push(k)
    }
    claves.forEach((k) => storage.removeItem(k))
  } catch {
    /* modo privado / almacenamiento bloqueado */
  }
}

function leerStorage(
  nombre: 'localStorage' | 'sessionStorage'
): Storage | undefined {
  try {
    return window[nombre]
  } catch {
    return undefined
  }
}

/**
 * Borra todo lo que Wayio guardó en este navegador para el modo sin conexión:
 * las cachés del service worker (`wayio-*`), la base IndexedDB
 * 'wayio-offline' y las claves `wayio:*` de localStorage y sessionStorage.
 * Conserva las preferencias que no son datos personales (p. ej. el tema).
 *
 * Llámala en el cliente ANTES de cerrar sesión. Nunca lanza.
 */
export async function clearOfflineData(): Promise<void> {
  if (!enNavegador()) return
  borrarClaves(leerStorage('localStorage'))
  borrarClaves(leerStorage('sessionStorage'))
  await Promise.all([
    borrarCachesServiceWorker(),
    borrarIndexedDB(OFFLINE_DB_NAME),
  ])
}

/**
 * Recuerda de quién son los datos offline. Si inicia sesión otra persona en
 * el mismo navegador, borra primero los datos de la anterior. Nunca lanza.
 */
export async function syncOfflineOwner(userId: string): Promise<void> {
  if (!enNavegador() || !userId) return
  const local = leerStorage('localStorage')
  let previo: string | null = null
  try {
    previo = local?.getItem(OWNER_KEY) ?? null
  } catch {
    previo = null
  }
  if (previo && previo !== userId) await clearOfflineData()
  if (previo !== userId) {
    try {
      local?.setItem(OWNER_KEY, userId)
    } catch {
      /* best effort */
    }
  }
}
