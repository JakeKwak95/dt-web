import { createFileRoute } from '@tanstack/react-router'
import { getAuditActor } from '#/server/unity-object-audit'
import { canUseStudio, getUserAuthority } from '#/server/user-authority'

export const Route = createFileRoute('/api/unity/userAuthority')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const actor = await getAuditActor(request)
          const authority = actor ? await getUserAuthority(actor.id) : null

          return Response.json({
            result: 'success',
            loggedIn: actor !== null,
            authority,
            // Studio requires a login; logged-in users without an assigned
            // authority stay unrestricted.
            canUseStudio: actor !== null && canUseStudio(authority),
          })
        } catch (error) {
          return Response.json(
            {
              result: 'fail',
              message:
                error instanceof Error
                  ? error.message
                  : 'Authority request failed',
            },
            { status: 400 },
          )
        }
      },
    },
  },
})
