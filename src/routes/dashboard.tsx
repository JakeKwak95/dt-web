import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentSession } from '#/lib/session'
import DashboardOverview from '../features/dashboard/DashboardOverview'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session = await getCurrentSession()

    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  component: DashboardOverview,
})
