import { createFileRoute } from '@tanstack/react-router'
import { loadStudioAssetCatalog } from '#/server/studio-assets'

export const Route = createFileRoute('/api/unity/assetCatalog.do')({
  server: {
    handlers: {
      GET: async () => loadStudioAssetCatalog(),
    },
  },
})
