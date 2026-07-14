import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { oneTimeToken } from 'better-auth/plugins/one-time-token'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from '#/db/index'
import * as schema from '#/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // one-time-token: carries a login across origins (dev → production, or an
  // external portal → this site). Tokens are single-use, expire in 3 minutes,
  // and both deployments share the DB, so verify works on either side.
  plugins: [oneTimeToken({ storeToken: 'hashed' }), tanstackStartCookies()],
})
