/**
 * Handschrift (wie in GoodNotes): Seiten mit Papier (leer, liniert, kariert, gepunktet),
 * optional einem Hintergrundbild (Foto oder PDF-Seite) und Strichen von Stift oder Textmarker.
 * Gespeichert als kleine JSON-Datei – wie ein Foto als Anhang, also mit Abgleich über alle Geräte.
 */

export const INK_TYPE = 'application/x-schulplaner-ink'
export const INK_EXT = '.ink'

/** Logische Seitenbreite – Striche werden in diesen Einheiten gespeichert (unabhängig von der Bildschirmgröße) */
export const PAGE_W = 1000
/** DIN-A4-Verhältnis */
export const PAGE_H = Math.round(PAGE_W * Math.SQRT2)

export type Paper = 'leer' | 'liniert' | 'kariert' | 'punkte'
export type Tool = 'pen' | 'marker'

export interface Stroke {
  tool: Tool
  color: string
  /** Grundbreite in logischen Einheiten */
  size: number
  /** flach: x, y, Druck (0–1), x, y, Druck, … */
  pts: number[]
}

export interface InkPage {
  paper: Paper
  /** Höhe in logischen Einheiten (bei Fotos passend zum Bild) */
  h: number
  /** Hintergrundbild als data:-URL (Foto oder gerenderte PDF-Seite) */
  bg?: string
  strokes: Stroke[]
}

export interface InkDoc {
  v: 1
  pages: InkPage[]
}

export const emptyPage = (paper: Paper = 'liniert'): InkPage => ({ paper, h: PAGE_H, strokes: [] })
export const emptyDoc = (paper: Paper = 'liniert'): InkDoc => ({ v: 1, pages: [emptyPage(paper)] })

export function isInk(a: { type: string; name: string }) {
  return a.type === INK_TYPE || a.name.endsWith(INK_EXT)
}

export async function parseInk(blob: Blob): Promise<InkDoc> {
  const doc = JSON.parse(await blob.text()) as InkDoc
  if (!doc || !Array.isArray(doc.pages)) throw new Error('Keine Handschrift')
  return doc
}

/** Datei zum Speichern – Punkte auf eine Nachkommastelle gerundet, damit sie klein bleibt */
export function inkFile(doc: InkDoc, name = 'Handschrift'): File {
  const slim: InkDoc = {
    v: 1,
    pages: doc.pages.map((p) => ({ ...p, strokes: p.strokes.map((s) => ({ ...s, pts: s.pts.map((n) => Math.round(n * 10) / 10) })) })),
  }
  return new File([JSON.stringify(slim)], name + INK_EXT, { type: INK_TYPE })
}

// ---------- Zeichnen ----------

const LINE_GAP = 40
const PAPER_LINE = 'rgba(70, 110, 170, 0.28)'
const PAPER_DOT = 'rgba(70, 90, 120, 0.45)'

export function drawPaper(ctx: CanvasRenderingContext2D, page: InkPage, scale: number) {
  const w = PAGE_W * scale
  const h = page.h * scale
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  const gap = LINE_GAP * scale
  ctx.lineWidth = Math.max(1, scale * 1.2)
  if (page.paper === 'liniert') {
    ctx.strokeStyle = PAPER_LINE
    ctx.beginPath()
    for (let y = gap * 3; y < h - gap; y += gap) {
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
    }
    ctx.stroke()
  } else if (page.paper === 'kariert') {
    const g = gap * 0.625
    ctx.strokeStyle = PAPER_LINE
    ctx.beginPath()
    for (let y = g; y < h; y += g) {
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
    }
    for (let x = g; x < w; x += g) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    ctx.stroke()
  } else if (page.paper === 'punkte') {
    const g = gap * 0.75
    ctx.fillStyle = PAPER_DOT
    const r = Math.max(1, scale * 1.8)
    for (let y = g; y < h; y += g) for (let x = g; x < w; x += g) ctx.fillRect(x - r / 2, y - r / 2, r, r)
  }
}

