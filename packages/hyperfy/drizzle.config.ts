import type { Config } from 'drizzle-kit'

export default {
  schema: './src/server/db-schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.WORLD ? `./${process.env.WORLD}/db.sqlite` : './world/db.sqlite',
  },
} satisfies Config
