import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { unityObjectAuditLog, unityObjects } from '#/db/schema'
import {
  getAuditActor,
  getAuditRequestMetadata,
  getChangedUnityObjectFields,
  toUnityObjectAuditState,
} from '#/server/unity-object-audit'
import { denyIfActorLacksStudioAccess } from '#/server/user-authority'

type UnityObjectInput = typeof unityObjects.$inferInsert

export const Route = createFileRoute('/api/unity/saveObject.do')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const actor = await getAuditActor(request)
          const denied = await denyIfActorLacksStudioAccess(actor)
          if (denied) return denied
          const form = await request.formData()
          const values = readUnityObjectForm(form)
          const requestMetadata = getAuditRequestMetadata(request)

          await db.transaction(async (tx) => {
            const existingRows = await tx
              .select()
              .from(unityObjects)
              .where(eq(unityObjects.id, values.id!))
              .limit(1)
            const existing = existingRows.at(0)

            const savedRows = await tx
              .insert(unityObjects)
              .values(values)
              .onConflictDoUpdate({
                target: unityObjects.id,
                set: {
                  category: values.category,
                  buildingId: values.buildingId,
                  objIndex: values.objIndex,
                  posX: values.posX,
                  posY: values.posY,
                  posZ: values.posZ,
                  rotX: values.rotX,
                  rotY: values.rotY,
                  rotZ: values.rotZ,
                  scaleX: values.scaleX,
                  scaleY: values.scaleY,
                  scaleZ: values.scaleZ,
                  updatedAt: new Date(),
                },
              })
              .returning()
            const saved = savedRows.at(0)

            if (!saved) throw new Error('Saved object was not returned')

            const changedFields = getChangedUnityObjectFields(existing, saved)
            if (changedFields.length === 0) return

            await tx.insert(unityObjectAuditLog).values({
              objectId: saved.id,
              actorUserId: actor?.id ?? null,
              actorName: actor?.name ?? null,
              actorEmail: actor?.email ?? null,
              action: existing ? 'update' : 'create',
              buildingId: saved.buildingId,
              objIndex: saved.objIndex,
              beforeState: existing
                ? toUnityObjectAuditState(existing)
                : null,
              afterState: toUnityObjectAuditState(saved),
              changedFields,
              source: 'unity-webgl',
              ...requestMetadata,
            })
          })

          return Response.json({
            result: 'success',
            id: values.id,
            category: values.category,
            buildingId: values.buildingId,
            objIndex: values.objIndex,
          })
        } catch (error) {
          return Response.json(
            {
              result: 'fail',
              message:
                error instanceof Error ? error.message : 'Save request failed',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})

function readUnityObjectForm(form: FormData): UnityObjectInput {
  return {
    id: readInt(form, 'id'),
    category: readText(form, 'category'),
    buildingId: readText(form, 'buildingId'),
    objIndex: readInt(form, 'objIndex'),
    posX: readFloat(form, 'posX'),
    posY: readFloat(form, 'posY'),
    posZ: readFloat(form, 'posZ'),
    rotX: readFloat(form, 'rotX'),
    rotY: readFloat(form, 'rotY'),
    rotZ: readFloat(form, 'rotZ'),
    scaleX: readOptionalFloat(form, 'scaleX', 1),
    scaleY: readOptionalFloat(form, 'scaleY', 1),
    scaleZ: readOptionalFloat(form, 'scaleZ', 1),
  }
}

function readText(form: FormData, key: string) {
  const value = form.get(key)
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing form field: ${key}`)
  }

  return value
}

function readInt(form: FormData, key: string) {
  const value = Number.parseInt(readText(form, key), 10)
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer form field: ${key}`)
  }

  return value
}

function readFloat(form: FormData, key: string) {
  const value = Number.parseFloat(readText(form, key))
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid float form field: ${key}`)
  }

  return value
}

function readOptionalFloat(form: FormData, key: string, fallback: number) {
  const value = form.get(key)
  if (value === null || value === '') return fallback
  if (typeof value !== 'string') {
    throw new Error(`Invalid float form field: ${key}`)
  }

  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid float form field: ${key}`)
  }

  return parsed
}
