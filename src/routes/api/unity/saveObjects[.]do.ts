import { createFileRoute } from '@tanstack/react-router'
import { inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db/index'
import { unityObjectAuditLog, unityObjects } from '#/db/schema'
import {
  getAuditActor,
  getAuditRequestMetadata,
  getChangedUnityObjectFields,
  toUnityObjectAuditState,
} from '#/server/unity-object-audit'

type UnityObjectAuditInput = typeof unityObjectAuditLog.$inferInsert

// Unity applies a whole staged edit session ("Apply") in one request: the
// deleted ids plus every dirty object, all committed in one transaction and
// audited under a shared changeSetId.
const batchObjectSchema = z.object({
  id: z.number().int(),
  category: z.string().min(1),
  buildingId: z.string().min(1),
  objIndex: z.number().int(),
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  rotX: z.number(),
  rotY: z.number(),
  rotZ: z.number(),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  scaleZ: z.number().default(1),
})

const batchPayloadSchema = z.object({
  deletedIds: z.array(z.number().int()).default([]),
  objects: z.array(batchObjectSchema).default([]),
})

export const Route = createFileRoute('/api/unity/saveObjects.do')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const actor = await getAuditActor(request)
          const form = await request.formData()
          const payload = readBatchPayloadForm(form)
          const requestMetadata = getAuditRequestMetadata(request)
          const changeSetId = crypto.randomUUID()

          const actorFields = {
            actorUserId: actor?.id ?? null,
            actorName: actor?.name ?? null,
            actorEmail: actor?.email ?? null,
          }

          const counts = await db.transaction(async (tx) => {
            const affectedIds = [
              ...payload.deletedIds,
              ...payload.objects.map((object) => object.id),
            ]
            const existingRows = affectedIds.length
              ? await tx
                  .select()
                  .from(unityObjects)
                  .where(inArray(unityObjects.id, affectedIds))
              : []
            const existingById = new Map(existingRows.map((row) => [row.id, row]))

            const auditRows: Array<UnityObjectAuditInput> = []

            let deleteCnt = 0
            if (payload.deletedIds.length > 0) {
              const deletedRows = await tx
                .delete(unityObjects)
                .where(inArray(unityObjects.id, payload.deletedIds))
                .returning({ id: unityObjects.id })
              deleteCnt = deletedRows.length

              for (const deleted of deletedRows) {
                const existing = existingById.get(deleted.id)
                if (!existing) continue

                auditRows.push({
                  objectId: existing.id,
                  ...actorFields,
                  action: 'delete',
                  buildingId: existing.buildingId,
                  objIndex: existing.objIndex,
                  beforeState: toUnityObjectAuditState(existing),
                  afterState: null,
                  changedFields: [],
                  changeSetId,
                  source: 'unity-webgl',
                  ...requestMetadata,
                })
              }
            }

            let savedCnt = 0
            if (payload.objects.length > 0) {
              const savedRows = await tx
                .insert(unityObjects)
                .values(payload.objects)
                .onConflictDoUpdate({
                  target: unityObjects.id,
                  set: {
                    category: sql`excluded.category`,
                    buildingId: sql`excluded.building_id`,
                    objIndex: sql`excluded.obj_index`,
                    posX: sql`excluded.pos_x`,
                    posY: sql`excluded.pos_y`,
                    posZ: sql`excluded.pos_z`,
                    rotX: sql`excluded.rot_x`,
                    rotY: sql`excluded.rot_y`,
                    rotZ: sql`excluded.rot_z`,
                    scaleX: sql`excluded.scale_x`,
                    scaleY: sql`excluded.scale_y`,
                    scaleZ: sql`excluded.scale_z`,
                    updatedAt: new Date(),
                  },
                })
                .returning()
              savedCnt = savedRows.length

              for (const saved of savedRows) {
                const existing = existingById.get(saved.id)
                const changedFields = getChangedUnityObjectFields(existing, saved)
                if (changedFields.length === 0) continue

                auditRows.push({
                  objectId: saved.id,
                  ...actorFields,
                  action: existing ? 'update' : 'create',
                  buildingId: saved.buildingId,
                  objIndex: saved.objIndex,
                  beforeState: existing ? toUnityObjectAuditState(existing) : null,
                  afterState: toUnityObjectAuditState(saved),
                  changedFields,
                  changeSetId,
                  source: 'unity-webgl',
                  ...requestMetadata,
                })
              }
            }

            if (auditRows.length > 0) {
              await tx.insert(unityObjectAuditLog).values(auditRows)
            }

            return { savedCnt, deleteCnt }
          })

          return Response.json({
            result: 'success',
            changeSetId,
            savedCnt: counts.savedCnt,
            deleteCnt: counts.deleteCnt,
          })
        } catch (error) {
          return Response.json(
            {
              result: 'fail',
              message:
                error instanceof Error ? error.message : 'Batch save request failed',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})

function readBatchPayloadForm(form: FormData) {
  const raw = form.get('payload')
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('Missing form field: payload')
  }

  return batchPayloadSchema.parse(JSON.parse(raw))
}
