/**
 * Credential Service - OPTIMIZED & SECURE
 * 
 * Manages encrypted user credentials with validation and auditing
 * 
 * Security features:
 * - AES-256-GCM encryption with random IVs
 * - Secure key derivation from environment secret
 * - Automatic credential validation
 * - Usage tracking and audit logging
 */

import crypto from 'crypto'
import { db, schema } from '../db/index.mjs'
import { eq, and, desc } from 'drizzle-orm'

// Security configuration constants
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Derive a secure encryption key from environment variable
 * Uses PBKDF2 for key derivation
 */
function deriveEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ENCRYPTION_KEY must be set in production')
    }
    console.warn('⚠️  Using development encryption key. DO NOT use in production!')
  }
  const salt = 'asset-forge-credentials-v1' // Fixed salt for consistency

  return crypto.pbkdf2Sync(secret || 'default-dev-key-CHANGE-IN-PRODUCTION', salt, 100000, KEY_LENGTH, 'sha256')
}

// Derive encryption key (must come after KEY_LENGTH is defined)
const ENCRYPTION_KEY = deriveEncryptionKey()

/**
 * Encrypt sensitive data with AES-256-GCM
 * 
 * @param {string} plaintext - Data to encrypt
 * @returns {Object} Encrypted data with IV and auth tag
 */
function encrypt(plaintext) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      version: 1, // For future algorithm changes
    }
  } catch (error) {
    console.error('[Encryption] Failed to encrypt data:', error.message)
    throw new Error('Encryption failed')
  }
}

/**
 * Decrypt data with AES-256-GCM
 * 
 * @param {Object} encryptedData - Data with IV and auth tag
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData) {
  try {
    const { encrypted, iv, authTag, version = 1 } = encryptedData
    
    // Support for future algorithm versions
    if (version !== 1) {
      throw new Error(`Unsupported encryption version: ${version}`)
    }
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      ENCRYPTION_KEY,
      Buffer.from(iv, 'base64')
    )
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'))
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('[Decryption] Failed to decrypt data:', error.message)
    throw new Error('Decryption failed - credential may be corrupted')
  }
}

/**
 * Validate input data before storage
 */
function validateCredentialInput(service, key, metadata = {}) {
  const errors = []
  
  // Validate service
  const validServices = ['openai', 'meshy', 'elevenlabs', 'github']
  if (!validServices.includes(service)) {
    errors.push(`Invalid service: ${service}. Must be one of: ${validServices.join(', ')}`)
  }
  
  // Validate key format based on service
  switch (service) {
    case 'openai':
      if (!key.startsWith('sk-')) {
        errors.push('OpenAI API key must start with "sk-"')
      }
      break
    case 'github':
      if (!key.startsWith('ghp_') && !key.startsWith('github_pat_')) {
        errors.push('GitHub PAT must start with "ghp_" or "github_pat_"')
      }
      if (!metadata.githubUsername) {
        errors.push('GitHub username is required')
      }
      break
    case 'elevenlabs':
      // ElevenLabs keys are hexadecimal
      if (!/^[a-f0-9]{32,}$/i.test(key)) {
        errors.push('ElevenLabs API key format appears invalid')
      }
      break
  }
  
  // Validate key length
  if (key.length < 10) {
    errors.push('API key is too short')
  }
  if (key.length > 500) {
    errors.push('API key is too long')
  }
  
  return errors
}

/**
 * Sanitize display name
 */
