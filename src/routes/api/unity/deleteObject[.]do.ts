import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { unityObjectAuditLog, unityObjects } from '#/db/schema'
import {
  getAuditActor,
  getAuditRequestMetadata,
  toUnityObjectAuditState,
} from '#/server/unity-object-audit'
import { denyIfActorLacksStudioAccess } from '#/server/user-authority'

export const Route = createFileRoute('/api/unity/deleteObject.do')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const actor = await getAuditActor(request)
          const denied = await denyIfActorLacksStudioAccess(actor)
          if (denied) return denied
          const form = await request.formData()
          const id = readInt(form, 'id')
          const requestMetadata = getAuditRequestMetadata(request)
          const deleteCnt = await db.transaction(async (tx) => {
            const existingRows = await tx
              .select()
              .from(unityObjects)
              .where(eq(unityObjects.id, id))
              .limit(1)
            const existing = existingRows.at(0)

            if (!existing) return 0

            const deletedRows = await tx
              .delete(unityObjects)
              .where(eq(unityObjects.id, id))
              .returning({ id: unityObjects.id })

            if (deletedRows.length === 0) return 0

            await tx.insert(unityObjectAuditLog).values({
              objectId: existing.id,
              actorUserId: actor?.id ?? null,
              actorName: actor?.name ?? null,
              actorEmail: actor?.email ?? null,
              action: 'delete',
              buildingId: existing.buildingId,
              objIndex: existing.objIndex,
              beforeState: toUnityObjectAuditState(existing),
              afterState: null,
              changedFields: [],
              source: 'unity-webgl',
              ...requestMetadata,
            })

            return deletedRows.length
          })

          return Response.json({
            result: 'success',
            id,
            deleteCnt,
          })
        } catch (error) {
          return Response.json(
            {
              result: 'fail',
              message:
                error instanceof Error ? error.message : 'Delete request failed',
              deleteCnt: 0,
            },
            { status: 400 },
          )
        }
      },
    },
  },
})

function readInt(form: FormData, key: string) {
  const raw = form.get(key)
  if (typeof raw !== 'string') {
    throw new Error(`Missing form field: ${key}`)
  }

  const value = Number.parseInt(raw, 10)
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer form field: ${key}`)
  }

  return value
}
