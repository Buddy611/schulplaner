/** Einfache Symbole im Stil von Material Symbols (gefüllt, 24 px) */
const paths = {
  calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10ZM7 12h5v5H7z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.6 3.5 2.1-.8 1.3L11 13V7h2v5.6Z',
  book: 'M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM6 4h5v8l-2.5-1.5L6 12V4Z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z',
  door: 'M19 19V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v15H3v2h18v-2h-2Zm-4-6h-2v-2h2v2Z',
  exam: 'M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3ZM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7Z',
  grade: 'M5 13.2v4L12 21l7-3.8v-4L12 17l-7-3.8ZM12 3 1 9l11 6 9-4.9V17h2V9L12 3Z',
  tune: 'M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM2 13h2v-2H2v2Zm18 0h2v-2h-2v2ZM11 2v2h2V2h-2Zm0 18v2h2v-2h-2ZM6 5 4.6 3.6 3.6 4.6 5 6l1-1Zm13.4 13.4L18 17l-1 1 1.4 1.4 1-1ZM19.4 4.6l-1-1L17 5l1 1 1.4-1.4ZM5 17l-1.4 1.4 1 1L6 18l-1-1Z',
  bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6v-5c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 0 0-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2Z',
  palette: 'M12 2a10 10 0 0 0 0 20 1.7 1.7 0 0 0 1.2-2.8 1.7 1.7 0 0 1 1.3-2.7h2A5.5 5.5 0 0 0 22 11c0-5-4.5-9-10-9ZM6.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  cloud: 'M19.4 10A7.5 7.5 0 0 0 5.4 8 6 6 0 0 0 6 20h13a5 5 0 0 0 .4-10Z',
  absence: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-2 10H7v-2h10v2Z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3ZM21 9l-3.99-4v3H10v2h7.01v3L21 9Z',
  list: 'M3 13h2v-2H3v2Zm0 4h2v-2H3v2Zm0-8h2V7H3v2Zm4 4h14v-2H7v2Zm0 4h14v-2H7v2ZM7 7v2h14V7H7Z',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

/** Farbtöne für die runden Symbol-Hintergründe (wie in den Android-Einstellungen) */
export const TONES = {
  blue: '#1a73e8',
  cyan: '#12b5cb',
  green: '#1e8e3e',
  yellow: '#f9ab00',
  orange: '#e8710a',
  red: '#d93025',
  pink: '#d01884',
  purple: '#9334e6',
  gray: '#5f6368',
} as const

export type Tone = keyof typeof TONES

export function IconBubble({ name, tone }: { name: IconName; tone: Tone }) {
  return (
    <span className="icon-bubble" style={{ ['--tone' as string]: TONES[tone] }}>
      <Icon name={name} />
    </span>
  )
}
