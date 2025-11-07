/**
 * Users Schema
 * Authentication and user management tables
 */

import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Users table
 * Stores user profiles and authentication data from Privy
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  privyUserId: varchar('privy_user_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }),
  walletAddress: varchar('wallet_address', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 512 }),

  // Role: 'admin' | 'member'
  role: varchar('role', { length: 50 }).notNull().default('member'),

  // User preferences and settings (JSON)
  settings: jsonb('settings').notNull().default({}),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
  privyUserIdIdx: index('idx_users_privy_id').on(table.privyUserId),
  emailIdx: index('idx_users_email').on(table.email),
  walletIdx: index('idx_users_wallet').on(table.walletAddress),
}))

/**
 * Admin whitelist table
 * Wallet addresses that should automatically get admin role
 */
export const adminWhitelist = pgTable('admin_whitelist', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletAddress: varchar('wallet_address', { length: 255 }).unique().notNull(),
  addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
  reason: varchar('reason', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  walletIdx: index('idx_admin_whitelist_wallet').on(table.walletAddress),
}))

/**
 * Activity log table
 * Audit trail for all user actions
 */
export const activityLog = pgTable('activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  action: varchar('action', { length: 100 }).notNull(), // created, updated, deleted, etc.
  details: jsonb('details').notNull().default({}),
  ipAddress: varchar('ip_address', { length: 45 }), // IPv6 compatible
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('idx_activity_user').on(table.userId),
  entityIdx: index('idx_activity_entity').on(table.entityType, table.entityId),
  actionIdx: index('idx_activity_action').on(table.action),
  createdIdx: index('idx_activity_created').on(table.createdAt.desc()),
}))

// Type exports for use in application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type AdminWhitelistEntry = typeof adminWhitelist.$inferSelect
export type ActivityLogEntry = typeof activityLog.$inferSelect
