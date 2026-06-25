import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db/index'
import { desc } from 'drizzle-orm'
import { unityObjects } from '#/db/schema'

const getUnityObjects = createServerFn({
  method: 'GET',
}).handler(async () => {
  return await db.query.unityObjects.findMany({
    orderBy: [desc(unityObjects.id)],
  })
})

const createUnityObject = createServerFn({
  method: 'POST',
})
  .validator((data: { category: string; buildingId: string; objIndex: number }) => data)
  .handler(async ({ data }) => {
    await db.insert(unityObjects).values({
      category: data.category,
      buildingId: data.buildingId,
      objIndex: data.objIndex,
      posX: 0,
      posY: 0,
      posZ: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
    })
    return { success: true }
  })

export const Route = createFileRoute('/demo/drizzle')({
  component: DemoDrizzle,
  loader: async () => await getUnityObjects(),
})

function DemoDrizzle() {
  const router = useRouter()
  const unityObjectItems = Route.useLoaderData()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const category = formData.get('category') as string
    const buildingId = formData.get('buildingId') as string
    const objIndex = Number.parseInt(formData.get('objIndex') as string, 10)

    if (!category || !buildingId || !Number.isInteger(objIndex)) return

    try {
      await createUnityObject({ data: { category, buildingId, objIndex } })
      router.invalidate()
      ;(e.target as HTMLFormElement).reset()
    } catch (error) {
      console.error('Failed to create todo:', error)
    }
  }

  return (
    <main className="demo-page demo-center">
      <section className="demo-panel w-full max-w-2xl">
        <header className="mb-8 flex items-center gap-4">
          <span className="demo-card flex h-14 w-14 items-center justify-center p-3">
            <img src="/drizzle.svg" alt="Drizzle Logo" className="h-8 w-8" />
          </span>
          <div>
            <p className="island-kicker mb-2">Database</p>
            <h1 className="demo-title">Drizzle Demo</h1>
          </div>
        </header>

        <h2 className="demo-section-title mb-4">Unity Objects</h2>

        <ul className="space-y-3 mb-6">
          {unityObjectItems.map((item) => (
            <li key={item.id} className="demo-list-item">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {item.category} / {item.buildingId}
                </span>
                <span className="demo-muted text-xs">
                  #{item.id} obj {item.objIndex}
                </span>
              </div>
            </li>
          ))}
          {unityObjectItems.length === 0 && (
            <li className="demo-list-item text-center demo-muted">
              No Unity objects saved yet. Create one below!
            </li>
          )}
        </ul>

        <form
          onSubmit={handleSubmit}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_auto]"
        >
          <input
            type="text"
            name="category"
            placeholder="Category"
            className="demo-input min-w-0 flex-1"
          />
          <input
            type="text"
            name="buildingId"
            placeholder="Building ID"
            className="demo-input min-w-0 flex-1"
          />
          <input
            type="number"
            name="objIndex"
            placeholder="Index"
            className="demo-input min-w-0 flex-1"
          />
          <button type="submit" className="demo-button whitespace-nowrap">
            Add
          </button>
        </form>

        <div className="demo-card mt-8">
          <h3 className="demo-section-title mb-2">Powered by Drizzle ORM</h3>
          <p className="demo-muted mb-4 text-sm">
            Next-generation ORM for Node.js & TypeScript with PostgreSQL
          </p>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Setup Instructions:</p>
            <ol className="demo-muted list-inside list-decimal space-y-2">
              <li>
                Configure your <code>DATABASE_URL</code> in .env.local
              </li>
              <li>
                Run: <code>npx -y drizzle-kit generate</code>
              </li>
              <li>
                Run: <code>npx -y drizzle-kit migrate</code>
              </li>
              <li>
                Optional: <code>npx -y drizzle-kit studio</code>
              </li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  )
}
