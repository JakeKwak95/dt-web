import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/digital-twin')({
  component: DigitalTwinPage,
})

// All viewer/studio UI (building & floor toolbar, scene switch, library,
// placed-object list, properties panel, toasts) now lives inside the Unity
// app itself — the web page only hosts the WebGL build.
function DigitalTwinPage() {
  return (
    <div className="twin-page">
      <section className="twin-layout">
        <div className="unity-stage panel">
          <iframe
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
