/**
 * API Keys Management Routes
 *
 * Secure API key storage with AES-256-GCM encryption
 * Users can add their own keys for OpenAI, Meshy, and ElevenLabs
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { db, schema } from '../db/index.mjs'
import { eq, and } from 'drizzle-orm'

// =====================================================================
// ENCRYPTION UTILITIES
// =====================================================================

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Validate that encryption key exists and has correct length
 */
function validateEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  // Convert to buffer (assume it's base64 encoded)
  const keyBuffer = Buffer.from(key, 'base64')

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (256 bits). Current length: ${keyBuffer.length}`)
  }

  return keyBuffer
}

/**
 * Encrypt an API key using AES-256-GCM
 *
 * @param {string} plaintext - The API key to encrypt
 * @returns {string} JSON string containing { iv, authTag, encrypted }
 */
function encryptKey(plaintext) {
  const key = validateEncryptionKey()

  // Generate secure random IV (Initialization Vector)
  const iv = randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv)

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Get authentication tag
  const authTag = cipher.getAuthTag()

  // Return all components as JSON
  return JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encrypted: encrypted
  })
}

/**
 * Decrypt an API key using AES-256-GCM
 *
 * @param {string} encryptedData - JSON string containing { iv, authTag, encrypted }
 * @returns {string} The decrypted API key
 */
function decryptKey(encryptedData) {
  const key = validateEncryptionKey()

  // Parse encrypted data
  const { iv, authTag, encrypted } = JSON.parse(encryptedData)

  // Convert from base64
  const ivBuffer = Buffer.from(iv, 'base64')
  const authTagBuffer = Buffer.from(authTag, 'base64')

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTagBuffer)

  // Decrypt
  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Mask an API key for safe display
 * Shows first 4 characters + "..." + last 4 characters
 *
 * @param {string} key - The API key to mask
 * @returns {string} Masked key
 */
function maskKey(key) {
  if (!key || key.length < 12) {
    return '****...****'
  }

  const start = key.substring(0, 4)
  const end = key.substring(key.length - 4)

  return `${start}...${end}`
}

/**
 * Validate API key format based on provider
 *
 * @param {string} provider - The service provider
 * @param {string} apiKey - The API key to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateApiKeyFormat(provider, apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required and must be a string' }
  }

  if (apiKey.length < 10) {
    return { valid: false, error: 'API key is too short' }
  }

  switch (provider) {
    case 'openai':
      // OpenAI keys start with "sk-" or "sk-proj-"
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API keys must start with "sk-"' }
      }
      if (apiKey.length < 40) {
        return { valid: false, error: 'OpenAI API key appears to be invalid (too short)' }
      }
      break

    case 'meshy':
      // Meshy keys are typically longer strings
      if (apiKey.length < 20) {
        return { valid: false, error: 'Meshy API key appears to be invalid (too short)' }
      }
      break

    case 'elevenlabs':
      // ElevenLabs keys are hex strings
      if (apiKey.length < 20) {
        return { valid: false, error: 'ElevenLabs API key appears to be invalid (too short)' }
      }
      break

    default:
      return { valid: false, error: 'Unknown provider' }
  }

  return { valid: true }
}

/**
 * Validate provider name
 */
const VALID_PROVIDERS = ['openai', 'meshy', 'elevenlabs']

function validateProvider(provider) {
  return VALID_PROVIDERS.includes(provider)
}

// =====================================================================
// API ROUTES
// =====================================================================

/**
 * POST /api/user/api-keys
 * Add or update an API key for a provider
 */
export async function POST_addApiKey(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { provider, apiKey } = req.body
    const userId = req.user.id

    // Validate provider
    if (!validateProvider(provider)) {
      return res.status(400).json({
        error: 'Invalid provider',
        message: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}`
      })
    }

    // Validate API key format
    const validation = validateApiKeyFormat(provider, apiKey)
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid API key',
        message: validation.error
      })
    }

    // Check if user already has a key for this provider
    const existingKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(schema.apiKeys.userId, userId),
        eq(schema.apiKeys.provider, provider)
      )
    })

    // Encrypt the key
    const encryptedKey = encryptKey(apiKey)

    let result

    if (existingKey) {
      // Update existing key
      const [updated] = await db
        .update(schema.apiKeys)
        .set({
          encryptedKey: encryptedKey,
          isActive: true
        })
        .where(eq(schema.apiKeys.id, existingKey.id))
        .returning()

      result = updated
    } else {
      // Create new key
      const id = `key_${Date.now()}_${randomBytes(8).toString('hex')}`

      const [created] = await db
        .insert(schema.apiKeys)
        .values({
          id,
          userId,
          provider,
          encryptedKey: encryptedKey,
          isActive: true
        })
        .returning()

      result = created
    }

    // Return masked key
    res.status(200).json({
      id: result.id,
      provider: result.provider,
      maskedKey: maskKey(apiKey),
      isActive: result.isActive,
      createdAt: result.createdAt
    })

  } catch (error) {
    console.error('[API Keys] Error adding API key:', error)
    res.status(500).json({
      error: 'Failed to add API key',
      message: error.message
    })
  }
}

/**
 * GET /api/user/api-keys
 * Get all API keys for the authenticated user (masked)
 */
export async function GET_apiKeys(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const userId = req.user.id

    const keys = await db.query.apiKeys.findMany({
      where: eq(schema.apiKeys.userId, userId)
    })

    // Decrypt and mask keys
    const maskedKeys = keys.map(key => {
      let maskedKey = '****...****'

      try {
        const decrypted = decryptKey(key.encryptedKey)
        maskedKey = maskKey(decrypted)
      } catch (error) {
        console.error('[API Keys] Error decrypting key for masking:', error)
        // Keep default masked value
      }

      return {
        id: key.id,
        provider: key.provider,
        maskedKey: maskedKey,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt
      }
    })

    res.status(200).json(maskedKeys)

  } catch (error) {
    console.error('[API Keys] Error fetching API keys:', error)
    res.status(500).json({
      error: 'Failed to fetch API keys',
      message: error.message
    })
  }
}

