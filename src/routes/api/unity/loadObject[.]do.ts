import { createFileRoute } from '@tanstack/react-router'
import { loadUnityObjects } from '#/server/unity-objects'

export const Route = createFileRoute('/api/unity/loadObject.do')({
  server: {
    handlers: {
      GET: async ({ request }) => loadUnityObjects(request),
    },
  },
})
