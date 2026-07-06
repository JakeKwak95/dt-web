import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { MousePointer2 } from 'lucide-react'
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

const FLOORS = ['All', 'B2F', 'B1F', '1F', '2F', '3F', '5F', '6F', '7F', '8F', '9F', '10F', '11F'] as const

type SceneId = 'MainScene' | 'StudioScene'

const scenes = [
  { id: 'MainScene', label: 'Viewer' },
  { id: 'StudioScene', label: 'Studio' },
] as const satisfies ReadonlyArray<{ id: SceneId; label: string }>

interface PopupMessage {
  id: number
  text: string
}

interface StudioAsset {
  id: number
  name: string
  objIndex: number
}

function DigitalTwinPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [unityReady, setUnityReady] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [activeScene, setActiveScene] = useState<SceneId>('MainScene')
  const activeSceneRef = useRef<SceneId>('MainScene')
  const [popups, setPopups] = useState<PopupMessage[]>([])
  const popupCounter = useRef(0)
  const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([])
  const [selectedObjIndex, setSelectedObjIndex] = useState<number | null>(null)
  const [studioMode, setStudioModeState] = useState<0 | 1>(0)

  useEffect(() => {
    fetch('/api/unity/assetCatalog.do')
      .then((response) => response.json())
      .then((data) => setStudioAssets(data.rows ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    activeSceneRef.current = activeScene
  }, [activeScene])

  function dismissPopup(id: number) {
    setPopups((prev) => prev.filter((p) => p.id !== id))
  }

  function showPopup(text: string) {
    const id = ++popupCounter.current
    setPopups((prev) => [...prev, { id, text }])
    setTimeout(() => dismissPopup(id), 5000)
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data
      if (!data || data.source !== 'unity-webgl') return

      if (data.type === 'ready') {
        setUnityReady(true)
      }

      if (data.type === 'report' && typeof data.message === 'string') {
        showPopup(data.message)
      }

      if (data.type === 'numberInput' && typeof data.value === 'number') {
        if (activeSceneRef.current === 'StudioScene' && (data.value === 1 || data.value === 2)) {
          const nextMode = data.value === 1 ? 0 : 1
          iframeRef.current?.contentWindow?.postMessage(
            { source: 'dt-host', type: 'setMode', mode: nextMode },
            '*',
          )
          setStudioModeState(nextMode)
          showPopup(nextMode === 0 ? 'Studio mode: Place' : 'Studio mode: Select')
          return
        }

        showPopup(`Number input: ${data.value}`)
      }
    }

    window.addEventListener('message', handleMessage)

    // Unity only announces 'ready' once, right when it finishes booting. If this
    // effect attaches after that (e.g. main thread busy hydrating), the message
    // is lost forever and buttons stay disabled until a refresh re-races it. Ask
    // the iframe to re-announce in case it already loaded before we were listening.
    iframeRef.current?.contentWindow?.postMessage({ source: 'dt-host', type: 'checkReady' }, '*')

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

    const defaultFloor = scene === 'MainScene' ? 'All' : '1F'
    contentWindow.postMessage({ source: 'dt-host', type: 'loadBuilding', floor: defaultFloor }, '*')
    setSelectedFloor(defaultFloor)
    setSelectedObjIndex(null)
    setStudioModeState(0)

    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function spawnAsset(objIndex: number) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'spawnAsset', objIndex }, '*')
    setSelectedObjIndex(objIndex)
    setStudioModeState(0)
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function setStudioMode(mode: 0 | 1) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'setMode', mode }, '*')
    setStudioModeState(mode)
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function sendSave() {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'save' }, '*')
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  return (
    <div className="twin-page">
      <section className="twin-layout">
        <div className="floor-toolbar" role="group" aria-label="Floors">
          {FLOORS.map((floor) => (
            <button
              key={floor}
              type="button"
              className={selectedFloor === floor ? 'primary-action' : 'secondary-action'}
              disabled={!unityReady}
              onClick={() => selectFloor(floor)}
            >
              {floor}
            </button>
          ))}
        </div>

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

        {activeScene === 'StudioScene' && (
          <aside className="twin-panel panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow"></p>
                <h3>Assets</h3>
              </div>
            </div>

            <div className="floor-buttons">
              <button
                type="button"
                className={studioMode === 0 ? 'primary-action' : 'secondary-action'}
                disabled={!unityReady}
                onClick={() => setStudioMode(0)}
              >
                Place
              </button>
              <button
                type="button"
                className={studioMode === 1 ? 'primary-action' : 'secondary-action'}
                disabled={!unityReady}
                onClick={() => setStudioMode(1)}
              >
                Select
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={!unityReady}
                onClick={sendSave}
              >
                Save
              </button>
            </div>
            <div className="studio-asset-grid">
              {studioAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={
                    selectedObjIndex === asset.objIndex
                      ? 'studio-asset-item is-selected'
                      : 'studio-asset-item'
                  }
                  disabled={!unityReady}
                  onClick={() => spawnAsset(asset.objIndex)}
                >
                  <img
                    className="studio-asset-thumb"
                    src={`/assets/studio-icons/${asset.objIndex}.png`}
                    alt={asset.name}
                  />
                  <span>{asset.name}</span>
                </button>
              ))}
            </div>
            <div className="hint-box">
              <MousePointer2 size={18} />
              <p>
                {studioMode === 0
                  ? 'Click an asset to spawn it, then click in the scene to place it.'
                  : 'Click a placed object in the scene to select it.'}
              </p>
            </div>
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

        {popups.length > 0 && (
          <div className="twin-popup-stack">
            {popups.map((popup) => (
              <div key={popup.id} className="twin-popup panel">
                <div className="twin-popup-header">
                  <span className="eyebrow">Unity Message</span>
                  <button
                    type="button"
                    className="twin-popup-close"
                    aria-label="Dismiss"
                    onClick={() => dismissPopup(popup.id)}
                  >
                    ✕
                  </button>
                </div>
                <p className="twin-popup-body">{popup.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
