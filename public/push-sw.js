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
