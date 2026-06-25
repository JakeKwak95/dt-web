import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Database, MousePointer2, PanelRight } from 'lucide-react'
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

function DigitalTwinPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [unityReady, setUnityReady] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)

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
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Unity integration</p>
          <h2>Digital Twin Viewer</h2>
        </div>
        <span className="pill">Unity WebGL</span>
      </section>

      <section className="twin-layout">
        <div className="unity-stage panel">
          <iframe
            ref={iframeRef}
            title="Unity Digital Twin Viewer"
            src="/unity/dt-viewer/index.html"
            className="unity-frame"
            allow="fullscreen; gamepad; clipboard-read; clipboard-write"
          />
        </div>

        <aside className="inspector-panel panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inspector</p>
              <h3>Selected object</h3>
            </div>
            <PanelRight size={18} />
          </div>

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
            <InfoRow label="Object" value="No asset selected" />
            <InfoRow label="Floor" value={selectedFloor ?? '-'} />
            <InfoRow
              label="Sensor status"
              value={unityReady ? 'Waiting for data' : 'Waiting for Unity'}
            />
          </div>

          <div className="hint-box">
            <MousePointer2 size={18} />
            <p>
              Later, Unity can send clicked object IDs to this panel, and this
              page can fetch DB details through server functions.
            </p>
          </div>

          <div className="hint-box">
            <Database size={18} />
            <p>
              Good first DB tables: sites, buildings, floors, rooms, assets,
              sensors, readings, and events.
            </p>
          </div>
        </aside>
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
