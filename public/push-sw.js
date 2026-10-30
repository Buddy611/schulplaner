// Wird in den Service Worker eingebunden (siehe vite.config.ts → workbox.importScripts).
// Zeigt eingehende Erinnerungen an und öffnet die App beim Antippen.
self.addEventListener('push', (event) => {
  let data = { title: 'Schulplaner', body: '' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

// "Teilen mit Schulplaner" (Android): Das geteilte Foto/Dokument kommt als POST an.
// Wir legen es kurz im Cache ab und öffnen die Seite #/teilen, die es übernimmt.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return
  event.respondWith(
    (async () => {
      const form = await event.request.formData()
      const cache = await caches.open('share-target')
      const files = form.getAll('files').filter((f) => f && typeof f !== 'string')
      await Promise.all(
        files.map((file, i) =>
          cache.put(`shared-${i}`, new Response(file, { headers: { 'content-type': file.type || 'application/octet-stream', 'x-name': encodeURIComponent(file.name || `Datei-${i + 1}`) } })),
        )
      )
      const meta = { count: files.length, title: form.get('title') || '', text: form.get('text') || '', url: form.get('url') || '' }
      await cache.put('shared-meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }))
      return Response.redirect(new URL('./#/teilen', self.registration.scope).href, 303)
    })(),
  )
})
