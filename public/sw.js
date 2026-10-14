/*
 * Service worker de Wayio (modo sin conexión).
 *
 * Qué guarda (y qué no):
 *  - Estáticos del build (/_next/static, inmutables): cache-first.
 *  - Imágenes, fuentes e iconos: stale-while-revalidate.
 *  - Páginas: red primero; se guardan solo las públicas y cacheables, y sin
 *    red se sirve la copia guardada o una pantalla "Sin conexión".
 *  - NUNCA: /api/**, /admin/**, /auth/**, /login, /group/**, /cuenta/** ni
 *    respuestas con Cache-Control no-store o private (datos de un usuario).
 *    Los viajes sin conexión viven en IndexedDB (useOfflineTrip), no aquí.
 *
 * Las cachés llevan versión: al cambiar CACHE_VERSION se borran las viejas.
 * La app las borra también al cerrar sesión (src/lib/offline/cleanup.ts).
 *
 * JS plano: se sirve tal cual desde /public, sin pasar por el bundler.
 */

const CACHE_VERSION = 'v4-2026-10-09'
const CACHE_PREFIX = 'wayio-'
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`
const ASSETS_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`
const PAGES_CACHE = `${CACHE_PREFIX}pages-${CACHE_VERSION}`
const CACHES_ACTUALES = [STATIC_CACHE, ASSETS_CACHE, PAGES_CACHE]

// Límite de entradas por caché (se borran las más antiguas).
const MAX_STATIC = 200
const MAX_ASSETS = 80
const MAX_PAGES = 25

// Shell mínima que se intenta precachear al instalar: la portada (páginas) y
// el manifiesto con sus iconos (assets), para que la app instalada abra con
// su icono aunque no haya red.
const SHELL_URLS = ['/']
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
]

// Rutas privadas o de sesión: el SW no las guarda nunca.
const RUTAS_PRIVADAS = [
  '/api',
  '/admin',
  '/auth',
  '/login',
  '/group',
  '/cuenta',
  '/monitoring',
]

const ASSET_RE =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest)$/i

