import { useNavigate, useSearchParams } from 'react-router-dom'
import { promptDialog } from '../../components/dialogs'
import { PageHeader } from '../../components/PageHeader'
import { ColorDot, LinkRow, Segmented } from '../../components/ui'
import { useLookups } from '../../lib/models'
import { newId, put } from '../../lib/repo'
import { isDue, STUDY_SHEETS, useStudySheets, useVocabSets, VOCAB, type StudySheet, type VocabSet } from '../../lib/study'

type Tab = 'vokabeln' | 'zettel'

/** Lernen: Vokabelsets und Lernzettel */
export function StudyPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'vokabeln'
  const sets = useVocabSets()
  const sheets = useStudySheets()
  const { subjectMap } = useLookups()
  const navigate = useNavigate()

  async function add() {
    if (tab === 'vokabeln') {
      const name = await promptDialog('Neues Vokabelset', { placeholder: 'z. B. Englisch Unit 4', confirm: 'Anlegen' })
      if (!name) return
      const id = newId()
      await put<VocabSet>(VOCAB, id, { name, cards: [], createdAt: Date.now() })
      navigate(`/lernen/vokabeln/${id}`)
    } else {
      const id = newId()
      await put<StudySheet>(STUDY_SHEETS, id, { title: 'Neuer Lernzettel', content: '', attachments: [], createdAt: Date.now(), updatedAt: Date.now() })
      navigate(`/lernen/zettel/${id}?bearbeiten=1`)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Lernen" back={{ to: '/', label: 'Heute' }}>
        <button type="button" className="icon-btn" aria-label="Hinzufügen" onClick={add}>
          +
        </button>
      </PageHeader>

      <div className="list" style={{ marginBottom: 16 }}>
        <LinkRow to="/lernen/timer" icon="clock" tone="red" sub="25 Minuten lernen, 5 Minuten Pause – mit Statistik pro Fach">
          Lern-Timer
        </LinkRow>
      </div>

      <div className="toolbar">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => setParams({ tab: t }, { replace: true })}
          options={[
            { value: 'vokabeln', label: 'Vokabeln' },
            { value: 'zettel', label: 'Lernzettel' },
          ]}
        />
      </div>

      {tab === 'vokabeln' && sets && (
        <>
          {sets.length === 0 && <p className="hint">Noch keine Vokabeln. Tippe auf +, um ein Set anzulegen.</p>}
          <div className="list">
            {[...sets]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((s) => {
                const due = s.cards.filter((c) => isDue(c)).length
                const learned = s.cards.filter((c) => c.box >= 4).length
                const subject = s.subjectId ? subjectMap.get(s.subjectId) : undefined
                return (
                  <button key={s.id} type="button" className="row" onClick={() => navigate(`/lernen/vokabeln/${s.id}`)}>
                    <ColorDot color={subject?.color ?? 'var(--outline)'} size={14} />
                    <span className="label">
                      {s.name}
                      <span className="sub">
                        {s.cards.length} Vokabeln · {learned} sicher{subject ? ` · ${subject.name}` : ''}
                      </span>
                    </span>
                    {due > 0 && <span className="badge accent">{due} fällig</span>}
                  </button>
                )
              })}
          </div>
        </>
      )}

      {tab === 'zettel' && sheets && (
        <>
          {sheets.length === 0 && <p className="hint">Noch keine Lernzettel. Tippe auf +, um einen zu schreiben.</p>}
          <div className="list">
            {[...sheets]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((s) => {
                const subject = s.subjectId ? subjectMap.get(s.subjectId) : undefined
                const preview = s.content.replace(/[#*>\-[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90)
                return (
                  <button key={s.id} type="button" className="row" onClick={() => navigate(`/lernen/zettel/${s.id}`)}>
                    <ColorDot color={subject?.color ?? 'var(--outline)'} size={14} />
                    <span className="label">
                      {s.title}
                      <span className="sub">{[subject?.name, preview].filter(Boolean).join(' · ') || 'Leer'}</span>
                    </span>
                  </button>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}
