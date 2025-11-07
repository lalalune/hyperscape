/**
 * Projects Schema
 * Project management and organization
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

/**
 * Projects table
 * Organizational units for grouping assets and content
 */
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Ownership
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Status: 'active' | 'archived' | 'deleted'
  status: varchar('status', { length: 50 }).notNull().default('active'),

  // Project settings and metadata
  settings: jsonb('settings').notNull().default({}),
  metadata: jsonb('metadata').notNull().default({}),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (table) => ({
  ownerIdx: index('idx_projects_owner').on(table.ownerId),
  statusIdx: index('idx_projects_status').on(table.status),
}))

// Type exports
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
