import { and, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { unityObjects } from '#/db/schema'

export async function loadUnityObjects(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const category = url.searchParams.get('category')
    const buildingId = url.searchParams.get('buildingId')
    const filters = []

    if (id) filters.push(eq(unityObjects.id, Number.parseInt(id, 10)))
    if (category) filters.push(eq(unityObjects.category, category))
    if (buildingId) filters.push(eq(unityObjects.buildingId, buildingId))

    const rows = await db.query.unityObjects.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
    })

    return Response.json({
      result: 'success',
      rows,
    })
  } catch (error) {
    return Response.json(
      {
        result: 'fail',
        message: error instanceof Error ? error.message : 'Load request failed',
        rows: [],
      },
      { status: 400 },
    )
  }
}
