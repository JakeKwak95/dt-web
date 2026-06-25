import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CircleDot,
  Database,
  Server,
  Wifi,
} from 'lucide-react'

const metrics = [
  { label: 'Active sites', value: '1', detail: 'Main hospital campus' },
  { label: 'Tracked assets', value: '128', detail: 'Rooms, devices, zones' },
  { label: 'Live sensors', value: '42', detail: 'Ready for DB streaming' },
  { label: 'Open alerts', value: '3', detail: 'Needs operator review' },
]

const events = [
  {
    title: 'Unity viewer placeholder prepared',
    time: 'Now',
    tone: 'good',
  },
  {
    title: 'PostgreSQL schema planning required',
    time: 'Next',
    tone: 'neutral',
  },
  {
    title: 'Better Auth secret still needs real value',
    time: 'Setup',
    tone: 'warning',
  },
]

export default function DashboardOverview() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Project foundation</p>
          <h2>Build the web control layer around your Unity twin.</h2>
          <p>
            This workspace is ready for dashboards, PostgreSQL metadata, auth,
            and a Unity WebGL viewer page.
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

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Readiness</p>
              <h3>System setup</h3>
            </div>
          </div>
          <div className="setup-list">
            <SetupItem icon={Building2} label="Web shell" status="Ready" />
            <SetupItem icon={Database} label="Drizzle/PostgreSQL" status="Next" />
            <SetupItem icon={Server} label="Server functions" status="Next" />
            <SetupItem icon={Wifi} label="Unity bridge" status="Later" />
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Activity</p>
              <h3>Recent events</h3>
            </div>
          </div>
          <div className="event-list">
            {events.map((event) => (
              <div className="event-row" key={event.title}>
                {event.tone === 'warning' ? (
                  <AlertTriangle size={17} />
                ) : (
                  <CircleDot size={17} />
                )}
                <div>
                  <strong>{event.title}</strong>
                  <span>{event.time}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
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

