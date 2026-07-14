import { useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Activity, Map, Settings } from 'lucide-react'
import { authClient } from '#/lib/auth-client'

// Landing with ?ott=<token> (from the dev dashboard or an external portal)
// exchanges the single-use token for this origin's own session cookie, then
// reloads with the token stripped so it never lingers in the address bar.
function consumeOneTimeToken() {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('ott')
  if (!token) return

  url.searchParams.delete('ott')
  const cleanUrl = url.pathname + url.search + url.hash

  void authClient.oneTimeToken
    .verify({ token })
    .catch(() => null)
    .then(() => window.location.replace(cleanUrl))
}

const navItems = [
  { to: '/dashboard', label: '대시보드', shortLabel: 'Dash', icon: Activity },
  {
    to: '/digital-twin',
    label: '디지털 트윈',
    shortLabel: 'Twin',
    icon: Map,
  },
  { to: '/settings', label: '설정', shortLabel: 'Settings', icon: Settings },
] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    consumeOneTimeToken()
  }, [])

  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>
  }

  return (
    <div className="app-main">
      <header className="topbar">
        <div className="topbar-brand">
          <Link to="/dashboard" aria-label="대시보드로 이동">
            <img
              src="/logo.png"
              alt="Daegu Catholic University Medical Center"
              style={{ filter: 'brightness(0.5) saturate(100%) invert(100%) hue-rotate(190deg)' }}
            />
          </Link>
        </div>

        <div className="topbar-toolbar" id="topbar-floor-toolbar" />

        <div className="topbar-actions" id="topbar-mode-switch" />
      </header>

      <main className="content-area">{children}</main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="mobile-link"
              activeProps={{ className: 'mobile-link is-active' }}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.shortLabel}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
