import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { applyCachedTheme } from './lib/theme'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './styles.css'

applyCachedTheme()

// Tastatur offen (Fokus in einem Eingabefeld)? Dann die untere Leiste ausblenden –
// sonst schiebt sie sich auf dem Handy über die Tastatur bzw. mitten ins Bild.
const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file', 'color'].includes((el as HTMLInputElement).type)))
document.addEventListener('focusin', (e) => {
  if (isTextField(e.target)) document.documentElement.classList.add('keyboard-open')
})
const checkKeyboard = () =>
  setTimeout(() => {
    if (!isTextField(document.activeElement)) document.documentElement.classList.remove('keyboard-open')
  }, 50)
document.addEventListener('focusout', checkKeyboard)
// Verschwindet ein Eingabefeld (z. B. nach "Sichern"), meldet der Browser das nicht immer –
// beim nächsten Tippen also nachsehen, ob die Tastatur wirklich noch offen ist
document.addEventListener('pointerup', checkKeyboard, true)

// Service Worker: speichert die App für den Offline-Start und holt Updates automatisch,
// sobald Internet da ist (beim Start, beim Wiederverbinden und stündlich).
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (navigator.onLine) void registration.update()
    }
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
