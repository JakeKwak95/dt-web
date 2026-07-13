import { auth } from '#/lib/auth'
import type { unityObjects } from '#/db/schema'

type UnityObjectRow = typeof unityObjects.$inferSelect

const auditedFields = [
  'category',
  'buildingId',
  'objIndex',
  'posX',
  'posY',
  'posZ',
  'rotX',
  'rotY',
  'rotZ',
  'scaleX',
  'scaleY',
  'scaleZ',
] as const satisfies ReadonlyArray<keyof UnityObjectRow>

export async function getAuditActor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ?? null
}

export function getChangedUnityObjectFields(
  before: UnityObjectRow | undefined,
  after: UnityObjectRow,
) {
  if (!before) return [...auditedFields]

  return auditedFields.filter((field) => !Object.is(before[field], after[field]))
}

export function toUnityObjectAuditState(row: UnityObjectRow) {
  return {
    id: row.id,
    category: row.category,
    buildingId: row.buildingId,
    objIndex: row.objIndex,
    posX: row.posX,
    posY: row.posY,
    posZ: row.posZ,
    rotX: row.rotX,
    rotY: row.rotY,
    rotZ: row.rotZ,
    scaleX: row.scaleX,
    scaleY: row.scaleY,
    scaleZ: row.scaleZ,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function getAuditRequestMetadata(request: Request) {
  return {
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
  }
}

function getClientIp(request: Request) {
  const rawAddress =
    request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]
  const address = rawAddress?.trim()

  if (!address || !/^[0-9a-f.:]+$/i.test(address)) return null
  return address
}
