import { useEffect, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Activity, LogIn, Map, Settings } from 'lucide-react'
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

// Editing requires a login since the anonymous block — the topbar has to show
// whether you are logged in, which authority tier you hold, and the way in/out.
function TopbarAuth() {
  const { data: session, isPending } = authClient.useSession()
  const [authorityName, setAuthorityName] = useState<string | null>(null)

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) {
      setAuthorityName(null)
      return
    }

    fetch('/api/unity/userAuthority')
      .then((response) => response.json())
      .then((data) => {
        if (data.result === 'success') {
          setAuthorityName(data.authority?.authNm ?? null)
        }
      })
      .catch(() => {})
  }, [userId])

  if (isPending) return null

  if (session?.user) {
    return (
      <div className="topbar-auth">
        <span className="topbar-auth-name">{session.user.name}</span>
        <span className="pill">{authorityName ?? '권한 미지정'}</span>
        <button
          type="button"
          className="secondary-action"
          onClick={() => {
            // Reload so per-page authority gates re-evaluate.
            void authClient.signOut().then(() => window.location.reload())
          }}
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <Link to="/login" className="secondary-action">
      <LogIn size={15} />
      로그인
    </Link>
  )
}

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

        <div className="topbar-actions">
          <div className="topbar-actions-slot" id="topbar-mode-switch" />
          <TopbarAuth />
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
