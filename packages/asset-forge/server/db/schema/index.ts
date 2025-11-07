/**
 * Database Schema Index
 * Exports all schema tables and types
 */

// Users and authentication
export * from './users.schema'
export * from './projects.schema'
export * from './assets.schema'

// Re-export everything for drizzle
import * as usersSchema from './users.schema'
import * as projectsSchema from './projects.schema'
import * as assetsSchema from './assets.schema'

export const schema = {
  ...usersSchema,
  ...projectsSchema,
  ...assetsSchema,
}
