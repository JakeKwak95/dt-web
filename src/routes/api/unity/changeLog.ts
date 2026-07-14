import { createFileRoute } from '@tanstack/react-router'
import { loadUnityObjectChangeLog } from '#/server/unity-object-changelog'

export const Route = createFileRoute('/api/unity/changeLog')({
  server: {
    handlers: {
      GET: async ({ request }) => loadUnityObjectChangeLog(request),
    },
  },
})
