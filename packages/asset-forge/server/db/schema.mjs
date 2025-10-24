/**
 * Database Schema for Asset Forge
 *
 * PostgreSQL schema with pgvector extension for semantic search
 * Uses Drizzle ORM for type-safe database operations
 *
 * Tables:
 * - users: User authentication and profiles
 * - assets: 3D asset catalog with metadata
 * - asset_embeddings: Vector embeddings for semantic search
 * - generations: Generation history and analytics
 * - voice_profiles: Voice generation profiles
 * - api_keys: API key management
 */

import { pgTable, text, timestamp, integer, jsonb, boolean, uuid, varchar, serial, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Users table
 * Stores user authentication and profile data
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  privyId: varchar('privy_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }),
  walletAddress: varchar('wallet_address', { length: 42 }),
  farcasterFid: varchar('farcaster_fid', { length: 100 }),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 50 }).notNull().default('user'), // user, admin, developer
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at')
}, (table) => ({
  privyIdIdx: index('privy_id_idx').on(table.privyId),
  emailIdx: index('email_idx').on(table.email),
  walletIdx: index('wallet_address_idx').on(table.walletAddress)
}))

/**
 * Assets table
 * Catalog of all 3D assets with metadata
 */
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: varchar('asset_id', { length: 255 }).unique().notNull(), // e.g., "sword-bronze-001"
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull(), // weapon, armor, character, etc.
  tags: jsonb('tags').default([]), // Array of tags for filtering

  // Storage URLs
  modelUrl: text('model_url').notNull(), // Main GLB file
  modelUrlRaw: text('model_url_raw'), // Pre-normalized GLB
  modelUrlRigged: text('model_url_rigged'), // Rigged version
  conceptArtUrl: text('concept_art_url'),
  thumbnailUrl: text('thumbnail_url'),

  // Metadata
  metadata: jsonb('metadata').default({}), // Full metadata.json
  prompt: text('prompt'), // Generation prompt
  stylePreset: varchar('style_preset', { length: 100 }),

  // File info
  fileSize: integer('file_size'), // bytes
  vertexCount: integer('vertex_count'),
  triangleCount: integer('triangle_count'),

  // Generation info
  meshyTaskId: varchar('meshy_task_id', { length: 255 }),
  generatedBy: uuid('generated_by').references(() => users.id),
  generatedAt: timestamp('generated_at'),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, archived, deleted
  isPublic: boolean('is_public').notNull().default(true),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  assetIdIdx: index('asset_id_idx').on(table.assetId),
  categoryIdx: index('category_idx').on(table.category),
  statusIdx: index('status_idx').on(table.status),
  generatedByIdx: index('generated_by_idx').on(table.generatedBy)
}))

/**
 * Asset Embeddings table
 * Vector embeddings for semantic search using pgvector
 * Embeddings are generated from asset name, description, tags, and prompt
 */
export const assetEmbeddings = pgTable('asset_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),

  // Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding: sql`vector(1536)`,

  // Source text used to generate embedding
  sourceText: text('source_text'),

  // Embedding metadata
  model: varchar('model', { length: 100 }).notNull().default('text-embedding-3-small'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  assetIdIdx: index('asset_embedding_asset_id_idx').on(table.assetId),
  // HNSW index for fast vector similarity search
  embeddingIdx: index('embedding_idx').using('hnsw', table.embedding, sql`vector_cosine_ops`)
}))

/**
 * Generations table
 * Track all generation attempts and their results
 */
export const generations = pgTable('generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),

  // Generation input
  type: varchar('type', { length: 50 }).notNull(), // text-to-3d, image-to-3d, retexture, etc.
  prompt: text('prompt'),
  referenceImageUrl: text('reference_image_url'),
  stylePreset: varchar('style_preset', { length: 100 }),
  parameters: jsonb('parameters').default({}),

  // Generation output
  assetId: uuid('asset_id').references(() => assets.id),
  status: varchar('status', { length: 50 }).notNull(), // pending, processing, completed, failed
  error: text('error'),

  // Pipeline tracking
  meshyTaskId: varchar('meshy_task_id', { length: 255 }),
  pipelineId: varchar('pipeline_id', { length: 255 }),
  steps: jsonb('steps').default([]), // Array of pipeline steps

  // Timing
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // milliseconds

  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('generation_user_id_idx').on(table.userId),
  statusIdx: index('generation_status_idx').on(table.status),
  typeIdx: index('generation_type_idx').on(table.type),
  createdAtIdx: index('generation_created_at_idx').on(table.createdAt)
}))

/**
 * Voice Profiles table
 * Voice generation profiles for NPCs and characters
 */
export const voiceProfiles = pgTable('voice_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: varchar('entity_id', { length: 255 }).notNull(), // NPC ID, character ID, etc.
  entityType: varchar('entity_type', { length: 50 }).notNull(), // npc, character, mob

  // Voice configuration
  name: varchar('name', { length: 255 }).notNull(),
  voiceId: varchar('voice_id', { length: 255 }).notNull(), // ElevenLabs voice ID
  voiceSettings: jsonb('voice_settings').default({}),

  // Sample audio
  sampleAudioUrl: text('sample_audio_url'),

  // Usage tracking
  characterCount: integer('character_count').default(0),
  generationCount: integer('generation_count').default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => ({
  entityIdx: index('voice_profile_entity_idx').on(table.entityType, table.entityId),
  voiceIdIdx: index('voice_profile_voice_id_idx').on(table.voiceId)
}))

/**
 * API Keys table
 * Manage API keys for external service access
 */
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

  // Key info
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(), // SHA-256 hash
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(), // First 8 chars for display

  // Permissions
  scopes: jsonb('scopes').default([]), // Array of permission scopes

  // Rate limiting
  rateLimit: integer('rate_limit').default(100), // requests per hour

  // Status
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => ({
  userIdIdx: index('api_key_user_id_idx').on(table.userId),
  keyHashIdx: index('api_key_hash_idx').on(table.keyHash),
  isActiveIdx: index('api_key_active_idx').on(table.isActive)
}))

/**
 * Sessions table
 * User session management (for non-Privy sessions if needed)
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  sessionToken: varchar('session_token', { length: 255 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),

  // Session metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow()
}, (table) => ({
  sessionTokenIdx: index('session_token_idx').on(table.sessionToken),
  userIdIdx: index('session_user_id_idx').on(table.userId),
  expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt)
}))
