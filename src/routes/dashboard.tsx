import { createFileRoute } from '@tanstack/react-router'
import DashboardOverview from '../features/dashboard/DashboardOverview'

export const Route = createFileRoute('/dashboard')({
  component: DashboardOverview,
})
