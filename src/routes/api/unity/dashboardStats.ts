import { createFileRoute } from '@tanstack/react-router'
import { loadDashboardStats } from '#/server/dashboard-stats'

export const Route = createFileRoute('/api/unity/dashboardStats')({
  server: {
    handlers: {
      GET: async () => loadDashboardStats(),
    },
  },
})
