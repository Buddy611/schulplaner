import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Die App liegt auf GitHub Pages unter https://<name>.github.io/schulplaner/
const base = '/schulplaner/'

export default defineConfig({
  base,
  build: { chunkSizeWarningLimit: 1500 },
  define: {
    // Build-Zeitpunkt als Versionsanzeige in den Einstellungen
    __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    VitePWA({
      // Neue Versionen werden automatisch geladen und aktiviert.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Schulplaner',
        short_name: 'Schulplaner',
        description: 'Mein privater Schulplaner',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        // Gleiche Farbe wie die App selbst – sonst zeigt Android z. B. unter den Navigationstasten einen farbigen Balken
        background_color: '#ededf4',
        theme_color: '#ededf4',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Die komplette App wird zwischengespeichert, damit sie offline startet.
        // Nur lateinische Schrift-Dateien (Roboto) – reicht für Deutsch und hält den Offline-Speicher klein.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}', '**/*latin-[0-9]*.woff2', '**/*latin-ext-[0-9]*.woff2'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Push-Nachrichten anzeigen (public/push-sw.js)
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
