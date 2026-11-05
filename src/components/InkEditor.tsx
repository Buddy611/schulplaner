import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { confirmDialog } from './dialogs'
import { ColorPicker, Select, Sheet } from './ui'
import { t } from '../lib/i18n'
import { drawStroke, emptyPage, hitStroke, PAGE_W, renderPage, type InkDoc, type InkPage, type Paper, type Stroke, type Tool } from '../lib/ink'

type Mode = Tool | 'eraser'

const PEN_COLORS = ['#1f1f1f', '#1a57d6', '#d93025', '#188038', '#8e24aa']
const MARKER_COLORS = ['#ffe23b', '#9ef28a', '#ff9ecf', '#8fd3ff', '#ffb74d']
const PEN_SIZES = [2, 3.5, 6]
const MARKER_SIZES = [16, 26, 40]
const ERASER_R = 14
const CUSTOM_KEY = 'schulplaner-ink-farben'

/** Zuletzt benutzte eigene Farben (pro Gerät gemerkt) */
function loadCustom(): { pen: string[]; marker: string[] } {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? 'null')
    if (v && Array.isArray(v.pen) && Array.isArray(v.marker)) return v
  } catch {
    // egal
  }
  return { pen: [], marker: [] }
}

type Action =
  | { kind: 'add'; page: number; stroke: Stroke }
  | { kind: 'erase'; page: number; removed: { i: number; stroke: Stroke }[] }
  | { kind: 'page'; index: number; page: InkPage }
  | { kind: 'paper'; page: number; from: Paper; to: Paper }

const clone = (d: InkDoc): InkDoc => ({ v: 1, pages: d.pages.map((p) => ({ ...p, strokes: [...p.strokes] })) })

/**
 * Schreiben wie in GoodNotes: Stift, Textmarker, Radierer, Papier je Seite, mehrere Seiten.
 * Apple Pencil schreibt, der Finger scrollt (auf Geräten ohne Stift schreibt der Finger – umschaltbar).
 */
