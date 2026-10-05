// Casai Service Worker
const CACHE = "lofty-v2"

// App shell — these load instantly even offline
const PRECACHE = [
  "/dashboard",
  "/contacts",
  "/pipeline",
  "/tasks",
]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, and API requests — always go to network
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return
  }

  // Network-first for HTML navigation (always fresh data).
  // Only successful responses are stored: caching a 404 means a page visited
  // before it was deployed keeps serving that 404 from the cache afterwards,
  // and a page nobody can open is worse than a page that loads slowly.
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
        }
        return res
      })
    })
  )
})
