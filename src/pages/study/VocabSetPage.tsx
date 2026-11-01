import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { confirmDialog, promptDialog } from '../../components/dialogs'
import { PageHeader } from '../../components/PageHeader'
import { Field, Sheet } from '../../components/ui'
import { put, remove, useRecord } from '../../lib/repo'
import { isDue, newCard, parseVocabList, VOCAB, type VocabCard, type VocabSet } from '../../lib/study'
import { SubjectSelect } from '../../components/SubjectSelect'
import { t } from '../../lib/i18n'

/** Ein Vokabelset: Wörter verwalten und Lernen starten */
export function VocabSetPage() {
  const { id } = useParams()
  const set = useRecord<VocabSet>(id)
  const navigate = useNavigate()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editing, setEditing] = useState<VocabCard | null>(null)
  const [importing, setImporting] = useState(false)

  if (set === undefined) return null
  if (set === null) {
    return (
      <div className="page">
        <PageHeader title={t('Vokabeln')} back={{ to: '/lernen', label: t('Lernen') }} />
        <p className="hint">{t('Dieses Set gibt es nicht mehr.')}</p>
      </div>
    )
  }

  const save = (changes: Partial<VocabSet>) => {
    const { id: setId, ...data } = set
    return put<VocabSet>(VOCAB, setId, { ...data, ...changes })
  }
  const due = set.cards.filter((c) => isDue(c)).length
  const boxes = [1, 2, 3, 4, 5].map((b) => set.cards.filter((c) => c.box === b).length)

  async function addCard() {
    if (!front.trim() || !back.trim()) return
    await save({ cards: [...set!.cards, newCard(front.trim(), back.trim())] })
    setFront('')
    setBack('')
    document.getElementById('vocab-front')?.focus()
  }

  async function rename() {
    const name = await promptDialog(t('Set umbenennen'), { initial: set!.name })
    if (name) await save({ name })
  }

  async function del() {
    if (await confirmDialog(t('„{name}“ mit allen Vokabeln löschen?', { name: set!.name }), { confirm: t('Löschen'), danger: true })) {
      await remove(set!.id)
      navigate('/lernen')
    }
  }

  return (
    <div className="page">
      <PageHeader title={set.name} back={{ to: '/lernen', label: t('Lernen') }}>
        <button type="button" className="link-btn" onClick={rename}>
          {t('Umbenennen')}
        </button>
      </PageHeader>

      <div className="grade-hero">
        <div>
          <div className="hero-label">{t('Heute fällig')}</div>
          <div className="grade-big">{due}</div>
          <div className="muted" style={{ fontSize: '0.875rem' }}>
            {t('von {n} Vokabeln', { n: set.cards.length })}
          </div>
        </div>
        <div className="boxes" aria-label={t('Karteikasten')}>
          {boxes.map((n, i) => (
            <div key={i} className="box-col" title={t('Box {n}', { n: i + 1 })}>
              <div className="box-bar" style={{ height: `${set.cards.length ? Math.max(4, (n / set.cards.length) * 64) : 4}px` }} />
              <span>{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" style={{ flex: 1 }} disabled={!due} onClick={() => navigate(`/lernen/vokabeln/${set.id}/lernen`)}>
          {t('Lernen')}{due ? ` (${due})` : ''}
        </button>
        <button type="button" className="btn secondary" style={{ flex: 1 }} disabled={!set.cards.length} onClick={() => navigate(`/lernen/vokabeln/${set.id}/lernen?alle=1`)}>
          {t('Alle üben')}
        </button>
      </div>

      <h2 className="section-title">{t('Neue Vokabel')}</h2>
      <div className="list">
        <Field label={t('Fremdsprache')}>
          <input id="vocab-front" className="row-input" value={front} onChange={(e) => setFront(e.target.value)} placeholder={t('z. B. marriage')} />
        </Field>
        <Field label={t('Deutsch|Vokabel')}>
          <input
            className="row-input"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addCard()}
            placeholder={t('z. B. Ehe, Heirat')}
          />
        </Field>
        <button type="button" className="row action" onClick={addCard} disabled={!front.trim() || !back.trim()}>
          {t('Hinzufügen')}
        </button>
        <button type="button" className="row action" onClick={() => setImporting(true)}>
          {t('Liste einfügen …')}
        </button>
      </div>

      <h2 className="section-title">{t('Einstellungen')}</h2>
      <div className="list">
        <Field label={t('Fach')}>
          <SubjectSelect value={set.subjectId} onChange={(subjectId) => save({ subjectId })} emptyLabel={t('Kein Fach')} />
        </Field>
      </div>

      {set.cards.length > 0 && (
        <>
          <h2 className="section-title">{t('{n} Vokabeln', { n: set.cards.length })}</h2>
          <div className="list">
            {[...set.cards].reverse().map((c) => (
              <button key={c.id} type="button" className="row" onClick={() => setEditing(c)}>
                <span className="label">
                  {c.front}
                  <span className="sub">{c.back}</span>
                </span>
                <span className="badge">{t('Box {n}', { n: c.box })}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="list" style={{ marginTop: 24 }}>
        <button type="button" className="row danger" onClick={del}>
          {t('Set löschen')}
        </button>
      </div>

      {editing && (
        <CardSheet
          card={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => save({ cards: set.cards.map((x) => (x.id === c.id ? c : x)) })}
          onDelete={() => save({ cards: set.cards.filter((x) => x.id !== editing.id) })}
        />
      )}
      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onImport={(list) => save({ cards: [...set.cards, ...list.map((v) => newCard(v.front, v.back))] })}
        />
      )}
    </div>
  )
}

function CardSheet({
  card,
  onClose,
  onSave,
  onDelete,
}: {
  card: VocabCard
  onClose: () => void
  onSave: (c: VocabCard) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  return (
    <Sheet
      title={t('Vokabel')}
      onClose={onClose}
      saveLabel={t('Sichern')}
      saveDisabled={!front.trim() || !back.trim()}
      onSave={async () => {
        await onSave({ ...card, front: front.trim(), back: back.trim() })
        onClose()
      }}
    >
      <div className="list">
        <Field label={t('Fremdsprache')}>
          <input className="row-input" value={front} onChange={(e) => setFront(e.target.value)} />
        </Field>
        <Field label={t('Deutsch|Vokabel')}>
          <input className="row-input" value={back} onChange={(e) => setBack(e.target.value)} />
        </Field>
      </div>
      <p className="section-footer">
        {t('Box {n} · {right}× gewusst · {wrong}× nicht gewusst', { n: card.box, right: card.correct, wrong: card.wrong })}
      </p>
      <div className="list" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="row action"
          onClick={async () => {
            await onSave({ ...card, box: 1, due: new Date().toISOString().slice(0, 10) })
            onClose()
          }}
        >
          {t('Wieder ganz von vorn lernen')}
        </button>
        <button
          type="button"
          className="row danger"
          onClick={async () => {
            await onDelete()
            onClose()
          }}
        >
          {t('Vokabel löschen')}
        </button>
      </div>
    </Sheet>
  )
}

function ImportSheet({ onClose, onImport }: { onClose: () => void; onImport: (list: { front: string; back: string }[]) => Promise<void> }) {
  const [text, setText] = useState('')
  const parsed = parseVocabList(text)
  return (
    <Sheet
      title={t('Liste einfügen')}
      onClose={onClose}
      saveLabel={parsed.length ? t('{n} übernehmen', { n: parsed.length }) : t('Übernehmen')}
      saveDisabled={!parsed.length}
      onSave={async () => {
        await onImport(parsed)
        onClose()
      }}
    >
      <div className="list">
        <div className="row stack">
          <textarea
            className="row-input"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'marriage - Ehe, Heirat\ngender - Geschlecht\nto get married - heiraten'}
            autoFocus
          />
        </div>
      </div>
      <p className="section-footer">
        {t('Eine Vokabel pro Zeile: Fremdsprache, dann „ - “, „ = “, „;“ oder ein Tab, dann Deutsch. Du kannst z. B. eine Tabelle aus Word oder Excel einfügen.')}
      </p>
      {parsed.length > 0 && (
        <div className="list" style={{ marginTop: 12 }}>
          {parsed.slice(0, 5).map((v, i) => (
            <div key={i} className="row">
              <span className="label">
                {v.front}
                <span className="sub">{v.back}</span>
              </span>
            </div>
          ))}
          {parsed.length > 5 && <div className="row muted">{t('… und {n} weitere', { n: parsed.length - 5 })}</div>}
        </div>
      )}
    </Sheet>
  )
}
