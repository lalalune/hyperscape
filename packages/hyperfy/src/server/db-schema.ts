import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Config table for storing key-value pairs like version, spawn, settings
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  roles: text('roles').notNull().default(''),
  createdAt: text('createdAt').notNull(),
});

// Blueprints table
export const blueprints = sqliteTable('blueprints', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// Entities table (for app entities)
export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// Type exports for better type safety
export type Config = typeof config.$inferSelect
export type NewConfig = typeof config.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Blueprint = typeof blueprints.$inferSelect
export type NewBlueprint = typeof blueprints.$inferInsert
export type Entity = typeof entities.$inferSelect
export type NewEntity = typeof entities.$inferInsert