function sanitizeDisplayName(name) {
  if (!name) return null
  return name.trim().substring(0, 100).replace(/[<>\"']/g, '')
}

export class CredentialService {
  /**
   * Store encrypted credentials with validation
   * 
   * @param {string} userId - User ID
   * @param {string} service - Service name
   * @param {Object} data - Credential data
   * @returns {Promise<string>} Credential ID
   */
  async storeCredentials(userId, service, data) {
    const { key, metadata = {}, displayName } = data
    
    // Validate input
    const validationErrors = validateCredentialInput(service, key, metadata)
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`)
    }
    
    // Check for existing credential
    const existing = await this.getCredentialByService(userId, service)
    if (existing) {
      throw new Error(`Credential for ${service} already exists. Please update or delete the existing one.`)
    }
    
    // Generate credential ID
    const credentialId = `cred_${crypto.randomBytes(16).toString('hex')}`
    
    // Encrypt the key
    const encryptedKey = encrypt(key)
    
    // Prepare metadata
    const credentialMetadata = {
      ...metadata,
      addedFrom: 'web-ui',
      keyPreview: `${key.substring(0, 8)}...${key.substring(key.length - 4)}`,
    }
    
    // Store credential
    const credential = {
      id: credentialId,
      userId,
      service,
      displayName: sanitizeDisplayName(displayName),
      encryptedData: JSON.stringify(encryptedKey),
      metadata: JSON.stringify(credentialMetadata),
      isActive: true,
      isVerified: false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    await db.insert(schema.userCredentials).values(credential)
    
    // Auto-validate the credential
    try {
      await this.validateCredential(credentialId)
    } catch (error) {
      console.warn(`[Credential] Auto-validation failed for ${service}:`, error.message)
      // Don't throw - credential is still stored but unverified
    }
    
    return credentialId
  }
  
  /**
   * Get decrypted credentials for a user and service
   * 
   * @param {string} userId - User ID
   * @param {string} service - Service name
   * @returns {Promise<Object|null>} Decrypted credentials
   */
  async getCredentials(userId, service) {
    const credential = await db.query.userCredentials.findFirst({
      where: and(
        eq(schema.userCredentials.userId, userId),
        eq(schema.userCredentials.service, service),
        eq(schema.userCredentials.isActive, true)
      ),
    })
    
    if (!credential) return null
    
    try {
      const encryptedData = JSON.parse(credential.encryptedData)
      const decryptedKey = decrypt(encryptedData)
      const metadata = credential.metadata ? JSON.parse(credential.metadata) : {}
      
      // Update usage stats
      await this.updateUsageStats(credential.id)
      
      return {
        id: credential.id,
        service: credential.service,
        key: decryptedKey,
        metadata,
        displayName: credential.displayName,
        isVerified: credential.isVerified,
        lastUsedAt: credential.lastUsedAt,
        usageCount: credential.usageCount,
      }
    } catch (error) {
      console.error('[Credential] Failed to decrypt:', error.message)
      return null
    }
  }
  
  /**
   * Get credential by service (without decryption)
   */
  async getCredentialByService(userId, service) {
    return await db.query.userCredentials.findFirst({
      where: and(
        eq(schema.userCredentials.userId, userId),
        eq(schema.userCredentials.service, service),
        eq(schema.userCredentials.isActive, true)
      ),
    })
  }
  
  /**
   * List all credentials for a user (without decrypted keys)
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Credential list
   */
  async listCredentials(userId) {
    const credentials = await db.query.userCredentials.findMany({
      where: and(
        eq(schema.userCredentials.userId, userId),
        eq(schema.userCredentials.isActive, true)
      ),
      orderBy: (credentials, { desc }) => [desc(credentials.createdAt)],
    })
    
    return credentials.map(cred => {
      const metadata = cred.metadata ? JSON.parse(cred.metadata) : {}
      
      return {
        id: cred.id,
        service: cred.service,
        displayName: cred.displayName,
        metadata: {
          githubUsername: metadata.githubUsername,
          keyPreview: metadata.keyPreview,
        },
        isVerified: cred.isVerified,
        lastUsedAt: cred.lastUsedAt,
        lastValidatedAt: cred.lastValidatedAt,
        usageCount: cred.usageCount,
        createdAt: cred.createdAt,
      }
    })
  }
  
  /**
   * Update credential
   */
  async updateCredential(credentialId, userId, updates) {
    const { key, displayName, metadata } = updates
    
    const updateData = {
      updatedAt: new Date(),
    }
    
    if (displayName !== undefined) {
      updateData.displayName = sanitizeDisplayName(displayName)
    }
    
    if (key) {
      // Re-encrypt with new key
      const encryptedKey = encrypt(key)
      updateData.encryptedData = JSON.stringify(encryptedKey)
      updateData.isVerified = false // Needs re-validation
    }
    
    if (metadata) {
      const existing = await db.query.userCredentials.findFirst({
        where: eq(schema.userCredentials.id, credentialId),
      })
      const existingMetadata = existing?.metadata ? JSON.parse(existing.metadata) : {}
      updateData.metadata = JSON.stringify({ ...existingMetadata, ...metadata })
    }
    
    await db.update(schema.userCredentials)
      .set(updateData)
      .where(and(
        eq(schema.userCredentials.id, credentialId),
        eq(schema.userCredentials.userId, userId)
      ))
  }
  
  /**
   * Update usage statistics
   */
  async updateUsageStats(credentialId) {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(schema.userCredentials.id, credentialId),
    })
    
    if (!credential) return
    
    await db.update(schema.userCredentials)
      .set({
        lastUsedAt: new Date(),
        usageCount: credential.usageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.userCredentials.id, credentialId))
  }
  
  /**
   * Soft delete credentials
   */
  async deleteCredentials(credentialId, userId) {
    await db.update(schema.userCredentials)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.userCredentials.id, credentialId),
        eq(schema.userCredentials.userId, userId)
      ))
  }
  
  /**
   * Validate credential by making a test API call
   * 
   * @param {string} credentialId - Credential ID
   * @returns {Promise<Object>} Validation result
   */
  async validateCredential(credentialId) {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(schema.userCredentials.id, credentialId),
    })
    
    if (!credential) {
      throw new Error('Credential not found')
    }
    
    const startTime = Date.now()
    let isValid = false
    let errorMessage = null
    
    try {
      // Decrypt the key
      const encryptedData = JSON.parse(credential.encryptedData)
      const key = decrypt(encryptedData)
      
      // Test the credential based on service
      switch (credential.service) {
        case 'openai':
          isValid = await this.validateOpenAIKey(key)
          break
        case 'github':
          isValid = await this.validateGitHubToken(key)
          break
        case 'elevenlabs':
          isValid = await this.validateElevenLabsKey(key)
          break
        case 'meshy':
          isValid = await this.validateMeshyKey(key)
          break
        default:
          throw new Error(`Validation not implemented for service: ${credential.service}`)
      }
    } catch (error) {
      isValid = false
      errorMessage = error.message
    }
    
    const responseTime = Date.now() - startTime
    
    // Update credential verification status
    if (isValid) {
      await db.update(schema.userCredentials)
        .set({
          isVerified: true,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.userCredentials.id, credentialId))
    }
    
    // Log validation attempt
    const validationId = `val_${crypto.randomBytes(12).toString('hex')}`
    await db.insert(schema.credentialValidations).values({
      id: validationId,
      credentialId,
      isValid,
      errorMessage,
      responseTime,
      validationType: 'manual',
      validatedAt: new Date(),
    })
    
    return {
      isValid,
      errorMessage,
      responseTime,
    }
  }
  
  /**
   * Validate OpenAI API key
   */
  async validateOpenAIKey(key) {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    })
    return response.ok
  }
  
  /**
   * Validate GitHub PAT
   */
  async validateGitHubToken(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    return response.ok
  }
  
  /**
   * Validate ElevenLabs API key
   */
  async validateElevenLabsKey(key) {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': key,
      },
    })
    return response.ok
  }
  
  /**
   * Validate Meshy API key
   */
  async validateMeshyKey(key) {
    const response = await fetch('https://api.meshy.ai/v2/user', {
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    })
    return response.ok
  }
  
  /**
   * Get validation history for a credential
   */
  async getValidationHistory(credentialId, limit = 10) {
    return await db.query.credentialValidations.findMany({
      where: eq(schema.credentialValidations.credentialId, credentialId),
      orderBy: (validations, { desc }) => [desc(validations.validatedAt)],
      limit,
    })
  }
  
  /**
   * Check if user has any valid credentials for a service
   */
  async hasValidCredentials(userId, service) {
    const credential = await this.getCredentialByService(userId, service)
    return credential && credential.isVerified
  }
}

export const credentialService = new CredentialService()