/** Breite eines Stiftpunkts: etwas dünner bei wenig Druck, etwas dicker bei viel */
const penWidth = (size: number, pressure: number) => size * (0.55 + 0.9 * (pressure || 0.5))

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const p = s.pts
  if (p.length < 3) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = s.color
  if (s.tool === 'marker') {
    // Textmarker: ein Pfad mit fester Breite, halb durchsichtig (kein Nachdunkeln an Überlappungen)
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.lineWidth = s.size * scale
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(p[0] * scale, p[1] * scale)
    for (let i = 3; i < p.length; i += 3) ctx.lineTo(p[i] * scale, p[i + 1] * scale)
    if (p.length === 3) ctx.lineTo(p[0] * scale + 0.1, p[1] * scale)
    ctx.stroke()
    ctx.restore()
    return
  }
  if (p.length === 3) {
    ctx.fillStyle = s.color
    ctx.beginPath()
    ctx.arc(p[0] * scale, p[1] * scale, (penWidth(s.size, p[2]) * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  // Stift: Abschnittsweise mit geglätteten Kurven durch die Mittelpunkte
  for (let i = 3; i < p.length; i += 3) {
    const x0 = i >= 6 ? (p[i - 6] + p[i - 3]) / 2 : p[i - 3]
    const y0 = i >= 6 ? (p[i - 5] + p[i - 2]) / 2 : p[i - 2]
    const x1 = (p[i - 3] + p[i]) / 2
    const y1 = (p[i - 2] + p[i + 1]) / 2
    ctx.lineWidth = penWidth(s.size, p[i + 2]) * scale
    ctx.beginPath()
    ctx.moveTo(x0 * scale, y0 * scale)
    ctx.quadraticCurveTo(p[i - 3] * scale, p[i - 2] * scale, x1 * scale, y1 * scale)
    ctx.stroke()
  }
  // letztes Stück bis zum Endpunkt
  const n = p.length
  ctx.lineWidth = penWidth(s.size, p[n - 1]) * scale
  ctx.beginPath()
  ctx.moveTo(((p[n - 6] + p[n - 3]) / 2) * scale, ((p[n - 5] + p[n - 2]) / 2) * scale)
  ctx.lineTo(p[n - 3] * scale, p[n - 2] * scale)
  ctx.stroke()
}

/** Bilder für Hintergründe einmal laden und merken */
const imageCache = new Map<string, Promise<HTMLImageElement>>()
export function loadImage(src: string) {
  let img = imageCache.get(src)
  if (!img) {
    img = new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = src
    })
    imageCache.set(src, img)
  }
  return img
}

/** Ganze Seite zeichnen: Papier, Hintergrundbild, alle Striche */
export async function renderPage(ctx: CanvasRenderingContext2D, page: InkPage, scale: number) {
  const bg = page.bg ? await loadImage(page.bg).catch(() => null) : null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawPaper(ctx, page, scale)
  if (bg) ctx.drawImage(bg, 0, 0, PAGE_W * scale, page.h * scale)
  for (const s of page.strokes) drawStroke(ctx, s, scale)
}

/** Berührt der Radierer (Punkt x/y, Radius r) diesen Strich? */
export function hitStroke(s: Stroke, x: number, y: number, r: number) {
  const p = s.pts
  const rr = r + s.size / 2
  for (let i = 0; i < p.length; i += 3) {
    const ax = p[i]
    const ay = p[i + 1]
    if (i + 3 >= p.length) {
      if ((ax - x) ** 2 + (ay - y) ** 2 <= rr * rr) return true
      continue
    }
    // Abstand Punkt–Strecke
    const bx = p[i + 3]
    const by = p[i + 4]
    const dx = bx - ax
    const dy = by - ay
    const len = dx * dx + dy * dy
    const tt = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
    const cx = ax + tt * dx
    const cy = ay + tt * dy
    if ((cx - x) ** 2 + (cy - y) ** 2 <= rr * rr) return true
  }
  return false
}

// ---------- Fotos & PDFs als Hintergrund ----------

const BG_MAX = 1600

/** Bild (Blob) als Seite mit passendem Seitenverhältnis */
export async function imagePage(blob: Blob): Promise<InkPage> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, BG_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const h = Math.round((PAGE_W * bitmap.height) / bitmap.width)
  bitmap.close()
  return { paper: 'leer', h, bg: canvas.toDataURL('image/jpeg', 0.82), strokes: [] }
}

/** PDF-Seiten als Bilder (pdf.js wird erst hier geladen, damit die App schnell startet) */
export async function pdfPages(blob: Blob, maxPages = 30): Promise<InkPage[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
  const pdf = await task.promise
  const pages: InkPage[] = []
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const page = await pdf.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: BG_MAX / Math.max(base.width, base.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    pages.push({ paper: 'leer', h: Math.round((PAGE_W * viewport.height) / viewport.width), bg: canvas.toDataURL('image/jpeg', 0.82), strokes: [] })
  }
  await task.destroy()
  return pages
}
