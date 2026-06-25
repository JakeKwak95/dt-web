import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { AlertCircle, Building2, X } from 'lucide-react'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { getCurrentSession } from '#/lib/session'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getCurrentSession()

    if (session?.user) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || 'Sign in failed')
        return
      }

      const session = await authClient.getSession()

      if (!session.data?.user) {
        setError('Sign in could not be verified. Please try again.')
        return
      }

      await router.invalidate()
      await router.navigate({ to: '/dashboard' })
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      {error && (
        <div className="auth-popup" role="alert" aria-live="assertive">
          <AlertCircle size={18} />
          <div>
            <strong>Login failed</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            aria-label="Close error message"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="auth-card">
        <header className="auth-header">
          <span className="brand-icon">
            <Building2 size={20} strokeWidth={2.2} />
          </span>
          <div>
            <p className="eyebrow">DT Control</p>
            <h1>Sign in</h1>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Please wait' : 'Sign in'}
          </button>
        </form>

        <Link
          to="/register"
          className="auth-mode-button"
        >
          Need an account? Create one
        </Link>
      </section>
    </main>
  )
}
