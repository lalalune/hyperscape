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

  try {
    const key = deriveKey(ENCRYPTION_SECRET)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Return iv:authTag:encrypted (all hex encoded)
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('[Crypto] Encryption error:', error)
    // In development, return plain text if encryption fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Crypto] Encryption failed, storing plaintext in development')
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

  // Check if this is already plaintext (for backward compatibility)
  if (!encryptedData.includes(':')) {
    console.warn('[Crypto] Data appears to be plaintext, returning as-is')
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

    return decrypted
  } catch (error) {
    console.error('[Crypto] Decryption error:', error)
    // In development, try to return as plaintext
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Crypto] Decryption failed, trying plaintext')
      return encryptedData
    }
    throw new Error('Failed to decrypt sensitive data')
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value) {
  return value && typeof value === 'string' && value.includes(':') && value.split(':').length === 3
}

