import { desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { studioAssetCatalog, unityObjectAuditLog } from '#/db/schema'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// Read side of the audit log for the dashboard change-log panel. Called only
// by the React app, so plain JSON (no Unity .do form conventions).
export async function loadUnityObjectChangeLog(request: Request) {
  try {
    const url = new URL(request.url)
    const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
    const limit = Number.isInteger(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT
    const rawAction = url.searchParams.get('action')
    const action =
      rawAction === 'create' || rawAction === 'update' || rawAction === 'delete'
        ? rawAction
        : null

    const rows = await db
      .select({
        id: unityObjectAuditLog.id,
        objectId: unityObjectAuditLog.objectId,
        action: unityObjectAuditLog.action,
        occurredAt: unityObjectAuditLog.occurredAt,
        actorName: unityObjectAuditLog.actorName,
        actorEmail: unityObjectAuditLog.actorEmail,
        buildingId: unityObjectAuditLog.buildingId,
        objIndex: unityObjectAuditLog.objIndex,
        changedFields: unityObjectAuditLog.changedFields,
        changeSetId: unityObjectAuditLog.changeSetId,
        source: unityObjectAuditLog.source,
        typeName: studioAssetCatalog.name,
      })
      .from(unityObjectAuditLog)
      .leftJoin(
        studioAssetCatalog,
        eq(unityObjectAuditLog.objIndex, studioAssetCatalog.objIndex),
      )
      .where(action ? eq(unityObjectAuditLog.action, action) : undefined)
      .orderBy(desc(unityObjectAuditLog.occurredAt), desc(unityObjectAuditLog.id))
      .limit(limit)

    return Response.json({
      result: 'success',
      rows,
    })
  } catch (error) {
    return Response.json(
      {
        result: 'fail',
        message:
          error instanceof Error ? error.message : 'Change log request failed',
        rows: [],
      },
      { status: 400 },
    )
  }
}
