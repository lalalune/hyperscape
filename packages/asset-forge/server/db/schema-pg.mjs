/**
 * Asset Forge Database Schema - PostgreSQL (Neon)
 * 
 * PostgreSQL database schema for user accounts, projects, and asset management
 */

import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Users Table - Account authentication and authorization
 *
 * Stores user accounts with Privy authentication
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  name: text('name').notNull(),
  avatar: text('avatar'),
  privyUserId: text('privy_user_id').unique(),
  farcasterFid: text('farcaster_fid'),
  walletAddress: text('wallet_address'),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }), // Team membership
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  isActive: boolean('is_active').notNull().default(true),
})

/**
 * Teams Table - User teams and collaboration groups
 *
 * Teams allow users to collaborate and share API limits
 */
export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  inviteCode: text('invite_code').unique().notNull(), // Code users use to join the team
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // Team creator
  maxMembers: integer('max_members').notNull().default(10), // Team size limit
  memberCount: integer('member_count').notNull().default(1), // Current member count
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * Projects Table - Asset generation projects
 * 
 * Each project is a collection of related assets (character set, weapon pack, etc.)
 */
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }), // Project can belong to a team
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'character' | 'weapon' | 'armor' | 'item' | 'environment' | 'mixed'

  // Game style and type for AI context
  gameStyle: text('game_style'), // 'pixel-art' | 'low-poly' | 'realistic' | 'stylized' | 'cartoon' | 'anime' | 'voxel' | 'hand-painted'
  gameType: text('game_type'), // 'rpg' | 'fps' | 'strategy' | 'platformer' | 'mmo' | 'battle-royale' | 'moba' | 'racing' | 'survival'
  artDirection: text('art_direction'), // Additional context for generation (e.g., "dark fantasy", "sci-fi", "medieval")

  tags: text('tags'), // JSON array of tags
  thumbnail: text('thumbnail'), // URL or base64
  assetCount: integer('asset_count').notNull().default(0),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * Assets Table - Generated 3D assets
 * 
 * Stores metadata for all generated assets
 */
export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'character' | 'weapon' | 'armor' | 'item' | 'prop'
  category: text('category'), // More specific: 'sword', 'helmet', 'npc', etc.
  
  // File paths
  glbPath: text('glb_path'), // Path to GLB file
  thumbnailPath: text('thumbnail_path'), // Path to preview image
  conceptArtPath: text('concept_art_path'), // Path to concept art
  
  // Generation metadata
  prompt: text('prompt'), // Original generation prompt
  meshyTaskId: text('meshy_task_id'), // Meshy.ai task ID
  generationSettings: text('generation_settings'), // JSON of generation parameters
  
  // Stats
  vertexCount: integer('vertex_count'),
  triangleCount: integer('triangle_count'),
  fileSize: integer('file_size'), // Bytes
  
  // Asset properties (JSON)
  properties: text('properties'), // Custom properties (stats, materials, etc.)
  tags: text('tags'), // JSON array of tags
  
  // Status
  status: text('status').notNull().default('pending'), // 'pending' | 'generating' | 'completed' | 'failed'
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * Voice Profiles Table - Generated voice profiles for NPCs
 * 
 * Stores ElevenLabs voice assignments and generated audio
 */
export const voiceProfiles = pgTable('voice_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  
  name: text('name').notNull(),
  description: text('description'),
  
  // ElevenLabs settings
  elevenLabsVoiceId: text('elevenlabs_voice_id').notNull(),
  voiceName: text('voice_name'), // Name of the ElevenLabs voice
  voiceSettings: text('voice_settings'), // JSON: stability, similarity, style, etc.
  
  // Generated audio clips
  audioClips: text('audio_clips'), // JSON array of generated clips
  totalClips: integer('total_clips').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/**
 * Generation History Table - Track all generation requests
 * 
 * Audit log for API usage and billing
 */
export const generationHistory = pgTable('generation_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  
  generationType: text('generation_type').notNull(), // 'text-to-3d' | 'image-to-3d' | 'retexture' | 'voice' | 'concept-art'
  provider: text('provider').notNull(), // 'meshy' | 'openai' | 'elevenlabs'
  
  prompt: text('prompt'),
  settings: text('settings'), // JSON of generation parameters
  
  status: text('status').notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage: text('error_message'),
  
  // Cost tracking
  creditsUsed: integer('credits_used').notNull().default(1),
  
  // Timing
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // Milliseconds
})

/**
 * API Keys Table - Store encrypted API keys per user
 * 
 * Allows users to use their own API keys for generation services
 */
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  provider: text('provider').notNull(), // 'openai' | 'meshy' | 'elevenlabs'
  encryptedKey: text('encrypted_key').notNull(), // Encrypted API key
  
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * Sessions Table - Track user sessions
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
})

/**
 * Admin Whitelist Table - Whitelisted wallet addresses for admin access
 *
 * Allows specific wallet addresses to have admin privileges
 */
export const adminWhitelist = pgTable('admin_whitelist', {
  id: text('id').primaryKey(),
  walletAddress: text('wallet_address').notNull().unique(), // Ethereum wallet address
  addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }), // Which admin added this address
  reason: text('reason'), // Why this wallet was whitelisted
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // Optional expiration
})

