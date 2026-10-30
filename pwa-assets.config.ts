import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Das Logo ist schon randlos gestaltet (Inhalt in der Sicherheitszone),
// daher ohne zusätzlichen weißen Rand – so sieht es auf iPhone, iPad und Android gleich aus.
const fill = { padding: 0, resizeOptions: { background: '#ffffff', fit: 'contain' as const } }

export default defineConfig({
  preset: {
    ...preset,
    transparent: { ...preset.transparent, ...fill },
    maskable: { ...preset.maskable, ...fill },
    apple: { ...preset.apple, ...fill },
  },
  images: ['public/favicon.svg'],
})