const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sin conexión · Wayio</title>
<style>
  /* Paleta «Cuaderno de Ruta» (docs/DISENO.md §2): papel, tinta y rosa. */
  :root { color-scheme: light dark; --bg: #F7F4EE; --fg: #0F1E2E; --muted: #46525F; --card: #FFFFFF; --border: #E2DCD0; --rosa: #C21A66; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0B1622; --fg: #F1EEE8; --muted: #B6C2CE; --card: #112131; --border: #22384D; --rosa: #F55A9A; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { width: 100%; max-width: 420px; background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 28px 24px; text-align: center; }
  svg { display: block; margin: 0 auto 16px; }
  h1 { margin: 0 0 8px; font-family: Georgia, "Times New Roman", serif; font-weight: 500; font-size: 1.5rem; }
  p { margin: 0 0 20px; color: var(--muted); line-height: 1.5; font-size: 0.95rem; }
  button { font: inherit; font-weight: 600; min-height: 44px; padding: 10px 20px; border-radius: 999px; border: 0; background: var(--fg); color: var(--bg); cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--rosa); outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round"/><circle cx="20" cy="20" r="4" fill="var(--rosa)"/></svg>
  <h1>Sin conexión</h1>
  <p>No pudimos abrir esta página porque no hay internet. Cuando vuelva la conexión, inténtalo de nuevo.</p>
  <button type="button" onclick="location.reload()">Reintentar</button>
</main>
</body>
</html>`

function esPrivada(pathname) {
  return RUTAS_PRIVADAS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

function esEstaticoDelBuild(url) {
  return url.pathname.startsWith('/_next/static/')
}

function esAsset(url) {
  return url.pathname.startsWith('/_next/image') || ASSET_RE.test(url.pathname)
}

/** ¿Se puede guardar esta respuesta sin filtrar datos de un usuario? */
function sePuedeGuardar(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') {
    return false
  }
  // Una respuesta redirigida no se puede reutilizar para una navegación.
  if (response.redirected) return false
  const cc = (response.headers.get('Cache-Control') || '').toLowerCase()
  if (/(?:^|[\s,])(?:no-store|private)(?:$|[\s,=])/.test(cc)) return false
  if ((response.headers.get('Vary') || '').trim() === '*') return false
  return true
}

/** Borra las entradas más antiguas si la caché supera `max`. */
async function recortar(nombre, max) {
  try {
    const cache = await caches.open(nombre)
    const claves = await cache.keys()
    const sobran = claves.length - max
    for (let i = 0; i < sobran; i++) {
      await cache.delete(claves[i])
    }
  } catch {
    /* best effort */
  }
}

async function guardar(nombre, max, request, response) {
  try {
    const cache = await caches.open(nombre)
    await cache.put(request, response)
    await recortar(nombre, max)
  } catch {
    /* cuota llena u otra causa: seguimos sin guardar */
  }
}

function respuestaOffline() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    statusText: 'Sin conexion',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const paginas = await caches.open(PAGES_CACHE)
        const assets = await caches.open(ASSETS_CACHE)
        await Promise.allSettled([
          ...SHELL_URLS.map(async (url) => {
            const res = await fetch(url, { cache: 'no-cache' })
            if (sePuedeGuardar(res)) await paginas.put(url, res)
          }),
          ...SHELL_ASSETS.map(async (url) => {
            const res = await fetch(url, { cache: 'no-cache' })
            if (sePuedeGuardar(res)) await assets.put(url, res)
          }),
        ])
      } catch {
        /* la instalación nunca falla por la shell */
      }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const nombres = await caches.keys()
        await Promise.all(
          nombres
            .filter(
              (n) => n.startsWith(CACHE_PREFIX) && !CACHES_ACTUALES.includes(n)
            )
            .map((n) => caches.delete(n))
        )
      } catch {
        /* best effort */
      }
      try {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable()
        }
      } catch {
        /* navegadores sin navigation preload */
      }
      await self.clients.claim()
    })()
  )
})

// Cache-first: para archivos con hash en el nombre (nunca cambian).
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const guardada = await cache.match(request)
  if (guardada) return guardada
  const response = await fetch(request)
  if (sePuedeGuardar(response)) {
    void guardar(STATIC_CACHE, MAX_STATIC, request, response.clone())
  }
  return response
}

// Stale-while-revalidate: responde con lo guardado y actualiza por detrás.
async function staleWhileRevalidate(event) {
  const { request } = event
  const cache = await caches.open(ASSETS_CACHE)
  const guardada = await cache.match(request)
  const red = fetch(request)
    .then((response) => {
      if (sePuedeGuardar(response)) {
        return guardar(
          ASSETS_CACHE,
          MAX_ASSETS,
          request,
          response.clone()
        ).then(() => response)
      }
      return response
    })
    .catch(() => null)
  if (guardada) {
    event.waitUntil(red)
    return guardada
  }
  const response = await red
  return response || Response.error()
}

// Navegación pública: red primero; sin red, copia guardada o aviso offline.
async function paginaPublica(event) {
  const { request } = event
  try {
    const precargada = await event.preloadResponse
    const response = precargada || (await fetch(request))
    if (sePuedeGuardar(response)) {
      event.waitUntil(
        guardar(PAGES_CACHE, MAX_PAGES, request, response.clone())
      )
    }
    return response
  } catch {
    const cache = await caches.open(PAGES_CACHE)
    const guardada = await cache.match(request)
    if (guardada) return guardada
    return respuestaOffline()
  }
}

// Navegación privada: nunca se guarda; sin red, aviso offline.
async function paginaPrivada(event) {
  try {
    const precargada = await event.preloadResponse
    return precargada || (await fetch(event.request))
  } catch {
    return respuestaOffline()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Solo GET y del mismo origen (nada de analítica, mapas o APIs externas).
  if (request.method !== 'GET') return
  if (request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      esPrivada(url.pathname) ? paginaPrivada(event) : paginaPublica(event)
    )
    return
  }

  // Datos y rutas privadas: siempre a la red, sin tocar la caché.
  if (esPrivada(url.pathname)) return

  if (esEstaticoDelBuild(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (esAsset(url)) {
    event.respondWith(staleWhileRevalidate(event))
  }

  // El resto (payloads RSC de navegación, prefetch, etc.) va directo a la red.
})
