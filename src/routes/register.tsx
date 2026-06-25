import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { getCurrentSession } from '#/lib/session'

export const Route = createFileRoute('/register')({
  beforeLoad: async () => {
    const session = await getCurrentSession()

    if (session?.user) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      })

      if (result.error) {
        setError(result.error.message || 'Registration failed')
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
      <section className="auth-card">
        <header className="auth-header">
          <span className="brand-icon">
            <Building2 size={20} strokeWidth={2.2} />
          </span>
          <div>
            <p className="eyebrow">DT Control</p>
            <h1>Create account</h1>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </label>

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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="primary-action" disabled={loading}>
            {loading ? 'Please wait' : 'Create account'}
          </button>
        </form>

        <Link to="/login" className="auth-mode-button">
          Already have an account? Sign in
        </Link>
      </section>
    </main>
  )
}