export function InkEditor({
  initial,
  title = t('Handschrift'),
  readOnly = false,
  onSave,
  onClose,
}: {
  initial: InkDoc
  title?: string
  readOnly?: boolean
  onSave?: (doc: InkDoc) => Promise<void> | void
  onClose: () => void
}) {
  const docRef = useRef<InkDoc>(clone(initial))
  const [, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)
  const doc = docRef.current

  const [mode, setMode] = useState<Mode>('pen')
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [markerColor, setMarkerColor] = useState(MARKER_COLORS[0])
  const [penSize, setPenSize] = useState(PEN_SIZES[1])
  const [markerSize, setMarkerSize] = useState(MARKER_SIZES[1])
  const [fingerDraws, setFingerDraws] = useState(true)
  const [custom, setCustom] = useState(loadCustom)
  const [activePage, setActivePage] = useState(0)
  const [busy, setBusy] = useState(false)
  const undo = useRef<Action[]>([])
  const redo = useRef<Action[]>([])
  const dirty = useRef(false)
  const penSeen = useRef(false)

  const scroller = useRef<HTMLDivElement>(null)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const overlays = useRef<(HTMLCanvasElement | null)[]>([])
  const [width, setWidth] = useState(0)
  const scale = width / PAGE_W

  // Breite der Seiten an den Platz anpassen
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.min(1000, el.clientWidth - 24)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const dpr = Math.min(2, window.devicePixelRatio || 1)

  const redraw = useCallback(
    (i: number) => {
      const c = canvases.current[i]
      const page = docRef.current.pages[i]
      if (!c || !page || !width) return
      const ctx = c.getContext('2d')!
      void renderPage(ctx, page, (width / PAGE_W) * dpr)
    },
    [width, dpr],
  )

  // Alle Seiten neu zeichnen, wenn sich die Breite oder die Seitenzahl ändert
  const pageCount = doc.pages.length
  useEffect(() => {
    for (let i = 0; i < pageCount; i++) redraw(i)
  }, [redraw, pageCount])

  // ---------- Zeichnen ----------
  const live = useRef<{ id: number; page: number; stroke?: Stroke; erased?: { i: number; stroke: Stroke }[]; scrollY?: number } | null>(null)

  const pointFor = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }, i: number) => {
    const rect = canvases.current[i]!.getBoundingClientRect()
    const s = rect.width / PAGE_W
    return [(e.clientX - rect.left) / s, (e.clientY - rect.top) / s, e.pointerType === 'pen' ? e.pressure : 0.5]
  }

  function eraseAt(i: number, x: number, y: number) {
    const page = docRef.current.pages[i]
    const hit: { i: number; stroke: Stroke }[] = []
    page.strokes.forEach((s, idx) => hitStroke(s, x, y, ERASER_R) && hit.push({ i: idx, stroke: s }))
    if (!hit.length) return
    page.strokes = page.strokes.filter((_, idx) => !hit.some((h) => h.i === idx))
    live.current!.erased!.push(...hit)
    redraw(i)
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>, i: number) {
    if (live.current) return
    if (e.pointerType === 'pen' && !penSeen.current) {
      penSeen.current = true
      setFingerDraws(false)
    }
    const draws = !readOnly && (e.pointerType !== 'touch' || (fingerDraws && !penSeen.current))
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // manche Browser erlauben das nicht immer – Zeichnen klappt trotzdem
    }
    if (!draws) {
      live.current = { id: e.pointerId, page: i, scrollY: e.clientY }
      return
    }
    setActivePage(i)
    const [x, y, pr] = pointFor(e, i)
    if (mode === 'eraser') {
      live.current = { id: e.pointerId, page: i, erased: [] }
      eraseAt(i, x, y)
      return
    }
    const stroke: Stroke =
      mode === 'marker' ? { tool: 'marker', color: markerColor, size: markerSize, pts: [x, y, pr] } : { tool: 'pen', color: penColor, size: penSize, pts: [x, y, pr] }
    live.current = { id: e.pointerId, page: i, stroke }
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const l = live.current
    if (!l || l.id !== e.pointerId) return
    if (l.scrollY !== undefined) {
      // Finger scrollt
      scroller.current!.scrollTop -= e.clientY - l.scrollY
      l.scrollY = e.clientY
      return
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    if (l.erased) {
      for (const ev of events) {
        const [x, y] = pointFor(ev, l.page)
        eraseAt(l.page, x, y)
      }
      return
    }
    for (const ev of events) l.stroke!.pts.push(...pointFor(ev, l.page))
    const o = overlays.current[l.page]!
    const ctx = o.getContext('2d')!
    ctx.clearRect(0, 0, o.width, o.height)
    drawStroke(ctx, l.stroke!, scale * dpr)
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    const l = live.current
    if (!l || l.id !== e.pointerId) return
    live.current = null
    if (l.scrollY !== undefined) return
    if (l.erased) {
      if (l.erased.length) {
        undo.current.push({ kind: 'erase', page: l.page, removed: l.erased.sort((a, b) => a.i - b.i) })
        redo.current = []
        dirty.current = true
        bump()
      }
      return
    }
    const stroke = l.stroke!
    docRef.current.pages[l.page].strokes.push(stroke)
    const o = overlays.current[l.page]!
    o.getContext('2d')!.clearRect(0, 0, o.width, o.height)
    drawStroke(canvases.current[l.page]!.getContext('2d')!, stroke, scale * dpr)
    undo.current.push({ kind: 'add', page: l.page, stroke })
    redo.current = []
    dirty.current = true
    bump()
  }

  // ---------- Rückgängig / Wiederholen ----------
  function apply(a: Action, back: boolean) {
    const pages = docRef.current.pages
    if (a.kind === 'add') {
      if (back) pages[a.page].strokes.pop()
      else pages[a.page].strokes.push(a.stroke)
      redraw(a.page)
    } else if (a.kind === 'erase') {
      const s = pages[a.page].strokes
      if (back) for (const r of a.removed) s.splice(r.i, 0, r.stroke)
      else pages[a.page].strokes = s.filter((x) => !a.removed.some((r) => r.stroke === x))
      redraw(a.page)
    } else if (a.kind === 'page') {
      if (back) pages.splice(a.index, 1)
      else pages.splice(a.index, 0, a.page)
    } else {
      pages[a.page].paper = back ? a.from : a.to
      redraw(a.page)
    }
    dirty.current = true
    bump()
  }
  const doUndo = () => {
    const a = undo.current.pop()
    if (!a) return
    apply(a, true)
    redo.current.push(a)
  }
  const doRedo = () => {
    const a = redo.current.pop()
    if (!a) return
    apply(a, false)
    undo.current.push(a)
  }

  function addPage() {
    const last = docRef.current.pages[docRef.current.pages.length - 1]
    const page = emptyPage(last?.bg ? 'liniert' : (last?.paper ?? 'liniert'))
    const index = docRef.current.pages.length
    docRef.current.pages.push(page)
    undo.current.push({ kind: 'page', index, page })
    redo.current = []
    dirty.current = true
    setActivePage(index)
    bump()
    setTimeout(() => canvases.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function setPaper(paper: Paper) {
    const page = docRef.current.pages[activePage]
    if (!page || page.paper === paper) return
    undo.current.push({ kind: 'paper', page: activePage, from: page.paper, to: paper })
    redo.current = []
    page.paper = paper
    dirty.current = true
    redraw(activePage)
    bump()
  }

  async function save() {
    if (!onSave) return
    setBusy(true)
    try {
      await onSave(docRef.current)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (dirty.current && !readOnly && !(await confirmDialog(t('Änderungen an der Handschrift verwerfen?'), { confirm: t('Verwerfen'), danger: true }))) return
    onClose()
  }

  const kind = mode === 'marker' ? 'marker' : 'pen'
  const colors = [...(mode === 'marker' ? MARKER_COLORS : PEN_COLORS), ...custom[kind]]
  const pickColor = (c: string) => (mode === 'marker' ? setMarkerColor(c) : setPenColor(c))

  /** Eigene Farbe aus Palette/Farbrad: benutzen und für später merken (max. 4 je Werkzeug) */
  function addCustom(c: string) {
    pickColor(c)
    if (colors.includes(c)) return
    const next = { ...custom, [kind]: [c, ...custom[kind]].slice(0, 4) }
    setCustom(next)
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next))
    } catch {
      // egal
    }
  }
  const color = mode === 'marker' ? markerColor : penColor
  const sizes = mode === 'marker' ? MARKER_SIZES : PEN_SIZES
  const size = mode === 'marker' ? markerSize : penSize

  return (
    <Sheet
      title={title}
      onClose={cancel}
      onSave={readOnly || !onSave ? undefined : save}
      saveLabel={busy ? t('Speichern …') : t('Sichern')}
      saveDisabled={busy}
      page
      className="ink"
    >
      {!readOnly && (
        <div className="ink-toolbar">
          <div className="ink-group">
            <ToolButton active={mode === 'pen'} label={t('Stift')} onClick={() => setMode('pen')}>
              <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" />
            </ToolButton>
            <ToolButton active={mode === 'marker'} label={t('Textmarker')} onClick={() => setMode('marker')}>
              <path d="M9 15l-4 5h5l2-2M9 15l7.5-10.5a2 2 0 013 2.1L13 16z" />
            </ToolButton>
            <ToolButton active={mode === 'eraser'} label={t('Radierer')} onClick={() => setMode('eraser')}>
              <path d="M8 20h12M5.5 14.5l7-8.5a2 2 0 012.8-.2l3.4 2.8a2 2 0 01.2 2.8L12 20H8.5z" />
            </ToolButton>
          </div>
          {mode !== 'eraser' && (
            <div className="ink-group">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ink-color ${c === color ? 'active' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => pickColor(c)}
                />
              ))}
              <span className="ink-more-colors">
                <ColorPicker value={colors.includes(color) ? '' : color} colors={[]} onChange={addCustom} />
              </span>
              {sizes.map((sz, idx) => (
                <button
                  key={sz}
                  type="button"
                  className={`ink-size ${sz === size ? 'active' : ''}`}
                  aria-label={[t('Fein'), t('Mittel'), t('Dick')][idx]}
                  onClick={() => (mode === 'marker' ? setMarkerSize(sz) : setPenSize(sz))}
                >
                  <i style={{ width: 4 + idx * 4, height: 4 + idx * 4 }} />
                </button>
              ))}
            </div>
          )}
          <div className="ink-group">
            <ToolButton label={t('Rückgängig')} onClick={doUndo} disabled={!undo.current.length}>
              <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />
            </ToolButton>
            <ToolButton label={t('Wiederholen')} onClick={doRedo} disabled={!redo.current.length}>
              <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />
            </ToolButton>
            <ToolButton active={fingerDraws} label={fingerDraws ? t('Finger schreibt') : t('Finger scrollt')} onClick={() => setFingerDraws(!fingerDraws)}>
              <path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V11m0-.5a1.5 1.5 0 013 0v3.5a6 6 0 01-6 6h-1a6 6 0 01-4.6-2.2L5 15.5a1.5 1.5 0 012.3-1.9L8 14.5" />
            </ToolButton>
          </div>
          <div className="ink-group ink-paper">
            <Select
              title={t('Papier (Seite {n})', { n: activePage + 1 })}
              value={doc.pages[activePage]?.paper}
              onChange={(v) => setPaper(v as Paper)}
              options={[
                { value: 'leer', label: t('Leer') },
                { value: 'liniert', label: t('Liniert') },
                { value: 'kariert', label: t('Kariert') },
                { value: 'punkte', label: t('Gepunktet') },
              ]}
            />
            <button type="button" className="link-btn strong" onClick={addPage}>
              + {t('Seite')}
            </button>
          </div>
        </div>
      )}
      <div className="ink-scroller" ref={scroller}>
        {width > 0 &&
          doc.pages.map((page, i) => (
            <div
              key={i}
              className={`ink-page ${i === activePage && !readOnly ? 'active' : ''}`}
              style={{ width, height: page.h * scale }}
              onPointerDown={(e) => onDown(e, i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <canvas
                ref={(el) => {
                  canvases.current[i] = el
                }}
                width={Math.round(width * dpr)}
                height={Math.round(page.h * scale * dpr)}
              />
              <canvas
                className="ink-overlay"
                ref={(el) => {
                  overlays.current[i] = el
                }}
                width={Math.round(width * dpr)}
                height={Math.round(page.h * scale * dpr)}
              />
              <span className="ink-page-no">{i + 1}</span>
            </div>
          ))}
      </div>
    </Sheet>
  )
}

function ToolButton({ active, label, onClick, disabled, children }: { active?: boolean; label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`ink-tool ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}
