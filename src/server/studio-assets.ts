import { db } from '#/db/index'

export async function loadStudioAssetCatalog() {
  try {
    const rows = await db.query.studioAssetCatalog.findMany({
      orderBy: (catalog, { asc }) => asc(catalog.objIndex),
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
