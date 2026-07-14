import {
  bigserial,
  boolean,
  char,
  inet,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Authority tiers (auth_sn: lower = higher rank; 근무자 = 5). Rows are managed
// directly in the DB for now — this mapping is read-only for the app.
export const tnAuth = pgTable('tn_auth', {
  authId: varchar('auth_id', { length: 20 }).primaryKey(),
  authNm: varchar('auth_nm', { length: 100 }).notNull(),
  authDc: varchar('auth_dc', { length: 500 }),
  authSn: integer('auth_sn').notNull().unique(),
  aprvlYn: char('aprvl_yn', { length: 1 }).notNull(),
  useYn: char('use_yn', { length: 1 }).notNull(),
  frstRegisterId: varchar('frst_register_id', { length: 100 }).notNull(),
  frstRegistDt: timestamp('frst_regist_dt').notNull(),
  lastUpdusrId: varchar('last_updusr_id', { length: 100 }).notNull(),
  lastUpdtDt: timestamp('last_updt_dt').notNull(),
})

export const studioAssetCatalog = pgTable('studio_asset_catalog', {
  id: serial().primaryKey(),
  name: text().notNull(),
  objIndex: integer('obj_index').notNull().unique(),
  category: text(),
})

export const unityObjects = pgTable('unity_objects', {
  id: serial().primaryKey(),
  category: text().notNull(),
  buildingId: text('building_id').notNull(),
  objIndex: integer('obj_index').notNull(),
  posX: real('pos_x').notNull(),
  posY: real('pos_y').notNull(),
  posZ: real('pos_z').notNull(),
  rotX: real('rot_x').notNull(),
  rotY: real('rot_y').notNull(),
  rotZ: real('rot_z').notNull(),
  scaleX: real('scale_x').notNull().default(1),
  scaleY: real('scale_y').notNull().default(1),
  scaleZ: real('scale_z').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text(),
  // Authority tier; null = unassigned, treated as unrestricted for now.
  authId: varchar('auth_id', { length: 20 }).references(() => tnAuth.authId),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text(),
  password: text(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const unityObjectAuditLog = pgTable('unity_object_audit_log', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  objectId: integer('object_id').notNull(),
  actorUserId: text('actor_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name'),
  actorEmail: text('actor_email'),
  action: text().notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  buildingId: text('building_id'),
  objIndex: integer('obj_index'),
  beforeState: jsonb('before_state').$type<Record<string, string | number>>(),
  afterState: jsonb('after_state').$type<Record<string, string | number>>(),
  changedFields: text('changed_fields').array().notNull(),
  changeSetId: uuid('change_set_id'),
  source: text().notNull().default('unity-webgl'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
})
