import { count, countDistinct, gte, max } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  studioAssetCatalog,
  unityObjectAuditLog,
  unityObjects,
  user,
} from '#/db/schema'

// Aggregates for the dashboard metric cards. React-only caller, plain JSON.
export async function loadDashboardStats() {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [objectRows, weekChangeRows, lastChangeRows, catalogRows, editorRows, userRows] =
      await Promise.all([
        db
          .select({
            placedObjects: count(),
            buildings: countDistinct(unityObjects.buildingId),
          })
          .from(unityObjects),
        db
          .select({ weekChanges: count() })
          .from(unityObjectAuditLog)
          .where(gte(unityObjectAuditLog.occurredAt, weekAgo)),
        db
          .select({ lastChangeAt: max(unityObjectAuditLog.occurredAt) })
          .from(unityObjectAuditLog),
        db
          .select({
            catalogAssets: count(),
            catalogCategories: countDistinct(studioAssetCatalog.category),
          })
          .from(studioAssetCatalog),
        db
          // countDistinct skips NULL actors, so anonymous saves don't count.
          .select({ weekEditors: countDistinct(unityObjectAuditLog.actorUserId) })
          .from(unityObjectAuditLog)
          .where(gte(unityObjectAuditLog.occurredAt, weekAgo)),
        db.select({ registeredUsers: count() }).from(user),
      ])

    return Response.json({
      result: 'success',
      stats: {
        placedObjects: objectRows[0]?.placedObjects ?? 0,
        buildings: objectRows[0]?.buildings ?? 0,
        weekChanges: weekChangeRows[0]?.weekChanges ?? 0,
        lastChangeAt: lastChangeRows[0]?.lastChangeAt?.toISOString() ?? null,
        catalogAssets: catalogRows[0]?.catalogAssets ?? 0,
        catalogCategories: catalogRows[0]?.catalogCategories ?? 0,
        weekEditors: editorRows[0]?.weekEditors ?? 0,
        registeredUsers: userRows[0]?.registeredUsers ?? 0,
      },
    })
  } catch (error) {
    return Response.json(
      {
        result: 'fail',
        message:
          error instanceof Error ? error.message : 'Stats request failed',
        stats: null,
      },
      { status: 400 },
    )
  }
}
