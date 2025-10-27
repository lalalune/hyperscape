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
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted hex string
 */
export function encrypt(text) {
  if (!text) {
    return text
  }

  const startTime = Date.now()

  try {
    const key = deriveKey(ENCRYPTION_SECRET)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
    const duration = Date.now() - startTime
    
    console.log(`[Crypto] Encrypted data (${duration}ms) - Length: ${text.length} → ${result.length}`)
    
    // Return iv:authTag:encrypted (all hex encoded)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Crypto] Encryption error (${duration}ms):`, error.message)
    
    // In development, return plain text if encryption fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Crypto] ⚠️ Encryption failed, storing plaintext in development mode')
      return text
    }
    throw new Error('Failed to encrypt sensitive data')
  }
}

/**
 * Decrypt sensitive data (API keys)
 * @param {string} encryptedData - Encrypted hex string
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedData) {
  if (!encryptedData) {
    return encryptedData
  }

  const startTime = Date.now()

  // Check if this is already plaintext (for backward compatibility)
  if (!encryptedData.includes(':')) {
    console.warn('[Crypto] Data appears to be plaintext, returning as-is (consider re-encrypting)')
    return encryptedData
  }

  try {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error(`Invalid encrypted data format - expected 3 parts, got ${parts.length}`)
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const key = deriveKey(ENCRYPTION_SECRET)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    const duration = Date.now() - startTime
    console.log(`[Crypto] Decrypted data (${duration}ms) - Length: ${encryptedData.length} → ${decrypted.length}`)

    return decrypted
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Crypto] Decryption error (${duration}ms):`, error.message)
    
    // In development, try to return as plaintext
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Crypto] ⚠️ Decryption failed in development, attempting plaintext fallback')
      return encryptedData
    }
    throw new Error('Failed to decrypt sensitive data - data may be corrupted')
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value) {
  return value && typeof value === 'string' && value.includes(':') && value.split(':').length === 3
}

