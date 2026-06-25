import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index'
import { unityObjects } from '#/db/schema'

type UnityObjectInput = typeof unityObjects.$inferInsert

export const Route = createFileRoute('/api/unity/saveObject.do')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData()
          const values = readUnityObjectForm(form)

          await db
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
