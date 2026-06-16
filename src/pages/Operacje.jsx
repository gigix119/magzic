import { useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import { useAlertCount } from '../context/AlertCountContext'
import PrzygotowaniaTab from './operacje/PrzygotowaniaTab'
import AlertyTab from './operacje/AlertyTab'
import PakietyTab from './operacje/PakietyTab'
import NaprawyTab from './operacje/NaprawyTab'
import RezerwacjeTab from './operacje/RezerwacjeTab'
import CoZabracTab from './operacje/CoZabracTab'

const CLEANING_CATEGORIES = ['cleaning_facility', 'hospitality']

export default function Operacje() {
  const [params, setParams] = useSearchParams()
  const { getBusinessCategory } = useWorkspace()
  const alertCount = useAlertCount()

  const businessCategory = getBusinessCategory()
  const hasPakiety = CLEANING_CATEGORIES.includes(businessCategory)

  const tabs = [
    { key: 'przygotowania', label: 'Przygotowania' },
    { key: 'alerty',        label: 'Alerty', badge: alertCount },
    ...(hasPakiety ? [{ key: 'pakiety', label: 'Pakiety' }] : []),
    { key: 'naprawy',       label: 'Naprawy' },
    { key: 'rezerwacje',    label: 'Rezerwacje' },
    ...(hasPakiety ? [{ key: 'co_zabrac', label: 'Co zabrać' }] : []),
  ]

  const rawTab = params.get('tab') || 'przygotowania'
  const validKeys = tabs.map(t => t.key)
  const activeTab = validKeys.includes(rawTab) ? rawTab : 'przygotowania'

  function setTab(key) {
    setParams({ tab: key }, { replace: true })
  }

  return (
    <div>
      {/* Tab bar — horizontally scrollable on mobile */}
      <div
        className="flex overflow-x-auto mb-5"
        style={{ scrollbarWidth: 'none', borderBottom: '1px solid var(--border)' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
            style={{
              color: activeTab === tab.key ? 'var(--c-action)' : 'var(--text-2)',
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--c-action)' : 'transparent'}`,
              marginBottom: -1,
              background: 'transparent',
              outline: 'none',
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 5px',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: '16px',
                minWidth: 16,
                textAlign: 'center',
              }}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — only active tab renders */}
      {activeTab === 'przygotowania' && <PrzygotowaniaTab />}
      {activeTab === 'alerty'        && <AlertyTab />}
      {hasPakiety && activeTab === 'pakiety' && <PakietyTab />}
      {activeTab === 'naprawy'       && <NaprawyTab />}
      {activeTab === 'rezerwacje'    && <RezerwacjeTab />}
      {hasPakiety && activeTab === 'co_zabrac' && <CoZabracTab />}
    </div>
  )
}
