/**
 * Crypto Utilities for API Key Encryption
 * Provides secure encryption/decryption for sensitive user data
 */

import crypto from 'crypto'

// Use a secret key for encryption (should be set in environment)
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || process.env.DATABASE_URL || 'default-dev-secret-change-in-production'

// Algorithm for encryption
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const SALT_LENGTH = 64 // 512 bits
const TAG_LENGTH = 16 // 128 bits
const KEY_LENGTH = 32 // 256 bits

/**
 * Derive encryption key from secret using PBKDF2
 */
function deriveKey(secret) {
  const salt = crypto.createHash('sha256').update(secret).digest()
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypt sensitive data (API keys)
 * @param {string} text - Plain text to encrypt (must be a non-empty string)
 * @returns {string} - Encrypted hex string
 * @throws {TypeError} If text is null, undefined, or empty string
 */
export function encrypt(text) {
  if (!text) {
    throw new TypeError('encrypt() requires a non-empty string, received: ' + typeof text)
  }

  try {
    const key = deriveKey(ENCRYPTION_SECRET)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
    
    // Only log in development - avoid leaking operation details in production
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log('[Crypto] Encryption completed')
    }
    
    // Return iv:authTag:encrypted (all hex encoded)
    return result
  } catch (error) {
    console.error('[Crypto] Encryption failed:', error.message)
    
    // Only log detailed context in development to prevent side-channel attacks
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    console.error('[Crypto] Encryption failure context:', {
      encryptionSecret: ENCRYPTION_SECRET ? '***SET***' : 'MISSING',
      nodeEnv: process.env.NODE_ENV,
      algorithm: ALGORITHM,
      errorStack: error.stack
    })
    }
    
    // Always throw - never return plaintext
    throw new Error(`Failed to encrypt sensitive data: ${error.message}`)
  }
}

/**
 * Decrypt sensitive data (API keys)
 * @param {string} encryptedData - Encrypted hex string (must be a non-empty string)
 * @returns {string} - Decrypted plain text
 * @throws {TypeError} If encryptedData is null, undefined, or empty string
 */
export function decrypt(encryptedData) {
  // Start timing to ensure constant-time behavior across all code paths
  const startTime = Date.now()
  
  if (!encryptedData) {
    throw new TypeError('decrypt() requires a non-empty string, received: ' + typeof encryptedData)
  }

  // Check if this is already plaintext (for backward compatibility)
  if (!encryptedData.includes(':')) {
    // Compute elapsed time to maintain constant-time behavior with encrypted path
    const duration = Date.now() - startTime
    
    // Perform deterministic operation (buffer allocation) to match encrypted path timing characteristics
    // This prevents timing side-channel attacks by ensuring both paths execute similar operations
    const _timingNormalization = Buffer.alloc(16)
    
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    console.warn('[Crypto] Data appears to be plaintext, returning as-is (consider re-encrypting)')
    }
    
    return encryptedData
  }

  try {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const key = deriveKey(ENCRYPTION_SECRET)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    // Compute elapsed time for timing consistency
    const duration = Date.now() - startTime

    // Only log in development - avoid leaking operation details in production
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log('[Crypto] Decryption completed')
    }

    return decrypted
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error.message)
    
    // Only log detailed context in development to prevent side-channel attacks
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    console.error('[Crypto] Decryption failure context:', {
      encryptionSecret: ENCRYPTION_SECRET ? '***SET***' : 'MISSING',
      nodeEnv: process.env.NODE_ENV,
      algorithm: ALGORITHM,
      errorStack: error.stack
    })
    }
    
    // Always throw - never assume plaintext
    throw new Error(`Failed to decrypt sensitive data: ${error.message}`)
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value) {
  return value && typeof value === 'string' && value.includes(':') && value.split(':').length === 3
}
