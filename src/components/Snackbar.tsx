import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SnackbarState {
  message: string
  action?: { label: string; run: () => void }
  key: number
}

/** Kurze Meldung unten (Material), z. B. "Erledigt · Rückgängig" */
export function useSnackbar() {
  const [state, setState] = useState<SnackbarState | null>(null)
  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => setState(null), 4500)
    return () => clearTimeout(t)
  }, [state])

  const show = (message: string, action?: SnackbarState['action']) => setState({ message, action, key: Date.now() })

  const element = state
    ? createPortal(
        <div className="snackbar" key={state.key}>
          <span>{state.message}</span>
          {state.action && (
            <button
              type="button"
              onClick={() => {
                state.action!.run()
                setState(null)
              }}
            >
              {state.action.label}
            </button>
          )}
        </div>,
        document.body,
      )
    : null

  return { show, element }
}
