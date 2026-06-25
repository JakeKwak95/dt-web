import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { unityObjects } from '#/db/schema'

export const Route = createFileRoute('/api/unity/deleteObject.do')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData()
          const id = readInt(form, 'id')
          const deletedRows = await db
            .delete(unityObjects)
            .where(eq(unityObjects.id, id))
            .returning({ id: unityObjects.id })

          return Response.json({
            result: 'success',
            id,
            deleteCnt: deletedRows.length,
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
