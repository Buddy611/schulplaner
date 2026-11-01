import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Segmented } from '../../components/ui'
import { put, useRecord, type Item } from '../../lib/repo'
import { answerMatches, isDue, review, VOCAB, type VocabCard, type VocabSet } from '../../lib/study'
import { t } from '../../lib/i18n'

type Direction = 'fremd' | 'deutsch' | 'mix'
type Mode = 'karte' | 'schreiben'
const PREF = 'schulplaner-vokabel-modus'

function loadPref(): { direction: Direction; mode: Mode } {
  try {
    return { direction: 'fremd', mode: 'karte', ...JSON.parse(localStorage.getItem(PREF) ?? '{}') }
  } catch {
    return { direction: 'fremd', mode: 'karte' }
  }
}

function shuffle<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Abfrage: Karteikarten umdrehen oder Übersetzung eintippen */
export function VocabLearnPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const all = params.get('alle') === '1'
  const set = useRecord<VocabSet>(id)
  const navigate = useNavigate()
  const [pref, setPref] = useState(loadPref)
  const [started, setStarted] = useState(false)

  if (set === undefined) return null
  if (set === null) {
    return (
      <div className="page">
        <PageHeader title={t('Vokabeln')} back={{ to: '/lernen', label: t('Lernen') }} />
        <p className="hint">{t('Dieses Set gibt es nicht mehr.')}</p>
      </div>
    )
  }

  if (!started) {
    const count = all ? set.cards.length : set.cards.filter((c) => isDue(c)).length
    return (
      <div className="page">
        <PageHeader title={set.name} back={{ to: `/lernen/vokabeln/${set.id}`, label: t('Zurück') }} />
        <p className="subtitle">{all ? t('Alle {n} Vokabeln üben', { n: count }) : t('{n} Vokabeln sind fällig', { n: count })}</p>
        <h2 className="section-title">{t('Abfragen')}</h2>
        <div className="list">
          <div className="row stack">
            <Segmented<Direction>
              value={pref.direction}
              onChange={(direction) => setPref({ ...pref, direction })}
              options={[
                { value: 'fremd', label: t('Fremd → Deutsch') },
                { value: 'deutsch', label: t('Deutsch → Fremd') },
                { value: 'mix', label: t('Gemischt') },
              ]}
            />
          </div>
        </div>
        <h2 className="section-title">{t('Art')}</h2>
        <div className="list">
          <div className="row stack">
            <Segmented<Mode>
              value={pref.mode}
              onChange={(mode) => setPref({ ...pref, mode })}
              options={[
                { value: 'karte', label: t('Karteikarten') },
                { value: 'schreiben', label: t('Schreiben') },
              ]}
            />
          </div>
        </div>
        <p className="section-footer">
          {pref.mode === 'karte' ? t('Karte antippen zum Umdrehen, dann selbst bewerten.') : t('Du tippst die Übersetzung ein, die App prüft sie.')}{' '}
          {t('Gewusste Vokabeln kommen nach 1, 2, 4, 7 und 14 Tagen wieder.')}
        </p>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 20 }}
          disabled={!count}
          onClick={() => {
            try {
              localStorage.setItem(PREF, JSON.stringify(pref))
            } catch {
              // egal
            }
            setStarted(true)
          }}
        >
          {t('Los geht’s')}
        </button>
      </div>
    )
  }

  return <Session set={set} all={all} direction={pref.direction} mode={pref.mode} onExit={() => navigate(`/lernen/vokabeln/${set.id}`)} />
}

function Session({ set, all, direction, mode, onExit }: { set: Item<VocabSet>; all: boolean; direction: Direction; mode: Mode; onExit: () => void }) {
  // Reihenfolge einmal beim Start festlegen; bei "Gemischt" pro Karte zufällig
  const initial = useMemo(
    () => shuffle(all ? set.cards : set.cards.filter((c) => isDue(c))).map((c) => ({ id: c.id, reverse: direction === 'deutsch' || (direction === 'mix' && Math.random() < 0.5) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [queue, setQueue] = useState(initial)
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const [stats, setStats] = useState({ right: 0, wrong: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  const item = queue[pos]
  const card = item && set.cards.find((c) => c.id === item.id)
  const question = card ? (item.reverse ? card.back : card.front) : ''
  const solution = card ? (item.reverse ? card.front : card.back) : ''

  useEffect(() => {
    if (mode === 'schreiben') inputRef.current?.focus()
  }, [pos, mode])

  async function answer(knew: boolean) {
    if (!card) return
    const { id, ...data } = set
    const updated: VocabCard = review(card, knew)
    await put<VocabSet>(VOCAB, id, { ...data, cards: data.cards.map((c) => (c.id === card.id ? updated : c)) })
    setStats((s) => (knew ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }))
    // Nicht gewusst: kommt am Ende der Runde noch einmal
    if (!knew) setQueue((q) => [...q, item])
    setPos((p) => p + 1)
    setRevealed(false)
    setInput('')
    setChecked(null)
  }

  if (!card) {
    return (
      <div className="page">
        <PageHeader title={t('Geschafft')} back={{ to: `/lernen/vokabeln/${set.id}`, label: t('Zurück') }} />
        <div className="grade-hero" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="hero-label">{t('Ergebnis')}</div>
          <div className="grade-big">
            {stats.right} / {stats.right + stats.wrong}
          </div>
          <div className="muted">{t('beim ersten Versuch bzw. nach Wiederholung gewusst')}</div>
        </div>
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={onExit}>
          {t('Fertig')}
        </button>
      </div>
    )
  }

  const progress = pos / queue.length

  return (
    <div className="page learn-page">
      <PageHeader title={set.name} back={{ to: `/lernen/vokabeln/${set.id}`, label: t('Beenden') }} />
      <div className="progress learn-progress">
        <div style={{ width: `${progress * 100}%`, background: 'var(--accent)' }} />
      </div>
      <p className="subtitle">
        {pos + 1} von {queue.length} · Box {card.box}
      </p>

      {mode === 'karte' ? (
        <>
          <button type="button" className={`flashcard ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed(true)}>
            <span className="flash-question">{question}</span>
            {revealed ? <span className="flash-answer">{solution}</span> : <span className="muted">{t('Antippen zum Umdrehen')}</span>}
          </button>
          {revealed && (
            <div className="btn-row">
              <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => answer(false)}>
                {t('Nochmal')}
              </button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => answer(true)}>
                {t('Gewusst')}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={`flashcard ${checked === true ? 'right' : checked === false ? 'wrong' : ''}`}>
            <span className="flash-question">{question}</span>
            {checked !== null && <span className="flash-answer">{checked ? t('Richtig!') : solution}</span>}
          </div>
          {checked === null ? (
            <form
              className="inline-add"
              style={{ marginTop: 16 }}
              onSubmit={(e) => {
                e.preventDefault()
                setChecked(answerMatches(input, solution))
              }}
            >
              <input ref={inputRef} className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('Übersetzung')} autoCapitalize="off" autoCorrect="off" />
              <button type="submit" className="btn" style={{ width: 'auto' }}>
                {t('Prüfen')}
              </button>
            </form>
          ) : (
            <div className="btn-row">
              {checked === false && (
                <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => answer(true)}>
                  {t('War doch richtig')}
                </button>
              )}
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => answer(checked)}>
                {t('Weiter')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