/**
 * PUT /api/user/api-keys/:id
 * Update an API key
 */
export async function PUT_updateApiKey(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { id } = req.params
    const { apiKey, isActive } = req.body
    const userId = req.user.id

    // Find the key and verify ownership
    const existingKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(schema.apiKeys.id, id),
        eq(schema.apiKeys.userId, userId)
      )
    })

    if (!existingKey) {
      return res.status(404).json({
        error: 'API key not found',
        message: 'API key does not exist or you do not have permission to update it'
      })
    }

    // Build update object
    const updates = {}

    // Update API key if provided
    if (apiKey !== undefined) {
      const validation = validateApiKeyFormat(existingKey.provider, apiKey)
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid API key',
          message: validation.error
        })
      }

      updates.encryptedKey = encryptKey(apiKey)
    }

    // Update active status if provided
    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive)
    }

    // Perform update
    const [updated] = await db
      .update(schema.apiKeys)
      .set(updates)
      .where(eq(schema.apiKeys.id, id))
      .returning()

    // Decrypt for masking
    let maskedKey = '****...****'
    try {
      const decrypted = decryptKey(updated.encryptedKey)
      maskedKey = maskKey(decrypted)
    } catch (error) {
      console.error('[API Keys] Error decrypting key for masking:', error)
    }

    res.status(200).json({
      id: updated.id,
      provider: updated.provider,
      maskedKey: maskedKey,
      isActive: updated.isActive,
      lastUsedAt: updated.lastUsedAt,
      createdAt: updated.createdAt
    })

  } catch (error) {
    console.error('[API Keys] Error updating API key:', error)
    res.status(500).json({
      error: 'Failed to update API key',
      message: error.message
    })
  }
}

/**
 * DELETE /api/user/api-keys/:id
 * Delete an API key
 */
export async function DELETE_apiKey(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { id } = req.params
    const userId = req.user.id

    // Find the key and verify ownership
    const existingKey = await db.query.apiKeys.findFirst({
      where: and(
        eq(schema.apiKeys.id, id),
        eq(schema.apiKeys.userId, userId)
      )
    })

    if (!existingKey) {
      return res.status(404).json({
        error: 'API key not found',
        message: 'API key does not exist or you do not have permission to delete it'
      })
    }

    // Hard delete from database
    await db
      .delete(schema.apiKeys)
      .where(eq(schema.apiKeys.id, id))

    res.status(200).json({
      success: true,
      message: 'API key deleted successfully'
    })

  } catch (error) {
    console.error('[API Keys] Error deleting API key:', error)
    res.status(500).json({
      error: 'Failed to delete API key',
      message: error.message
    })
  }
}

// =====================================================================
// HELPER FUNCTIONS FOR SERVICE INTEGRATION
// =====================================================================

/**
 * Get a decrypted API key for a user and provider
 * Used by generation services to retrieve user's API keys
 *
 * @param {string} userId - User ID
 * @param {string} provider - Service provider ('openai' | 'meshy' | 'elevenlabs')
 * @returns {Promise<string|null>} Decrypted API key or null if not found
 */
export async function getUserApiKey(userId, provider) {
  try {
    const keyRecord = await db.query.apiKeys.findFirst({
      where: and(
        eq(schema.apiKeys.userId, userId),
        eq(schema.apiKeys.provider, provider),
        eq(schema.apiKeys.isActive, true)
      )
    })

    if (!keyRecord) {
      return null
    }

    // Decrypt the key
    const decryptedKey = decryptKey(keyRecord.encryptedKey)

    // Update last used timestamp
    await db
      .update(schema.apiKeys)
      .set({
        lastUsedAt: new Date()
      })
      .where(eq(schema.apiKeys.id, keyRecord.id))

    return decryptedKey

  } catch (error) {
    console.error('[API Keys] Error retrieving user API key:', error)
    return null
  }
}

/**
 * Check if a user has an active API key for a provider
 *
 * @param {string} userId - User ID
 * @param {string} provider - Service provider
 * @returns {Promise<boolean>} True if user has an active key
 */
export async function hasUserApiKey(userId, provider) {
  try {
    const keyRecord = await db.query.apiKeys.findFirst({
      where: and(
        eq(schema.apiKeys.userId, userId),
        eq(schema.apiKeys.provider, provider),
        eq(schema.apiKeys.isActive, true)
      )
    })

    return keyRecord !== undefined

  } catch (error) {
    console.error('[API Keys] Error checking user API key:', error)
    return false
  }
}

// =====================================================================
// STARTUP VALIDATION
// =====================================================================

/**
 * Lazy validation of encryption setup
 * Only validates when first called (not on module load) to allow dotenv to load first
 */
let encryptionValidated = false
function ensureEncryptionValidated() {
  if (encryptionValidated) return

  try {
    validateEncryptionKey()
    console.log('[API Keys] Encryption key validated successfully')
    encryptionValidated = true
  } catch (error) {
    console.error('[API Keys] CRITICAL: Encryption key validation failed:', error.message)
    console.error('[API Keys] API key encryption will not work until ENCRYPTION_KEY is properly set')
    console.error('[API Keys] Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"')
    // Don't set encryptionValidated=true so we keep trying
  }
}

// Try to validate on first opportunity
setTimeout(() => ensureEncryptionValidated(), 100)
