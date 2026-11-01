import type { Language, LanguagePref } from './i18n'
import type { LayoutItem } from './layout'
import { put, useRecord } from './repo'

export type ThemeMode = 'system' | 'light' | 'dark'
export type TextSize = 'small' | 'normal' | 'large' | 'xlarge'
export type Corners = 'square' | 'normal' | 'round'

export interface Settings {
  theme: ThemeMode
  /** Akzentfarbe für Buttons, Markierungen usw. (Hex) */
  accent: string
  textSize: TextSize
  /** Sprache der App (automatisch = Sprache des Geräts) */
  language?: LanguagePref
  /** Sprache der Push-Erinnerungen (der Server kennt die Gerätesprache nicht) */
  notifyLang?: Language
  corners: Corners
  /** Bundesland-Kürzel für Ferien/Feiertage (ISO 3166-2 ohne "DE-"), leer = noch nicht gewählt */
  state: string
  /** Land für Ferien (ISO-Code, fehlt = Deutschland) */
  country?: string
  /** Anzeigename der gewählten Region (für Länder außer Deutschland) */
  regionName?: string
  activeTimetableId?: string
  /** Arten von Leistungsüberprüfungen (erweiterbar) */
  examTypes: string[]
  /** Noten 1–6 (mit +/-) oder Punkte 0–15 */
  gradeSystem: 'noten' | 'punkte'
  /** Wert von + und -: Drittel (2+ = 1,67), Viertel (1,75) oder Halbe (1,5) */
  tendency: 'third' | 'quarter' | 'half'
  /** Eine Notenbesprechung zählt so viel wie N einzelne mündliche Noten danach */
  besprechungWeight: number
  /** Standard-Anteil schriftlich in Prozent für Hauptfächer (pro Fach änderbar) */
  writtenWeight: number
  /** Anteil schriftlich in % für Nebenfächer (fehlt → wie Hauptfächer) */
  writtenWeightNeben?: number
  /** Gewicht je Klausurtyp, z. B. Test zählt halb */
  typeWeights: Record<string, number>
  /** Zählt der Typ schriftlich oder mündlich? (z. B. Test → mündlich) */
  typeCategory: Record<string, 'schriftlich' | 'muendlich'>
  /** Halbjahre automatisch aus den Ferien ermitteln (sonst die beiden Daten unten) */
  halfYearAuto: boolean
  /** Beginn des Schuljahres und des 2. Halbjahres (MM-TT) */
  schoolYearStart: string
  secondHalfStart: string
  /** Anpassbares Layout: Abschnitte auf "Heute" und Einträge der Navigation */
  todayLayout?: LayoutItem[]
  navLayout?: LayoutItem[]
  /** Erinnerungen per Push (werden von der Edge Function gelesen) */
  notifications: {
    enabled: boolean
    /** Uhrzeit am Vortag bzw. an den Erinnerungstagen */
    time: string
    homework: boolean
    /** Tage vor einer Klausur, an denen erinnert wird */
    examDays: number[]
    /** an offene Entschuldigungen erinnern */
    excuses?: boolean
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#4285f4',
  textSize: 'normal',
  corners: 'normal',
  // Absichtlich kein Standard – das Bundesland wählst du selbst in den Einstellungen
  state: '',
  examTypes: ['Klausur', 'Test', 'Sprechprüfung'],
  gradeSystem: 'noten',
  tendency: 'third',
  besprechungWeight: 3,
  writtenWeight: 50,
  typeWeights: { Klausur: 1, Test: 1, Sprechprüfung: 1 },
  typeCategory: { Klausur: 'schriftlich', Test: 'muendlich', Sprechprüfung: 'schriftlich' },
  halfYearAuto: true,
  schoolYearStart: '08-01',
  secondHalfStart: '02-01',
  notifications: { enabled: false, time: '18:00', homework: true, examDays: [7, 3, 1], excuses: true },
}

/** Grundfarben für das Material-You-Farbschema – zusätzlich ist jede beliebige Farbe wählbar. */
export const ACCENT_PRESETS = [
  { name: 'Blau', value: '#4285f4' },
  { name: 'Türkis', value: '#00897b' },
  { name: 'Grün', value: '#34a853' },
  { name: 'Gelb', value: '#fbbc04' },
  { name: 'Orange', value: '#f57c00' },
  { name: 'Rot', value: '#ea4335' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Lila', value: '#9c27b0' },
  { name: 'Violett', value: '#673ab7' },
  { name: 'Grau', value: '#607d8b' },
]

/** Bundesländer (Kürzel wie in ISO 3166-2, für die Ferien-Abfrage) */
export const STATES = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
]

export const DEFAULT_EXAM_TYPES = ['Klausur', 'Test', 'Sprechprüfung']

const SETTINGS_ID = 'settings'

/** Einstellungen werden wie alle anderen Daten zwischen den Geräten synchronisiert. */
export function useSettings(): Settings {
  const rec = useRecord<Partial<Settings>>(SETTINGS_ID)
  return { ...DEFAULT_SETTINGS, ...(rec ?? {}) }
}

export async function updateSettings(current: Settings, changes: Partial<Settings>) {
  await put<Settings>('settings', SETTINGS_ID, { ...current, ...changes })
}
