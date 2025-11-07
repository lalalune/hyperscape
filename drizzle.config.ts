/**
 * Drizzle Kit Configuration
 * Handles database migrations and schema management
 */

import type { Config } from 'drizzle-kit'

export default {
  schema: './packages/asset-forge/server/db/schema/index.ts',
  out: './packages/asset-forge/server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/asset_forge',
  },
  verbose: true,
  strict: true,
} satisfies Config
