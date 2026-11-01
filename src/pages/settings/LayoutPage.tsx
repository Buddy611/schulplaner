import { Icon } from '../../components/Icons'
import { PageHeader } from '../../components/PageHeader'
import { ResetButton, Switch } from '../../components/ui'
import { DEFAULT_NAV_LAYOUT, DEFAULT_TODAY_LAYOUT, isSeparator, NAV_ITEMS, newSeparator, resolveLayout, TODAY_SECTIONS, type LayoutItem } from '../../lib/layout'
import { updateSettings, useSettings } from '../../lib/settings'
import { t } from '../../lib/i18n'

/** Startseite und Navigation anpassen: Reihenfolge ändern, Einträge ein- und ausblenden */
export function LayoutPage() {
  const settings = useSettings()
  const today = resolveLayout(settings.todayLayout, DEFAULT_TODAY_LAYOUT)
  const nav = resolveLayout(settings.navLayout, DEFAULT_NAV_LAYOUT)
  const visibleNav = nav.filter((n) => n.visible && !isSeparator(n.id))

  return (
    <div className="page">
      <PageHeader title={t('Startseite & Navigation')} back={{ to: '/einstellungen', label: t('Einstellungen') }} />

      <h2 className="section-title">{t('Startseite „Heute“')}</h2>
      <LayoutList
        items={today}
        meta={(id) => {
          const s = TODAY_SECTIONS.find((x) => x.id === id)!
          return { label: s.label, sub: s.sub }
        }}
        onChange={(todayLayout) => updateSettings(settings, { todayLayout })}
      />
      <p className="section-footer">{t('Mit den Pfeilen änderst du die Reihenfolge, mit dem Schalter blendest du einen Abschnitt aus.')}</p>

      <h2 className="section-title">{t('Navigation')}</h2>
      <LayoutList
        items={nav}
        meta={(id) => {
          if (isSeparator(id)) return { label: t('Trennstrich'), separator: true }
          const n = NAV_ITEMS.find((x) => x.id === id)!
          const pos = visibleNav.findIndex((v) => v.id === id)
          return {
            label: n.label,
            icon: n.icon,
            sub: pos < 0 ? t('Ausgeblendet') : pos < 5 ? t('Leiste unten (Handy) und Seitenleiste') : t('Nur in der Seitenleiste (iPad) und unter „Mehr“'),
          }
        }}
        minVisible={1}
        onChange={(navLayout) => updateSettings(settings, { navLayout })}
      />
      <div className="list" style={{ marginTop: 8 }}>
        <button type="button" className="row action" onClick={() => updateSettings(settings, { navLayout: [...nav, newSeparator()] })}>
          + {t('Trennstrich hinzufügen')}
        </button>
      </div>
      <p className="section-footer">
        {t('Auf dem Handy zeigt die Leiste unten die ersten 5 sichtbaren Einträge. Auf dem iPad stehen alle sichtbaren Einträge in der Seitenleiste – Trennstriche teilen sie dort in Gruppen. Ein Strich ganz unten steht vor den Einstellungen, die du immer über das Zahnrad erreichst.')}
      </p>

      <ResetButton what={t('Startseite und Navigation')} onReset={() => updateSettings(settings, { todayLayout: undefined, navLayout: undefined })} />
    </div>
  )
}

function LayoutList({
  items,
  meta,
  onChange,
  minVisible = 0,
}: {
  items: LayoutItem[]
  meta: (id: string) => { label: string; sub?: string; icon?: Parameters<typeof Icon>[0]['name']; separator?: boolean }
  onChange: (items: LayoutItem[]) => void
  minVisible?: number
}) {
  function move(i: number, dir: -1 | 1) {
    const next = [...items]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const visibleCount = items.filter((x) => x.visible && !isSeparator(x.id)).length

  return (
    <div className="list">
      {items.map((item, i) => {
        const m = meta(item.id)
        return (
          <div key={item.id} className="row layout-row" style={item.visible ? undefined : { opacity: 0.55 }}>
            {m.icon && (
              <span className="layout-icon">
                <Icon name={m.icon} />
              </span>
            )}
            {m.separator ? (
              <span className="layout-sep">{m.label}</span>
            ) : (
              <span className="label">
                {m.label}
                {m.sub && <span className="sub">{m.sub}</span>}
              </span>
            )}
            <span className="layout-arrows">
              <button type="button" className="arrow-btn" aria-label={t('Nach oben')} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="arrow-btn" aria-label={t('Nach unten')} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
            </span>
            {m.separator ? (
              <button type="button" className="arrow-btn" aria-label={t('Trennstrich entfernen')} onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
                ✕
              </button>
            ) : (
              <Switch
                checked={item.visible}
                onChange={(visible) => {
                  if (!visible && visibleCount <= minVisible) return
                  onChange(items.map((x) => (x.id === item.id ? { ...x, visible } : x)))
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
