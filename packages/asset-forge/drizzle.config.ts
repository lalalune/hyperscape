import type { Config } from 'drizzle-kit'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local and .env
dotenv.config({ path: '.env.local' })
dotenv.config()

export default {
  schema: './server/db/schema-pg.mjs',
  out: './server/db/migrations-pg',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config

