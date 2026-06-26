const CACHE_NAME = 'magzic-shell-v1'
const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/favicon.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  )
  self.clients.claim()
})

// Network-first dla nawigacji i własnych zasobów statycznych; nigdy nie przechwytuje
// zapytań cross-origin (Supabase API/Realtime) — te idą bezpośrednio do sieci.
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {})
        return response
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  )
})
