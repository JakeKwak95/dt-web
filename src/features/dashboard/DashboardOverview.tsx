import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Building2,
  CirclePlus,
  Database,
  Pencil,
  RefreshCw,
  Server,
  Trash2,
  Wifi,
} from 'lucide-react'
import { clearUnityAssetCache } from '#/lib/unityCache'

type CacheStatus = 'idle' | 'clearing' | 'done'

// Shape returned by /api/unity/dashboardStats.
interface DashboardStats {
  placedObjects: number
  buildings: number
  weekChanges: number
  lastChangeAt: string | null
  catalogAssets: number
  catalogCategories: number
  weekEditors: number
  registeredUsers: number
}

function buildMetrics(stats: DashboardStats | null) {
  return [
    {
      label: 'Placed objects',
      value: stats ? String(stats.placedObjects) : '—',
      detail: stats
        ? `Across ${stats.buildings} building floor${stats.buildings === 1 ? '' : 's'}`
        : 'Loading…',
    },
    {
      label: 'Changes (7 days)',
      value: stats ? String(stats.weekChanges) : '—',
      detail: stats?.lastChangeAt
        ? `Last: ${new Date(stats.lastChangeAt).toLocaleString()}`
        : 'No changes recorded yet',
    },
    {
      label: 'Asset catalog',
      value: stats ? String(stats.catalogAssets) : '—',
      detail: stats
        ? `${stats.catalogCategories} categor${stats.catalogCategories === 1 ? 'y' : 'ies'}`
        : 'Loading…',
    },
    {
      label: 'Active editors (7 days)',
      value: stats ? String(stats.weekEditors) : '—',
      detail: stats
        ? `${stats.registeredUsers} registered user${stats.registeredUsers === 1 ? '' : 's'}`
        : 'Loading…',
    },
  ]
}

// Row shape returned by /api/unity/changeLog (unity_object_audit_log joined
// with the asset catalog for a readable type name).
interface ChangeLogRow {
  id: number
  objectId: number
  action: 'create' | 'update' | 'delete' | string
  occurredAt: string
  actorName: string | null
  actorEmail: string | null
  buildingId: string | null
  objIndex: number | null
  changedFields: string[]
  changeSetId: string | null
  source: string
  typeName: string | null
}

const actionPresentation = {
  create: { label: 'Placed', Icon: CirclePlus, className: 'event-icon--create' },
  update: { label: 'Updated', Icon: Pencil, className: 'event-icon--update' },
  delete: { label: 'Deleted', Icon: Trash2, className: 'event-icon--delete' },
} as const

function getActionPresentation(action: string) {
  return action === 'create' || action === 'update' || action === 'delete'
    ? actionPresentation[action]
    : actionPresentation.update
}

function describeChangeLogRow(row: ChangeLogRow) {
  const objectLabel = `${row.typeName ?? `Asset ${row.objIndex ?? '?'}`} #${row.objectId}`
  const actor = row.actorName ?? row.actorEmail ?? 'Unity viewer'
  const details = [
    row.buildingId,
    actor,
    row.action === 'update' && row.changedFields.length > 0
      ? row.changedFields.join(', ')
      : null,
  ].filter(Boolean)

  return { objectLabel, details: details.join(' · ') }
}

export default function DashboardOverview() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>('idle')
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    fetch('/api/unity/dashboardStats')
      .then((response) => response.json())
      .then((data) => {
        if (data.result === 'success' && data.stats) setStats(data.stats)
      })
      .catch(() => {})
  }, [])

  const metrics = buildMetrics(stats)

  async function handleClearCache() {
    setCacheStatus('clearing')
    await clearUnityAssetCache()
    setCacheStatus('done')
    setTimeout(() => setCacheStatus('idle'), 3000)
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">병원 디지털 트윈</p>
          <h2>Unity 디지털 트윈을 웹에서 확인하고 관리하세요.</h2>
          <p>
            3D 뷰어에서 건물과 층별 오브젝트 배치를 확인하고, 스튜디오에서
            오브젝트를 배치·편집하세요. 모든 변경 내역은 자동으로 기록됩니다.
          </p>
        </div>
        <div className="hero-actions">
          <a className="primary-action" href="/digital-twin">
            Open viewer
            <ArrowUpRight size={16} />
          </a>
          <a className="secondary-action" href="/settings">
            Configure
          </a>
          <button
            type="button"
            className="secondary-action"
            onClick={handleClearCache}
            disabled={cacheStatus === 'clearing'}
          >
            <RefreshCw size={16} />
            {cacheStatus === 'clearing'
              ? 'Clearing…'
              : cacheStatus === 'done'
                ? 'Cache cleared'
                : 'Clear viewer cache'}
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Project metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="viewer-preview panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Digital twin</p>
              <h3>Unity WebGL viewport</h3>
            </div>
            <span className="pill">Placeholder</span>
          </div>
          <div className="viewport-box">
            <div className="floor-plate">
              <span className="room room-a">1F Lobby</span>
              <span className="room room-b">Ward A</span>
              <span className="room room-c">Utility</span>
              <span className="room room-d">ER</span>
            </div>
          </div>
        </article>

        <ChangeLogPanel />
      </section>
    </div>
  )
}

type ActionFilter = 'all' | 'create' | 'update' | 'delete'

const actionFilters = [
  { id: 'all', label: 'All' },
  { id: 'create', label: 'Placed' },
  { id: 'update', label: 'Updated' },
  { id: 'delete', label: 'Deleted' },
] as const satisfies ReadonlyArray<{ id: ActionFilter; label: string }>

function ChangeLogPanel() {
  const [rows, setRows] = useState<ChangeLogRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [filter, setFilter] = useState<ActionFilter>('all')

  const loadChangeLog = useCallback((action: ActionFilter) => {
    setStatus('loading')
    const actionQuery = action === 'all' ? '' : `&action=${action}`
    fetch(`/api/unity/changeLog?limit=20${actionQuery}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.result !== 'success') throw new Error(data.message)
        setRows(data.rows ?? [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    loadChangeLog(filter)
  }, [filter, loadChangeLog])

  return (
    <article className="panel activity-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h3>Change log</h3>
        </div>
        <button
          type="button"
          className="secondary-action"
          aria-label="Refresh change log"
          disabled={status === 'loading'}
          onClick={() => loadChangeLog(filter)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="event-filters" role="group" aria-label="Filter change log">
        {actionFilters.map((option) => (
          <button
            key={option.id}
            type="button"
            className={filter === option.id ? 'event-filter is-active' : 'event-filter'}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="event-list">
        {status === 'error' && (
          <p className="viewer-empty-hint">Failed to load the change log.</p>
        )}
        {status === 'ready' && rows.length === 0 && (
          <p className="viewer-empty-hint">
            {filter === 'all'
              ? 'No object changes recorded yet.'
              : 'No changes match this filter.'}
          </p>
        )}
        {rows.map((row) => {
          const presentation = getActionPresentation(row.action)
          const { objectLabel, details } = describeChangeLogRow(row)

          return (
            <div className="event-row" key={row.id}>
              <presentation.Icon size={17} className={presentation.className} />
              <div>
                <strong>
                  {presentation.label} · {objectLabel}
                </strong>
                <span>
                  {new Date(row.occurredAt).toLocaleString()}
                  {details ? ` · ${details}` : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function SetupItem({
  icon: Icon,
  label,
  status,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  status: string
}) {
  return (
    <div className="setup-item">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{status}</strong>
    </div>
  )
}

