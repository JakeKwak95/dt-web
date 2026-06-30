import { useState } from 'react'
import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import {
  Activity,
  Bell,
  Map,
  Search,
  Settings,
  LogOut,
} from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import ThemeToggle from '../ThemeToggle'

const SIDEBAR_HIDDEN_KEY = 'app-sidebar-hidden'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: Activity },
  {
    to: '/digital-twin',
    label: 'Digital Twin',
    shortLabel: 'Twin',
    icon: Map,
  },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { data: session, isPending } = authClient.useSession()
  const [sidebarHidden, setSidebarHidden] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_HIDDEN_KEY) === 'true',
  )

  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>
  }

  const userInitial = session?.user.name.charAt(0).toUpperCase() || 'U'

  const setSidebarHiddenPersisted = (next: boolean) => {
    setSidebarHidden(next)
    localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(next))
  }

  const handleNavClick = (item: (typeof navItems)[number]) => (event: React.MouseEvent) => {
    if (pathname === item.to) {
      event.preventDefault()
      setSidebarHiddenPersisted(!sidebarHidden)
    } else if (sidebarHidden) {
      setSidebarHiddenPersisted(false)
    }
  }

  return (
    <div className={sidebarHidden ? 'app-shell sidebar-hidden' : 'app-shell'}>
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <Link to="/dashboard" className="brand-mark">
            <img
              src="/logo.png"
              alt="Daegu Catholic University Medical Center"
              className="brand-logo"
              style={{ filter: `brightness(0.5) saturate(100%) invert(100%) hue-rotate(190deg)` }}
            />
          </Link>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="sidebar-link"
                activeProps={{ className: 'sidebar-link is-active' }}
                aria-label={item.label}
                title={item.label}
                onClick={handleNavClick(item)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-status">
          <div className="status-row">
            <span className="status-dot" />
            <span>System online</span>
          </div>
          <p>Ready for Unity WebGL, site metadata, and live sensor data.</p>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow"></p>
            <h1></h1>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <span className="sr-only">Search</span>
              <input type="search" placeholder="Search rooms, assets, sensors" />
            </label>
            <button className="icon-button" type="button" aria-label="Alerts">
              <Bell size={18} />
            </button>
            <div className="user-menu">
              <span className="user-avatar">{isPending ? '' : userInitial}</span>
              <div className="user-copy">
                <strong>{session?.user.name || 'Signed in'}</strong>
                <span>{session?.user.email || 'Loading account'}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await authClient.signOut()
                  await router.invalidate()
                  await router.navigate({ to: '/login' })
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="content-area">{children}</main>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
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
    </div>
  )
}
