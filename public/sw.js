/*
 * Wayio offline service worker.
 *
 * Strategy:
 *  - App shell / static assets (Next.js build output, fonts, images):
 *    cache-first, so an already-opened trip view loads with no network.
 *  - Navigations and trip/API data: network-first, falling back to the last
 *    cached response (or the cached shell) when offline.
 *
 * Self-contained vanilla JS — served as a static asset from /public, so it is
 * never processed by the Next.js bundler.
 */

const VERSION = 'v1'
const SHELL_CACHE = `wayio-shell-${VERSION}`
const RUNTIME_CACHE = `wayio-runtime-${VERSION}`

// Minimal shell to precache. Kept tiny so install never fails on a missing
// asset; the bulk of the app shell is cached lazily on first visit.
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/favicon.ico']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|gif|webp|ico)$/.test(
      url.pathname,
    )
  )
}

// Cache-first: serve from cache, fall back to network and populate the cache.
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

// Network-first: try the network, cache successes, fall back to cache offline.
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET; let the browser deal with POST/PUT/etc.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Same-origin only — never intercept third-party requests (analytics, maps…).
  if (url.origin !== self.location.origin) return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Navigations and data (incl. trip itineraries) — network-first w/ fallback.
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
  }
})
