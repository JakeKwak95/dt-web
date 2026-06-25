import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-stack">
      <section className="panel">
        <p className="eyebrow">About</p>
        <h2>DT Control foundation</h2>
        <p>
          This TanStack Start app is the web control layer for a Unity digital
          twin project. It will handle dashboards, metadata, authentication,
          database access, and the embedded WebGL viewer.
        </p>
      </section>
    </main>
  )
}
