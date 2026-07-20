import { useEffect, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Activity, LogIn, Map, Settings } from 'lucide-react'
import {
  getDtsssSession,
  submitDtsssLogout,
} from '#/lib/dtsss-session'
import type { DtsssSession } from '#/lib/dtsss-session'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: Activity },
  { to: '/digital-twin', label: 'Digital twin', shortLabel: 'Twin', icon: Map },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
] as const

function TopbarAuth() {
  const [session, setSession] = useState<DtsssSession | null>(null)

  useEffect(() => {
    void getDtsssSession().then(setSession).catch(() => setSession(null))
  }, [])

  if (!session) return null

  if (session.loggedIn && session.user) {
    return (
      <div className="topbar-auth">
        <span className="topbar-auth-name">{session.user.name}</span>
        <span className="pill">{session.authority?.authNm ?? 'No authority'}</span>
        <button
          type="button"
          className="secondary-action"
          onClick={() => submitDtsssLogout(session)}
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <a href="/login.do" className="secondary-action">
      <LogIn size={15} />
      Login
    </a>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (pathname === '/login' || pathname === '/register') {
    return <>{children}</>
  }

  // The digital-twin page hosts the Unity app, which brings its own UI —
  // hide the web topbar so the viewer gets the full viewport.
  const hideTopbar = pathname === '/digital-twin'

  return (
    <div className="app-main">
      {!hideTopbar && (
        <header className="topbar">
          <div className="topbar-brand">
            <Link to="/dashboard" aria-label="Open dashboard">
              <img
                src="/logo.png"
                alt="Daegu Catholic University Medical Center"
                style={{ filter: 'brightness(0.5) saturate(100%) invert(100%) hue-rotate(190deg)' }}
              />
            </Link>
          </div>

          <div className="topbar-toolbar" />

          <div className="topbar-actions">
            <TopbarAuth />
          </div>
        </header>
      )}

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
