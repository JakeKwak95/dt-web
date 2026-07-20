import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/register')({
  component: DtsssRegistrationRedirect,
})

function DtsssRegistrationRedirect() {
  useEffect(() => {
    window.location.replace('/login.do')
  }, [])

  return (
    <main className="auth-page">
      User accounts are managed by DTSSS. Opening the DTSSS login…
    </main>
  )
}
