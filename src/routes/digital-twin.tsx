import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Crosshair,
  Lock,
  MousePointer2,
  Redo2,
  RefreshCw,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react'
import { clearUnityAssetCache } from '#/lib/unityCache'

export const Route = createFileRoute('/digital-twin')({
  component: DigitalTwinPage,
})

type BuildingId = 'All' | 'Stellar' | 'Teresa' | 'Raphael'

const buildings = [
  { id: 'All', label: 'All' },
  { id: 'Stellar', label: 'Stellar' },
  { id: 'Teresa', label: 'Teresa' },
  { id: 'Raphael', label: 'Raphael' },
] as const satisfies ReadonlyArray<{ id: BuildingId; label: string }>

// Mirrors DebugManager.GetDebugFloorNames on the Unity side: each building has its
// own basement depth and top floor, and floor 4 is skipped for every building.
function getFloorsForBuilding(building: BuildingId): string[] {
  const floors = ['All']
  if (building === 'All') return floors

  const basementFloors = building === 'Raphael' ? 1 : 2
  const topFloor = building === 'Teresa' ? 14 : building === 'Raphael' ? 8 : 11

  for (let floor = basementFloors; floor >= 1; floor--) floors.push(`B${floor}F`)
  for (let floor = 1; floor <= topFloor; floor++) {
    if (floor === 4) continue
    floors.push(`${floor}F`)
  }

  return floors
}

type SceneId = 'Viewer' | 'Studio'

const scenes = [
  { id: 'Viewer', label: 'Viewer' },
  { id: 'Studio', label: 'Studio' },
] as const satisfies ReadonlyArray<{ id: SceneId; label: string }>

type ViewDimension = '2D' | '3D'

const viewDimensions = ['3D', '2D'] as const satisfies ReadonlyArray<ViewDimension>

interface PopupMessage {
  id: number
  text: string
}

interface StudioAsset {
  id: number
  name: string
  objIndex: number
  category?: string | null
}

interface StudioPlacedObject {
  id: number
  objIndex: number
  typeName: string
  buildingId?: string
  isLocked: boolean
  posX: number
  posY: number
  posZ: number
  rotX: number
  rotY: number
  rotZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
}

// Row shape returned by /api/unity/loadObject.do (unity_objects table). The
// transform/timestamp fields are optional because a freshly placed object has
// no DB row yet — its panel is built from Unity's placed-object report instead.
interface UnityObjectRow {
  id: number
  category?: string
  buildingId: string
  objIndex: number
  posX?: number
  posY?: number
  posZ?: number
  rotX?: number
  rotY?: number
  rotZ?: number
  scaleX?: number
  scaleY?: number
  scaleZ?: number
  createdAt?: string
  updatedAt?: string
}

// Transform fields Unity reports live. These override the saved DB row so the
// properties panel tracks staged (unsaved) edits while in Studio.
function liveTransform(placed: StudioPlacedObject) {
  return {
    posX: placed.posX,
    posY: placed.posY,
    posZ: placed.posZ,
    rotX: placed.rotX,
    rotY: placed.rotY,
    rotZ: placed.rotZ,
    scaleX: placed.scaleX,
    scaleY: placed.scaleY,
    scaleZ: placed.scaleZ,
  }
}

function DigitalTwinPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [unityReady, setUnityReady] = useState(false)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingId>('All')
  const [selectedFloor, setSelectedFloor] = useState<string | null>('All')
  const [activeScene, setActiveScene] = useState<SceneId>('Viewer')
  const activeSceneRef = useRef<SceneId>('Viewer')
  const [popups, setPopups] = useState<PopupMessage[]>([])
  const popupCounter = useRef(0)
  const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([])
  const [selectedObjIndex, setSelectedObjIndex] = useState<number | null>(null)
  const [studioMode, setStudioModeState] = useState<0 | 1>(0)
  const [studioPanelTab, setStudioPanelTab] = useState<'library' | 'placed'>('library')
  const [studioPlacedObjects, setStudioPlacedObjects] = useState<StudioPlacedObject[]>([])
  const studioPlacedObjectsRef = useRef<StudioPlacedObject[]>([])
  const [selectedStudioObjectId, setSelectedStudioObjectId] = useState<number | null>(null)
  const [placedSearch, setPlacedSearch] = useState('')
  const [placedSort, setPlacedSort] = useState<'placed' | 'id' | 'type'>('placed')
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryCategory, setLibraryCategory] = useState('all')
  const [viewDimension, setViewDimensionState] = useState<ViewDimension>('3D')
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'done'>('idle')
  const [selectedObjectInfo, setSelectedObjectInfo] = useState<UnityObjectRow | null>(null)
  const [propertiesClosing, setPropertiesClosing] = useState(false)
  const objectInfoRequestId = useRef(0)
  const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)
  const [canUseStudio, setCanUseStudio] = useState(true)

  useEffect(() => {
    setTopbarSlot(document.getElementById('topbar-mode-switch'))
    setToolbarSlot(document.getElementById('topbar-floor-toolbar'))
  }, [])

  useEffect(() => {
    fetch('/api/unity/assetCatalog.do')
      .then((response) => response.json())
      .then((data) => setStudioAssets(data.rows ?? []))
      .catch(() => {})
  }, [])

  // Authority gate: Studio needs a login with a sufficient tier (근무자 and
  // anonymous visitors are blocked). Defaults to allowed while loading — the
  // server rejects unauthorized edits regardless.
  useEffect(() => {
    fetch('/api/unity/userAuthority')
      .then((response) => response.json())
      .then((data) => {
        if (data.result === 'success') setCanUseStudio(data.canUseStudio !== false)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    activeSceneRef.current = activeScene
  }, [activeScene])

  // A freshly placed object has no DB row until it is saved — fall back to the
  // data Unity reported for the placed-objects list so the panel still shows.
  function buildFallbackObjectInfo(id: number): UnityObjectRow | null {
    const placed = studioPlacedObjectsRef.current.find((object) => object.id === id)
    if (!placed) return null

    return {
      id: placed.id,
      objIndex: placed.objIndex,
      buildingId: placed.buildingId ?? '-',
      ...liveTransform(placed),
    }
  }

  // Unity reports which placed object is selected; the web looks its row up in
  // the DB (unity_objects) and shows the info panel. selectedId 0 means cleared.
  function loadSelectedObjectInfo(selectedId: number) {
    const requestId = ++objectInfoRequestId.current
    setPropertiesClosing(false)

    if (selectedId <= 0) {
      setSelectedObjectInfo(null)
      return
    }

    fetch(`/api/unity/loadObject.do?id=${selectedId}`)
      .then((response) => response.json())
      .then((data) => {
        if (requestId !== objectInfoRequestId.current) return
        const liveObject = buildFallbackObjectInfo(selectedId)
        const savedObject = data.rows?.[0]
        setSelectedObjectInfo(savedObject && liveObject ? { ...savedObject, ...liveObject } : savedObject ?? liveObject)
      })
      .catch(() => {
        if (requestId !== objectInfoRequestId.current) return
        setSelectedObjectInfo(buildFallbackObjectInfo(selectedId))
      })
  }

  async function handleClearCache() {
    setCacheStatus('clearing')
    await clearUnityAssetCache()
    setCacheStatus('done')
    setTimeout(() => setCacheStatus('idle'), 3000)
  }

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
        // Populate the placed-objects list for the Viewer panel on first load.
        iframeRef.current?.contentWindow?.postMessage(
          { source: 'dt-host', type: 'requestStudioObjects' },
          '*',
        )
      }

      if (data.type === 'report' && typeof data.message === 'string') {
        showPopup(data.message)
      }

      if (data.type === 'studioPlacedObjects' && Array.isArray(data.objects)) {
        studioPlacedObjectsRef.current = data.objects
        setStudioPlacedObjects(data.objects)
        setSelectedStudioObjectId(typeof data.selectedId === 'number' && data.selectedId > 0 ? data.selectedId : null)
        // Unity re-reports after transform edits — keep an open properties
        // panel tracking the live values instead of what it loaded initially.
        setSelectedObjectInfo((prev) => {
          if (!prev) return prev
          const live = (data.objects as StudioPlacedObject[]).find(
            (object) => object.id === prev.id,
          )
          return live ? { ...prev, ...liveTransform(live) } : prev
        })
      }

      if (data.type === 'studioPlacedObjectSelected' && typeof data.selectedId === 'number') {
        setSelectedStudioObjectId(data.selectedId > 0 ? data.selectedId : null)
        loadSelectedObjectInfo(data.selectedId)
      }

      if (data.type === 'numberInput' && typeof data.value === 'number') {
        if (activeSceneRef.current === 'Studio' && (data.value === 1 || data.value === 2)) {
          const nextMode = data.value === 1 ? 0 : 1
          iframeRef.current?.contentWindow?.postMessage(
            { source: 'dt-host', type: 'setMode', mode: nextMode },
            '*',
          )
          setStudioModeState(nextMode)
          setStudioPanelTab(nextMode === 0 ? 'library' : 'placed')
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

  function selectBuilding(building: BuildingId) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'selectBuilding', building }, '*')
    setSelectedBuilding(building)

    contentWindow.postMessage({ source: 'dt-host', type: 'selectFloor', floor: 'All' }, '*')
    setSelectedFloor('All')
    contentWindow.postMessage({ source: 'dt-host', type: 'requestStudioObjects' }, '*')
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function selectFloor(floor: string) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'selectFloor', floor }, '*')
    setSelectedFloor(floor)
    contentWindow.postMessage({ source: 'dt-host', type: 'requestStudioObjects' }, '*')
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function changeScene(scene: SceneId) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return
    if (scene === 'Studio' && !canUseStudio) return

    contentWindow.postMessage({ source: 'dt-host', type: 'changeScene', scene }, '*')
    setActiveScene(scene)

    // Studio edits one concrete building — "All" is Viewer-only.
    if (scene === 'Studio' && selectedBuilding === 'All') {
      contentWindow.postMessage({ source: 'dt-host', type: 'selectBuilding', building: 'Stellar' }, '*')
      setSelectedBuilding('Stellar')
    }

    if (selectedFloor) {
      contentWindow.postMessage({ source: 'dt-host', type: 'selectFloor', floor: selectedFloor }, '*')
    }
    setSelectedObjIndex(null)
    setStudioModeState(0)
    studioPlacedObjectsRef.current = []
    setStudioPlacedObjects([])
    setSelectedStudioObjectId(null)
    setSelectedObjectInfo(null)
    setViewDimensionState('3D')
    contentWindow.postMessage({ source: 'dt-host', type: 'requestStudioObjects' }, '*')

    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function setViewDimension(dimension: ViewDimension) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'switchView', dimension }, '*')
    setViewDimensionState(dimension)

    // Keep the camera on the selected object across the projection change.
    if (selectedStudioObjectId !== null) {
      contentWindow.postMessage(
        { source: 'dt-host', type: 'focusStudioObject', id: selectedStudioObjectId },
        '*',
      )
    }

    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function spawnAsset(objIndex: number) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'spawnAsset', objIndex }, '*')
    setSelectedObjIndex(objIndex)
    // Unity places the object at the viewport center immediately and switches
    // itself to Select mode with the new object selected — mirror that here.
    setStudioModeState(1)
    setStudioPanelTab('library')
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function setStudioMode(mode: 0 | 1) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type: 'setMode', mode }, '*')
    setStudioModeState(mode)
    if (mode === 1) {
      setStudioPanelTab('placed')
      contentWindow.postMessage({ source: 'dt-host', type: 'requestStudioObjects' }, '*')
    }
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function sendStudioHistory(direction: 'undo' | 'redo') {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage(
      { source: 'dt-host', type: direction === 'undo' ? 'undoStudioEdit' : 'redoStudioEdit' },
      '*',
    )
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  function sendStudioCommand(type: string, payload: Record<string, unknown> = {}) {
    const contentWindow = iframeRef.current?.contentWindow
    if (!unityReady || !contentWindow) return

    contentWindow.postMessage({ source: 'dt-host', type, ...payload }, '*')
    iframeRef.current?.contentDocument?.getElementById('unity-canvas')?.focus()
  }

  // Zooming in on an object also selects it, so show its Properties panel
  // right away instead of waiting for Unity to report the selection back.
  function focusStudioObject(id: number) {
    setSelectedStudioObjectId(id)
    loadSelectedObjectInfo(id)
    sendStudioCommand('selectStudioObject', { id })
    sendStudioCommand('focusStudioObject', { id })
  }

  // Unity deletes whatever is selected, so re-select by id first in case its
  // selection drifted from the object the properties panel is showing.
  function deleteSelectedObject(id: number) {
    sendStudioCommand('selectStudioObject', { id })
    sendStudioCommand('deleteStudioSelected')
  }

  // The tabs double as the Studio mode switch: 라이브러리 places, 배치됨 selects.
  function openLibraryTab() {
    setStudioPanelTab('library')
    setStudioMode(0)
  }

  function openPlacedTab() {
    setStudioPanelTab('placed')
    setStudioMode(1)
  }

  const libraryCategories = [...new Set(studioAssets.map((asset) => asset.category).filter(Boolean))] as string[]

  const visibleLibraryAssets = studioAssets.filter((asset) => {
    if (libraryCategory !== 'all' && asset.category !== libraryCategory) return false

    const query = librarySearch.trim().toLowerCase()
    if (!query) return true
    return asset.name.toLowerCase().includes(query)
  })

  const visibleStudioObjects = studioPlacedObjects
    .filter((object) => {
      const query = placedSearch.trim().toLowerCase()
      if (!query) return true
      return object.id.toString().includes(query) || object.typeName.toLowerCase().includes(query)
    })
    .sort((a, b) => {
      if (placedSort === 'id') return a.id - b.id
      if (placedSort === 'type') return a.typeName.localeCompare(b.typeName)
      return 0
    })

  return (
    <div className="twin-page">
      <section className="twin-layout">
        {toolbarSlot &&
          createPortal(
            <div className="floor-toolbar" role="group" aria-label="Building and floor">
              <select
                className="building-select"
                aria-label="Building"
                disabled={!unityReady}
                value={selectedBuilding}
                onChange={(event) => selectBuilding(event.target.value as BuildingId)}
              >
                {buildings
                  .filter((building) => activeScene !== 'Studio' || building.id !== 'All')
                  .map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.label}
                    </option>
                  ))}
              </select>

              <div className="floor-toolbar-divider" aria-hidden="true" />

              {getFloorsForBuilding(selectedBuilding).map((floor) => (
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
            </div>,
            toolbarSlot,
          )}

        {topbarSlot &&
          createPortal(
            <>
              {activeScene === 'Viewer' && (
                <>
                  <div className="twin-scene-switch" role="group" aria-label="View dimension">
                    {viewDimensions.map((dimension) => (
                      <button
                        key={dimension}
                        type="button"
                        className={
                          viewDimension === dimension
                            ? 'twin-scene-button is-active'
                            : 'twin-scene-button'
                        }
                        disabled={!unityReady}
                        onClick={() => setViewDimension(dimension)}
                      >
                        {dimension}
                      </button>
                    ))}
                  </div>

                  <div className="twin-topbar-divider" aria-hidden="true" />
                </>
              )}

              {activeScene === 'Studio' && (
                <>
                  <div className="twin-scene-switch" role="group" aria-label="Edit history">
                    <button
                      type="button"
                      className="twin-scene-button"
                      aria-label="Undo Studio edit"
                      title="Undo"
                      disabled={!unityReady}
                      onClick={() => sendStudioHistory('undo')}
                    >
                      <Undo2 size={16} />
                    </button>
                    <button
                      type="button"
                      className="twin-scene-button"
                      aria-label="Redo Studio edit"
                      title="Redo"
                      disabled={!unityReady}
                      onClick={() => sendStudioHistory('redo')}
                    >
                      <Redo2 size={16} />
                    </button>
                  </div>

                  <div className="twin-topbar-divider" aria-hidden="true" />
                </>
              )}

              <div className="twin-scene-switch" role="group" aria-label="Scene">
                {scenes.map((scene) => {
                  const blocked = scene.id === 'Studio' && !canUseStudio
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      className={
                        activeScene === scene.id
                          ? 'twin-scene-button is-active'
                          : 'twin-scene-button'
                      }
                      disabled={!unityReady || blocked}
                      title={blocked ? '스튜디오 편집 권한이 없습니다' : undefined}
                      onClick={() => changeScene(scene.id)}
                    >
                      {scene.label}
                    </button>
                  )
                })}
              </div>
{/* 
              <div className="twin-topbar-divider" aria-hidden="true" />

              <button
                type="button"
                className="secondary-action"
                title="Clear the Unity asset cache, then reload to re-download bundles"
                disabled={cacheStatus === 'clearing'}
                onClick={handleClearCache}
              >
                <RefreshCw size={15} />
                {cacheStatus === 'clearing'
                  ? 'Clearing…'
                  : cacheStatus === 'done'
                    ? 'Cache cleared'
                    : 'Clear cache'}
              </button> */}
            </>,
            topbarSlot,
          )}

        {activeScene === 'Viewer' && selectedBuilding !== 'All' && (
          <aside className="twin-panel twin-panel--left panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow"></p> 
                <h3>오브젝트 목록</h3>
              </div>
            </div>

            <input
              className="studio-search"
              type="search"
              value={placedSearch}
              onChange={(event) => setPlacedSearch(event.target.value)}
              placeholder="오브젝트 검색"
            />
            <div className="studio-list-meta">
              <span>배치된 오브젝트 {visibleStudioObjects.length}개</span>
              <select
                value={placedSort}
                onChange={(event) => setPlacedSort(event.target.value as 'placed' | 'id' | 'type')}
              >
                <option value="placed">배치순</option>
                <option value="id">ID순</option>
                <option value="type">유형별</option>
              </select>
            </div>

            <div className="viewer-object-list">
              {visibleStudioObjects.length === 0 ? (
                <p className="viewer-empty-hint">
                  {studioPlacedObjects.length === 0
                    ? '현재 층에 배치된 오브젝트가 없습니다.'
                    : '검색 조건에 맞는 오브젝트가 없습니다.'}
                </p>
              ) : (
                visibleStudioObjects.map((object) => (
                  <button
                    key={object.id}
                    type="button"
                    className={
                      selectedStudioObjectId === object.id
                        ? 'viewer-object-item is-selected'
                        : 'viewer-object-item'
                    }
                    onClick={() => {
                      setSelectedStudioObjectId(object.id)
                      loadSelectedObjectInfo(object.id)
                      sendStudioCommand('selectStudioObject', { id: object.id })
                    }}
                  >
                    <span className="viewer-object-copy">
                      <strong>{object.typeName}</strong>
                      <small>ID {object.id}</small>
                    </span>
                    <span className="studio-placed-actions">
                      <span
                        role="button"
                        tabIndex={selectedFloor === 'All' ? -1 : 0}
                        aria-label="Zoom to object"
                        aria-disabled={selectedFloor === 'All'}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (selectedFloor === 'All') return
                          focusStudioObject(object.id)
                        }}
                        onKeyDown={(event) => {
                          if (selectedFloor === 'All') return
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          focusStudioObject(object.id)
                        }}
                      >
                        <Crosshair size={14} />
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}

        {selectedObjectInfo && (
          <aside
            className={
              propertiesClosing
                ? 'twin-panel twin-panel--right panel is-closing'
                : 'twin-panel twin-panel--right panel'
            }
            onAnimationEnd={() => {
              if (!propertiesClosing) return
              setPropertiesClosing(false)
              setSelectedObjectInfo(null)
            }}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow"></p>
                <h3>속성</h3>
              </div>
              <button
                type="button"
                className="twin-popup-close"
                aria-label="Hide properties"
                onClick={() => setPropertiesClosing(true)}
              >
                ✕
              </button>
            </div>

            <div className="info-list">
              <div className="info-row">
                <span>Name</span>
                <strong>
                  {studioAssets.find((asset) => asset.objIndex === selectedObjectInfo.objIndex)
                    ?.name ?? `Object ${selectedObjectInfo.objIndex}`}
                </strong>
              </div>
              <div className="info-row">
                <span>ID</span>
                <strong>{selectedObjectInfo.id}</strong>
              </div>
              <div className="info-row">
                <span>Category</span>
                <strong>{selectedObjectInfo.category ?? '-'}</strong>
              </div>
              <div className="info-row">
                <span>Building</span>
                <strong>{selectedObjectInfo.buildingId}</strong>
              </div>
              {selectedObjectInfo.posX != null &&
                selectedObjectInfo.posY != null &&
                selectedObjectInfo.posZ != null && (
                  <div className="info-row">
                    <span>Position</span>
                    <strong>
                      {selectedObjectInfo.posX.toFixed(2)}, {selectedObjectInfo.posY.toFixed(2)},{' '}
                      {selectedObjectInfo.posZ.toFixed(2)}
                    </strong>
                  </div>
                )}
              {selectedObjectInfo.rotX != null &&
                selectedObjectInfo.rotY != null &&
                selectedObjectInfo.rotZ != null && (
                  <div className="info-row">
                    <span>Rotation</span>
                    <strong>
                      {selectedObjectInfo.rotX.toFixed(1)}, {selectedObjectInfo.rotY.toFixed(1)},{' '}
                      {selectedObjectInfo.rotZ.toFixed(1)}
                    </strong>
                  </div>
                )}
              {selectedObjectInfo.scaleX != null &&
                selectedObjectInfo.scaleY != null &&
                selectedObjectInfo.scaleZ != null && (
                  <div className="info-row">
                    <span>Scale</span>
                    <strong>
                      {selectedObjectInfo.scaleX.toFixed(2)}, {selectedObjectInfo.scaleY.toFixed(2)},{' '}
                      {selectedObjectInfo.scaleZ.toFixed(2)}
                    </strong>
                  </div>
                )}
              <div className="info-row">
                <span>Updated</span>
                <strong>
                  {selectedObjectInfo.updatedAt
                    ? new Date(selectedObjectInfo.updatedAt).toLocaleString()
                    : '저장되지 않음'}
                </strong>
              </div>
            </div>

            {activeScene === 'Studio' &&
              (() => {
                const placed = studioPlacedObjects.find(
                  (object) => object.id === selectedObjectInfo.id,
                )
                if (!placed) return null

                return (
                  <button
                    type="button"
                    className="twin-object-delete"
                    disabled={!unityReady || placed.isLocked}
                    title={placed.isLocked ? '잠금 해제 후 삭제할 수 있습니다' : undefined}
                    onClick={() => deleteSelectedObject(placed.id)}
                  >
                    <Trash2 size={15} />
                    삭제
                  </button>
                )
              })()}
          </aside>
        )}

        {activeScene === 'Studio' && (
          <aside className="twin-panel twin-panel--left panel">
            {/* <div className="section-heading">
              <div>
                <p className="eyebrow"></p>
                <h3>Studio</h3>
              </div>
            </div> */}

            <div className="studio-tabs" role="tablist" aria-label="Studio tools">
              <button
                type="button"
                className={studioPanelTab === 'library' ? 'studio-tab is-active' : 'studio-tab'}
                disabled={!unityReady}
                onClick={openLibraryTab}
              >
                라이브러리
              </button>
              <button
                type="button"
                className={studioPanelTab === 'placed' ? 'studio-tab is-active' : 'studio-tab'}
                disabled={!unityReady}
                onClick={openPlacedTab}
              >
                배치됨
              </button>
            </div>

            {studioPanelTab === 'library' && (
              <>
                <select
                  className="studio-search"
                  aria-label="Category"
                  value={libraryCategory}
                  onChange={(event) => setLibraryCategory(event.target.value)}
                >
                  <option value="all">모든 카테고리</option>
                  {libraryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <input
                  className="studio-search"
                  type="search"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="오브젝트 검색"
                />

                {visibleLibraryAssets.length === 0 ? (
                  <p className="viewer-empty-hint">
                    {studioAssets.length === 0
                      ? 'No assets in the catalog.'
                      : 'No assets match the search.'}
                  </p>
                ) : (
                  <div className="studio-asset-grid">
                    {visibleLibraryAssets.map((asset) => (
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
                )}
              </>
            )}

            {studioPanelTab === 'placed' && (
              <div className="studio-placed-panel">
                <input
                  className="studio-search"
                  type="search"
                  value={placedSearch}
                  onChange={(event) => setPlacedSearch(event.target.value)}
                  placeholder="오브젝트 검색"
                />
                <div className="studio-list-meta">
                  <span>배치된 오브젝트 {visibleStudioObjects.length}개</span>
                  <select
                    value={placedSort}
                    onChange={(event) => setPlacedSort(event.target.value as 'placed' | 'id' | 'type')}
                  >
                    <option value="placed">배치순</option>
                    <option value="id">ID순</option>
                    <option value="type">유형별</option>
                  </select>
                </div>

                <div className="studio-placed-list">
                  {visibleStudioObjects.map((object) => (
                    <button
                      key={object.id}
                      type="button"
                      className={
                        selectedStudioObjectId === object.id
                          ? 'studio-placed-item is-selected'
                          : 'studio-placed-item'
                      }
                      onClick={() => {
                        setSelectedStudioObjectId(object.id)
                        sendStudioCommand('selectStudioObject', { id: object.id })
                      }}
                    >
                      <span className="studio-placed-copy">
                        <strong>ID {object.id}</strong>
                        <small>{object.typeName}</small>
                      </span>
                      <span className="studio-placed-actions">
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={object.isLocked ? 'Unlock object' : 'Lock object'}
                          onClick={(event) => {
                            event.stopPropagation()
                            sendStudioCommand(
                              object.isLocked ? 'unlockStudioObject' : 'lockStudioObject',
                              { id: object.id },
                            )
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            event.stopPropagation()
                            sendStudioCommand(
                              object.isLocked ? 'unlockStudioObject' : 'lockStudioObject',
                              { id: object.id },
                            )
                          }}
                        >
                          {object.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Focus object"
                          onClick={(event) => {
                            event.stopPropagation()
                            focusStudioObject(object.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            event.stopPropagation()
                            focusStudioObject(object.id)
                          }}
                        >
                          <Crosshair size={14} />
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {studioPanelTab === 'library' && (
              <div className="hint-box">
                <MousePointer2 size={18} />
                <p>
                  {studioMode === 0
                    ? '배치할 오브젝트를 선택한 후, 씬에서 원하는 위치를 클릭하여 배치하세요.'
                    : '씬에서 배치된 오브젝트를 클릭하여 선택하세요.'}
                </p>
              </div>
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
