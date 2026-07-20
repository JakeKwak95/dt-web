import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CirclePlus,
  ExternalLink,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { clearUnityAssetCache } from '#/lib/unityCache'

const PRODUCTION_URL = '/dt/dt3dView.do'

// The viewer is now same-origin with DTSSS, so the existing JSESSIONID is
// carried automatically and no cross-site one-time token is needed.
function openProductionWithAuth() {
  window.open(PRODUCTION_URL, '_blank', 'noopener,noreferrer')
}

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
      label: '배치된 오브젝트',
      value: stats ? String(stats.placedObjects) : '—',
      detail: stats ? `${stats.buildings}개 층에 배치됨` : '불러오는 중…',
    },
    {
      label: '변경 (최근 7일)',
      value: stats ? String(stats.weekChanges) : '—',
      detail: stats?.lastChangeAt
        ? `마지막 변경: ${new Date(stats.lastChangeAt).toLocaleString()}`
        : '기록된 변경 없음',
    },
    {
      label: '에셋 카탈로그',
      value: stats ? String(stats.catalogAssets) : '—',
      detail: stats ? `카테고리 ${stats.catalogCategories}개` : '불러오는 중…',
    },
    {
      label: '활성 편집자 (최근 7일)',
      value: stats ? String(stats.weekEditors) : '—',
      detail: stats ? `가입 사용자 ${stats.registeredUsers}명` : '불러오는 중…',
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
  create: { label: '배치', Icon: CirclePlus, className: 'event-icon--create' },
  update: { label: '수정', Icon: Pencil, className: 'event-icon--update' },
  delete: { label: '삭제', Icon: Trash2, className: 'event-icon--delete' },
} as const

function getActionPresentation(action: string) {
  return action === 'create' || action === 'update' || action === 'delete'
    ? actionPresentation[action]
    : actionPresentation.update
}

function describeChangeLogRow(row: ChangeLogRow) {
  const objectLabel = `${row.typeName ?? `에셋 ${row.objIndex ?? '?'}`} #${row.objectId}`
  const actor = row.actorName ?? row.actorEmail ?? 'Unity 뷰어'
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
            뷰어 열기
            <ArrowUpRight size={16} />
          </a>
          <a className="secondary-action" href="/settings">
            설정
          </a>
          <button
            type="button"
            className="secondary-action"
            onClick={() => void openProductionWithAuth()}
          >
            <ExternalLink size={16} />
            운영 사이트
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={handleClearCache}
            disabled={cacheStatus === 'clearing'}
          >
            <RefreshCw size={16} />
            {cacheStatus === 'clearing'
              ? '삭제 중…'
              : cacheStatus === 'done'
                ? '캐시 삭제됨'
                : '뷰어 캐시 삭제'}
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="프로젝트 지표">
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
              <p className="eyebrow">디지털 트윈</p>
              <h3>Unity WebGL 뷰포트</h3>
            </div>
            <span className="pill">예시 화면</span>
          </div>
          <div className="viewport-box">
            <div className="floor-plate">
              <span className="room room-a">1층 로비</span>
              <span className="room room-b">병동 A</span>
              <span className="room room-c">설비실</span>
              <span className="room room-d">응급실</span>
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
  { id: 'all', label: '전체' },
  { id: 'create', label: '배치' },
  { id: 'update', label: '수정' },
  { id: 'delete', label: '삭제' },
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
          <p className="eyebrow">활동</p>
          <h3>변경 이력</h3>
        </div>
        <button
          type="button"
          className="secondary-action"
          aria-label="변경 이력 새로고침"
          disabled={status === 'loading'}
          onClick={() => loadChangeLog(filter)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="event-filters" role="group" aria-label="변경 이력 필터">
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
          <p className="viewer-empty-hint">변경 이력을 불러오지 못했습니다.</p>
        )}
        {status === 'ready' && rows.length === 0 && (
          <p className="viewer-empty-hint">
            {filter === 'all'
              ? '기록된 오브젝트 변경이 없습니다.'
              : '필터에 해당하는 변경이 없습니다.'}
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
