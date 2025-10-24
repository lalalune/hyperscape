/**
 * Drizzle Kit Configuration
 * For database migrations and schema management
 */

import 'dotenv/config'

export default {
  schema: './server/db/schema.mjs',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  verbose: true,
  strict: true
}
