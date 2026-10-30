import { addDays, toISODate } from './dates'
import type { Attachment } from './files'
import { useCollection } from './repo'

// ---------- Vokabeln ----------

export const VOCAB = 'vocabSets'

/** Eine Vokabelkarte im Karteikasten (Box 1–5) */
export interface VocabCard {
  id: string
  /** Fremdsprache */
  front: string
  /** Deutsch */
  back: string
  box: number
  /** nächste Abfrage (YYYY-MM-DD) */
  due: string
  correct: number
  wrong: number
}

export interface VocabSet {
  name: string
  subjectId?: string
  cards: VocabCard[]
  createdAt: number
}

export function useVocabSets() {
  return useCollection<VocabSet>(VOCAB)
}

/** Abstände im Karteikasten: Box 1 → morgen, Box 2 → in 2 Tagen … Box 5 → in 14 Tagen */
const INTERVALS = [0, 1, 2, 4, 7, 14]

export function newCard(front: string, back: string): VocabCard {
  return { id: crypto.randomUUID(), front, back, box: 1, due: toISODate(new Date()), correct: 0, wrong: 0 }
}

export function isDue(c: VocabCard, today = toISODate(new Date())) {
  return c.due <= today
}

/** Ergebnis einer Abfrage verbuchen */
export function review(c: VocabCard, knew: boolean): VocabCard {
  if (!knew) return { ...c, box: 1, due: toISODate(new Date()), wrong: c.wrong + 1 }
  const box = Math.min(5, c.box + 1)
  return { ...c, box, due: toISODate(addDays(new Date(), INTERVALS[box])), correct: c.correct + 1 }
}

/**
 * Liste einfügen: eine Vokabel pro Zeile, getrennt durch Tab, " - ", " – ", " = ", ";" oder ":".
 * Links Fremdsprache, rechts Deutsch.
 */
export function parseVocabList(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/\t| [-–=] |;|:(?=\s)/)
    if (parts.length < 2) continue
    const front = parts[0].trim()
    const back = parts.slice(1).join(', ').trim()
    if (front && back) out.push({ front, back })
  }
  return out
}

/** Eingabe beim Schreib-Modus prüfen (ohne Groß/Klein, Satzzeichen; mehrere erlaubte Antworten mit Komma/Slash) */
export function answerMatches(input: string, solution: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/[.!?¿¡"']/g, '')
      .replace(/^(to|the|a|an|der|die|das|ein|eine|le|la|les|un|une|el|los|las) /, '')
      .replace(/\s+/g, ' ')
      .trim()
  const given = norm(input)
  if (!given) return false
  return solution.split(/[,/;]/).some((s) => norm(s) === given)
}

// ---------- Lernzettel ----------

export const STUDY_SHEETS = 'studySheets'

export interface StudySheet {
  title: string
  subjectId?: string
  examId?: string
  /** Text mit einfacher Formatierung (# Überschrift, - Liste, **fett**, - [ ] Aufgabe) */
  content: string
  attachments: Attachment[]
  createdAt: number
  updatedAt: number
}

export function useStudySheets() {
  return useCollection<StudySheet>(STUDY_SHEETS)
}
