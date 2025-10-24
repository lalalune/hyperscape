/**
 * Test Data Factories
 *
 * Factory functions to create test data
 */

import { randomBytes } from 'crypto'
import { createJWT } from '../../../server/auth/jwt.mjs'

/**
 * Create a test user
 */
export function createTestUser(overrides = {}) {
  const userId = `test_user_${randomBytes(8).toString('hex')}`
  const email = overrides.email || `test_${randomBytes(4).toString('hex')}@example.com`

  return {
    id: userId,
    email,
    name: overrides.name || 'Test User',
    avatar: overrides.avatar || null,
    privyUserId: overrides.privyUserId || `privy_${randomBytes(8).toString('hex')}`,
    farcasterFid: overrides.farcasterFid || null,
    walletAddress: overrides.walletAddress || null,
    role: overrides.role || 'user',
    teamId: overrides.teamId || null,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides,
  }
}

/**
 * Create a test admin user
 */
export function createTestAdmin(overrides = {}) {
  return createTestUser({
    role: 'admin',
    name: 'Test Admin',
    ...overrides,
  })
}

/**
 * Create a test team
 */
export function createTestTeam(ownerId, overrides = {}) {
  const teamId = `test_team_${randomBytes(8).toString('hex')}`
  const inviteCode = overrides.inviteCode || randomBytes(4).toString('hex').toUpperCase()

  return {
    id: teamId,
    name: overrides.name || 'Test Team',
    description: overrides.description || 'A test team',
    inviteCode,
    ownerId,
    maxMembers: overrides.maxMembers || 10,
    memberCount: overrides.memberCount || 1,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a test project
 */
export function createTestProject(userId, overrides = {}) {
  const projectId = `test_project_${randomBytes(8).toString('hex')}`

  return {
    id: projectId,
    userId,
    teamId: overrides.teamId || null,
    name: overrides.name || 'Test Project',
    description: overrides.description || 'A test project',
    type: overrides.type || 'mixed',
    gameStyle: overrides.gameStyle || 'low-poly',
    gameType: overrides.gameType || 'rpg',
    artDirection: overrides.artDirection || 'fantasy',
    tags: overrides.tags || JSON.stringify(['test', 'fantasy']),
    thumbnail: overrides.thumbnail || null,
    assetCount: overrides.assetCount || 0,
    isPublic: overrides.isPublic !== undefined ? overrides.isPublic : false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a test asset
 */
export function createTestAsset(projectId, userId, overrides = {}) {
  const assetId = `test_asset_${randomBytes(8).toString('hex')}`

  return {
    id: assetId,
    projectId,
    userId,
    name: overrides.name || 'Test Asset',
    description: overrides.description || 'A test asset',
    type: overrides.type || 'weapon',
    category: overrides.category || 'sword',
    glbPath: overrides.glbPath || null,
    thumbnailPath: overrides.thumbnailPath || null,
    conceptArtPath: overrides.conceptArtPath || null,
    prompt: overrides.prompt || 'A test sword',
    meshyTaskId: overrides.meshyTaskId || null,
    generationSettings: overrides.generationSettings || null,
    vertexCount: overrides.vertexCount || 1000,
    triangleCount: overrides.triangleCount || 500,
    fileSize: overrides.fileSize || 50000,
    properties: overrides.properties || JSON.stringify({ power: 10 }),
    tags: overrides.tags || JSON.stringify(['sword', 'weapon']),
    status: overrides.status || 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a test API key
 */
export function createTestApiKey(userId, overrides = {}) {
  const keyId = `test_key_${randomBytes(8).toString('hex')}`

  return {
    id: keyId,
    userId,
    provider: overrides.provider || 'openai',
    encryptedKey: overrides.encryptedKey || randomBytes(32).toString('hex'),
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    lastUsedAt: overrides.lastUsedAt || null,
    createdAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a test voice profile
 */
export function createTestVoiceProfile(userId, overrides = {}) {
  const voiceId = `test_voice_${randomBytes(8).toString('hex')}`

  return {
    id: voiceId,
    userId,
    projectId: overrides.projectId || null,
    name: overrides.name || 'Test Voice',
    description: overrides.description || 'A test voice profile',
    elevenLabsVoiceId: overrides.elevenLabsVoiceId || `el_${randomBytes(8).toString('hex')}`,
    voiceName: overrides.voiceName || 'Test Voice',
    voiceSettings: overrides.voiceSettings || JSON.stringify({ stability: 0.5, similarity: 0.75 }),
    audioClips: overrides.audioClips || JSON.stringify([]),
    totalClips: overrides.totalClips || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Create a test admin whitelist entry
 */
export function createTestWhitelistEntry(walletAddress, overrides = {}) {
  const entryId = `test_whitelist_${randomBytes(8).toString('hex')}`

  return {
    id: entryId,
    walletAddress: walletAddress.toLowerCase(),
    addedBy: overrides.addedBy || null,
    reason: overrides.reason || 'Test entry',
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    createdAt: new Date(),
    expiresAt: overrides.expiresAt || null,
    ...overrides,
  }
}

/**
 * Create a test JWT token for a user
 */
export function createTestJWT(user) {
  return createJWT(user)
}

/**
 * Create an authorization header for a user
 */
export function createAuthHeader(user) {
  const token = createTestJWT(user)
  return `Bearer ${token}`
}

/**
 * Insert test user into database
 */
export async function insertTestUser(db, userData) {
  const user = createTestUser(userData)
  await db.insert(db._.schema.users).values(user)
  return user
}

/**
 * Insert test team into database
 */
export async function insertTestTeam(db, ownerId, teamData) {
  const team = createTestTeam(ownerId, teamData)
  await db.insert(db._.schema.teams).values(team)
  return team
}

/**
 * Insert test project into database
 */
export async function insertTestProject(db, userId, projectData) {
  const project = createTestProject(userId, projectData)
  await db.insert(db._.schema.projects).values(project)
  return project
}

/**
 * Insert test asset into database
 */
export async function insertTestAsset(db, projectId, userId, assetData) {
  const asset = createTestAsset(projectId, userId, assetData)
  await db.insert(db._.schema.assets).values(asset)
  return asset
}
