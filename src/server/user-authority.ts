import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { tnAuth, user } from '#/db/schema'

// 근무자 tier and below (higher auth_sn = lower rank) may not edit in Studio.
const STUDIO_BLOCKED_FROM_AUTH_SN = 5

export interface UserAuthority {
  authId: string
  authNm: string
  authSn: number
  useYn: string
}

export async function getUserAuthority(
  userId: string,
): Promise<UserAuthority | null> {
  const rows = await db
    .select({
      authId: tnAuth.authId,
      authNm: tnAuth.authNm,
      authSn: tnAuth.authSn,
      useYn: tnAuth.useYn,
    })
    .from(user)
    .innerJoin(tnAuth, eq(user.authId, tnAuth.authId))
    .where(eq(user.id, userId))
    .limit(1)

  return rows.at(0) ?? null
}

// Users without an assigned authority keep full access — accounts predate the
// authority system and must not lock themselves out.
export function canUseStudio(authority: UserAuthority | null) {
  if (!authority) return true
  return authority.authSn < STUDIO_BLOCKED_FROM_AUTH_SN
}

// Shared guard for the Unity mutation endpoints. Returns an error response
// when the caller may not edit, null when the request may proceed. Editing
// requires a login (the Unity iframe is same-origin, so the web session
// cookie rides along on Unity's requests) plus a sufficient authority tier.
export async function denyIfActorLacksStudioAccess(
  actor: { id: string } | null,
) {
  if (!actor) {
    return Response.json(
      { result: 'fail', message: 'Login required to edit objects' },
      { status: 401 },
    )
  }

  const authority = await getUserAuthority(actor.id)
  if (canUseStudio(authority)) return null

  return Response.json(
    {
      result: 'fail',
      message: `No permission to edit objects (${authority?.authNm ?? 'unknown'})`,
    },
    { status: 403 },
  )
}
