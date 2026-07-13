import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const settings = [
  {
    title: 'Project identity',
    description: 'Set the service name, campus name, and default landing view.',
  },
  {
    title: 'Database',
    description: 'Connect PostgreSQL and run Drizzle migrations.',
  },
  {
    title: 'Authentication',
    description: 'Generate a Better Auth secret and define user roles.',
  },
  {
    title: 'Unity viewer',
    description: 'Upload or reference your Unity WebGL build files.',
  },
]

function SettingsPage() {
  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Configuration</p>
          <h2>Settings</h2>
        </div>
      </section>

      <section className="settings-grid">
        {settings.map((item) => (
          <article className="panel setting-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <button type="button" className="secondary-action">
              Configure
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}
