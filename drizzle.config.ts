/**
 * Drizzle Kit Configuration
 * Auto-generates SQL migrations from TypeScript schema
 */

import type { Config } from 'drizzle-kit'
import 'dotenv/config'

export default {
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config
