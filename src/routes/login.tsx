import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/login')({
  component: DtsssLoginRedirect,
})

function DtsssLoginRedirect() {
  useEffect(() => {
    window.location.replace('/login.do')
  }, [])

  return <main className="auth-page">Opening the DTSSS login…</main>
}
