import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Node-Umgebung beim Build (ohne extra @types/node)
declare const process: { env: Record<string, string | undefined>; cwd(): string }

// Die App liegt auf GitHub Pages unter https://<name>.github.io/schulplaner/
const base = '/schulplaner/'

/**
 * Inhaltsschutz (Content Security Policy) für die veröffentlichte App: Code nur von der
 * eigenen Seite, Verbindungen nur zu Supabase und zur Ferien-Schnittstelle. Eingeschleuster
 * fremder Code wird vom Browser blockiert. (Nur beim Build – der Entwicklungsserver braucht Inline-Code.)
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const supabase = supabaseUrl ? new URL(supabaseUrl).host : '*.supabase.co'
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' https://${supabase} wss://${supabase} https://openholidaysapi.org`,
    "frame-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

export default defineConfig(({ mode }) => ({
  base,
  build: { chunkSizeWarningLimit: 1500 },
  define: {
    // Build-Zeitpunkt als Versionsanzeige in den Einstellungen
    __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    contentSecurityPolicy(process.env.VITE_SUPABASE_URL ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL),
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
        // Android färbt damit den Streifen unter den Navigationstasten (beim Installieren festgelegt,
        // nicht live umschaltbar) – dunkel wie die untere Leiste der App im Dunkelmodus
        background_color: '#1d2024',
        theme_color: '#1d2024',
        // "Teilen mit Schulplaner" im Android-Teilen-Menü (Fotos, PDFs, Text)
        share_target: {
          action: `${base}share-target`,
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'files', accept: ['image/*', 'application/pdf'] }] },
        },
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
}))
