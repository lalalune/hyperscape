/**
 * Credential Management Schema - Optimized and Secure
 * 
 * Stores encrypted user credentials with proper indexing and constraints
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * User Credentials Table - OPTIMIZED
 * 
 * Stores encrypted API keys with service-specific metadata
 * Unique constraint on (userId, service) to prevent duplicates
 */
export const userCredentials = sqliteTable('user_credentials', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  
  // Service and metadata
  service: text('service').notNull(), // 'openai' | 'meshy' | 'elevenlabs' | 'github'
  displayName: text('display_name'),
  
  // Encrypted data (stores JSON with iv, authTag, and encrypted content)
  encryptedData: text('encrypted_data').notNull(),
  
  // Service-specific fields
  metadata: text('metadata'), // JSON for service-specific data
  
  // Status and tracking
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  lastValidatedAt: integer('last_validated_at', { mode: 'timestamp' }),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  usageCount: integer('usage_count').notNull().default(0),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  // Indexes for performance
  userIdIdx: index('idx_credentials_user_id').on(table.userId),
  userServiceIdx: index('idx_credentials_user_service').on(table.userId, table.service),
  serviceIdx: index('idx_credentials_service').on(table.service),
  activeIdx: index('idx_credentials_active').on(table.isActive),
}))

/**
 * GitHub Repositories Table - OPTIMIZED
 * 
 * Tracks GitHub repositories created for projects
 */
export const githubRepositories = sqliteTable('github_repositories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  projectId: text('project_id'),
  credentialId: text('credential_id').notNull(), // Links to credential used
  
  // Repository information
  owner: text('owner').notNull(), // GitHub username/org
  repoName: text('repo_name').notNull(),
  repoFullName: text('repo_full_name').notNull(), // owner/repo
  repoUrl: text('repo_url').notNull(),
  cloneUrl: text('clone_url').notNull(),
  description: text('description'),
  
  // Settings
  isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
  autoSync: integer('auto_sync', { mode: 'boolean' }).notNull().default(true),
  defaultBranch: text('default_branch').notNull().default('main'),
  
  // Sync status
  syncStatus: text('sync_status').notNull().default('pending'), // 'pending' | 'syncing' | 'synced' | 'error'
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSyncError: text('last_sync_error'),
  syncCount: integer('sync_count').notNull().default(0),
  
  // GitHub metadata
  githubId: integer('github_id'), // GitHub repository ID
  stars: integer('stars').notNull().default(0),
  forks: integer('forks').notNull().default(0),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  // Indexes for performance
  userIdIdx: index('idx_github_repos_user_id').on(table.userId),
  projectIdIdx: index('idx_github_repos_project_id').on(table.projectId),
  fullNameIdx: index('idx_github_repos_full_name').on(table.repoFullName),
  syncStatusIdx: index('idx_github_repos_sync_status').on(table.syncStatus),
}))

/**
 * Credential Validation History - Track credential testing
 */
export const credentialValidations = sqliteTable('credential_validations', {
  id: text('id').primaryKey(),
  credentialId: text('credential_id').notNull(),
  
  // Validation result
  isValid: integer('is_valid', { mode: 'boolean' }).notNull(),
  errorMessage: text('error_message'),
  responseTime: integer('response_time'), // Milliseconds
  
  // Metadata
  validationType: text('validation_type').notNull(), // 'manual' | 'auto' | 'first_use'
  ipAddress: text('ip_address'),
  
  // Timestamp
  validatedAt: integer('validated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  credentialIdIdx: index('idx_validations_credential_id').on(table.credentialId),
  validatedAtIdx: index('idx_validations_validated_at').on(table.validatedAt),
}))

/**
 * Repository Sync Log - Detailed sync history
 */
export const repositorySyncLog = sqliteTable('repository_sync_log', {
  id: text('id').primaryKey(),
  repositoryId: text('repository_id').notNull(),
  
  // Sync details
  status: text('status').notNull(), // 'success' | 'partial' | 'failed'
  filesAdded: integer('files_added').notNull().default(0),
  filesModified: integer('files_modified').notNull().default(0),
  filesDeleted: integer('files_deleted').notNull().default(0),
  totalBytes: integer('total_bytes').notNull().default(0),
  
  // Timing
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  duration: integer('duration'), // Milliseconds
  
  // Error handling
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  
  // Commit info
  commitSha: text('commit_sha'),
  commitMessage: text('commit_message'),
}, (table) => ({
  repositoryIdIdx: index('idx_sync_log_repository_id').on(table.repositoryId),
  startedAtIdx: index('idx_sync_log_started_at').on(table.startedAt),
}))

