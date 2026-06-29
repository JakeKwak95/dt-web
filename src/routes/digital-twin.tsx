import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  Database,
  MousePointer2,
  Wifi,
} from 'lucide-react'
import { getCurrentSession } from '#/lib/session'

export const Route = createFileRoute('/digital-twin')({
  beforeLoad: async () => {
    const session = await getCurrentSession()

    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: DigitalTwinPage,
})

const FLOORS = ['All', 'B2F', 'B1F', '1F', '2F', '5F', '6F', '7F', '8F', '9F', '10F', '11F'] as const

const categories = [
  { id: 'floors', label: 'Floors', icon: Building2 },
  { id: 'assets', label: 'Assets', icon: Database },
  { id: 'sensors', label: 'Sensors', icon: Wifi },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
] as const

type CategoryId = (typeof categories)[number]['id']
type SceneId = 'MainScene' | 'StudioScene'

const scenes = [
  { id: 'MainScene', label: 'Viewer' },
  { id: 'StudioScene', label: 'Studio' },
] as const satisfies ReadonlyArray<{ id: SceneId; label: string }>

function DigitalTwinPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [unityReady, setUnityReady] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>('floors')
  const [activeScene, setActiveScene] = useState<SceneId>('MainScene')

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data
      if (!data || data.source !== 'unity-webgl') return

      if (data.type === 'ready') {
        setUnityReady(true)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function selectFloor(floor: string) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'loadBuilding', floor }, '*')
    setSelectedFloor(floor)
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function changeScene(scene: SceneId) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'changeScene', scene }, '*')
    setActiveScene(scene)
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function selectCategory(id: CategoryId) {
    setActiveCategory((current) => (current === id ? null : id))
  }

  const activeMeta = categories.find((category) => category.id === activeCategory)

  return (
    <div className="twin-page">
      <section className="twin-layout">
        <div className="twin-scene-switch" role="group" aria-label="Scene">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={
                activeScene === scene.id
                  ? 'twin-scene-button is-active'
                  : 'twin-scene-button'
              }
              disabled={!unityReady}
              onClick={() => changeScene(scene.id)}
            >
              {scene.label}
            </button>
          ))}
        </div>

        <nav className="twin-rail" aria-label="Twin categories">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                type="button"
                className={
                  activeCategory === category.id
                    ? 'twin-rail-button is-active'
                    : 'twin-rail-button'
                }
                aria-label={category.label}
                title={category.label}
                onClick={() => selectCategory(category.id)}
              >
                <Icon size={18} />
              </button>
            )
          })}
        </nav>

        {activeMeta && (
          <aside className="twin-panel panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Inspector</p>
                <h3>{activeMeta.label}</h3>
              </div>
              <button
                type="button"
                className="twin-panel-collapse"
                onClick={() => setActiveCategory(null)}
              >
                <ChevronLeft size={14} />
                Collapse
              </button>
            </div>

            {activeCategory === 'floors' && (
              <>
                <div className="floor-buttons">
                  {FLOORS.map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      className={
                        selectedFloor === floor ? 'primary-action' : 'secondary-action'
                      }
                      disabled={!unityReady}
                      onClick={() => selectFloor(floor)}
                    >
                      {floor}
                    </button>
                  ))}
                </div>
                <div className="info-list">
                  <InfoRow label="Floor" value={selectedFloor ?? '-'} />
                </div>
                <div className="hint-box">
                  <Database size={18} />
                  <p>
                    Good first DB tables: sites, buildings, floors, and rooms.
                  </p>
                </div>
              </>
            )}

            {activeCategory === 'assets' && (
              <>
                <div className="info-list">
                  <InfoRow label="Object" value="No asset selected" />
                </div>
                <div className="hint-box">
                  <MousePointer2 size={18} />
                  <p>
                    Later, Unity can send clicked object IDs to this panel, and
                    this page can fetch DB details through server functions.
                  </p>
                </div>
              </>
            )}

            {activeCategory === 'sensors' && (
              <>
                <div className="info-list">
                  <InfoRow
                    label="Sensor status"
                    value={unityReady ? 'Waiting for data' : 'Waiting for Unity'}
                  />
                </div>
                <div className="hint-box">
                  <Wifi size={18} />
                  <p>Good first DB tables: sensors and readings.</p>
                </div>
              </>
            )}

            {activeCategory === 'alerts' && (
              <>
                <div className="info-list">
                  <InfoRow label="Open alerts" value="No active alerts" />
                </div>
                <div className="hint-box">
                  <AlertTriangle size={18} />
                  <p>Good first DB table: events.</p>
                </div>
              </>
            )}
          </aside>
        )}

        <div className="unity-stage panel">
          <iframe
            ref={iframeRef}
            title="Unity Digital Twin Viewer"
            src="/unity/dt-viewer/index.html"
            className="unity-frame"
            allow="fullscreen; gamepad; clipboard-read; clipboard-write"
          />
        </div>
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
