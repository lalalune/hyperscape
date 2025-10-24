/**
 * Unified Encryption Utilities
 * 
 * Secure encryption/decryption for sensitive data (API keys, tokens, etc.)
 * Uses AES-256-GCM with proper key derivation and random IVs.
 * 
 * @packageDocumentation
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const PBKDF2_ITERATIONS = 100000

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Base64 encoded encrypted content */
  encrypted: string
  
  /** Base64 encoded initialization vector */
  iv: string
  
  /** Base64 encoded authentication tag */
  authTag: string
  
  /** Encryption version for future algorithm changes */
  version: number
  
  /** Algorithm used */
  algorithm?: string
}

/**
 * Encryption service configuration
 */
export interface EncryptionConfig {
  /** Secret key or passphrase for encryption */
  secret: string
  
  /** Optional salt for key derivation */
  salt?: string
  
  /** Number of PBKDF2 iterations */
  iterations?: number
}

/**
 * Encryption Service
 * 
 * Provides secure encryption and decryption with proper key derivation.
 * 
 * @example
 * ```typescript
 * const encryptionService = new EncryptionService({
 *   secret: process.env.ENCRYPTION_KEY
 * })
 * 
 * const encrypted = encryptionService.encrypt('sensitive-api-key')
 * const decrypted = encryptionService.decrypt(encrypted)
 * ```
 */
export class EncryptionService {
  private encryptionKey: Buffer
  private config: Required<EncryptionConfig>

  constructor(config: EncryptionConfig) {
    this.config = {
      secret: config.secret,
      salt: config.salt || 'hyperscape-encryption-salt-v1',
      iterations: config.iterations || PBKDF2_ITERATIONS,
    }
    
    if (!this.config.secret) {
      throw new Error('Encryption secret is required')
    }
    
    if (this.config.secret.length < 32) {
      console.warn('[Encryption] Secret is shorter than 32 characters - use a longer secret in production')
    }
    
    // Derive encryption key using PBKDF2
    this.encryptionKey = crypto.pbkdf2Sync(
      this.config.secret,
      this.config.salt,
      this.config.iterations,
      KEY_LENGTH,
      'sha256'
    )
  }

  /**
   * Encrypt plaintext data
   * 
   * @param plaintext - Data to encrypt
   * @returns Encrypted data with IV and auth tag
   * @throws Error if encryption fails
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH)
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv)
      
      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'base64')
      encrypted += cipher.final('base64')
      
      // Get auth tag
      const authTag = cipher.getAuthTag()
      
      return {
        encrypted,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        version: 1,
        algorithm: ALGORITHM,
      }
    } catch (error) {
      console.error('[Encryption] Failed to encrypt:', (error as Error).message)
      throw new Error('Encryption failed')
    }
  }

  /**
   * Decrypt encrypted data
   * 
   * @param encryptedData - Data with IV and auth tag
   * @returns Decrypted plaintext
   * @throws Error if decryption fails or data is tampered
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const { encrypted, iv, authTag, version = 1 } = encryptedData
      
      // Version check
      if (version !== 1) {
        throw new Error(`Unsupported encryption version: ${version}`)
      }
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.encryptionKey,
        Buffer.from(iv, 'base64')
      )
      
      // Set auth tag for verification
      decipher.setAuthTag(Buffer.from(authTag, 'base64'))
      
      // Decrypt
      let decrypted = decipher.update(encrypted, 'base64', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('[Decryption] Failed to decrypt:', (error as Error).message)
      throw new Error('Decryption failed - data may be corrupted or tampered')
    }
  }

  /**
   * Encrypt and encode to JSON string
   * 
   * @param plaintext - Data to encrypt
   * @returns JSON string of encrypted data
   */
  encryptToJSON(plaintext: string): string {
    const encrypted = this.encrypt(plaintext)
    return JSON.stringify(encrypted)
  }

  /**
   * Decrypt from JSON string
   * 
   * @param jsonString - JSON string of encrypted data
   * @returns Decrypted plaintext
   */
  decryptFromJSON(jsonString: string): string {
    const encryptedData = JSON.parse(jsonString) as EncryptedData
    return this.decrypt(encryptedData)
  }

  /**
   * Hash data (one-way, for passwords)
   * 
   * @param data - Data to hash
   * @param salt - Optional salt (generated if not provided)
   * @returns Object with hash and salt
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const finalSalt = salt || crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(
      data,
      finalSalt,
      this.config.iterations,
      64,
      'sha512'
    ).toString('hex')
    
    return { hash, salt: finalSalt }
  }

  /**
   * Verify hashed data
   * 
   * @param data - Plaintext data
   * @param hash - Hash to verify against
   * @param salt - Salt used for hashing
   * @returns true if match, false otherwise
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const computed = this.hash(data, salt)
    return computed.hash === hash
  }
}

/**
 * Factory function to create encryption service
 */
export function createEncryptionService(config: EncryptionConfig): EncryptionService {
  return new EncryptionService(config)
}

/**
 * Singleton encryption service for convenience
 * Requires ENCRYPTION_KEY environment variable
 */
let defaultService: EncryptionService | null = null

export function getDefaultEncryptionService(): EncryptionService {
  if (!defaultService) {
    const secret = process.env.ENCRYPTION_KEY || process.env.CREDENTIAL_ENCRYPTION_KEY
    
    if (!secret) {
      throw new Error('ENCRYPTION_KEY environment variable is required')
    }
    
    defaultService = new EncryptionService({ secret })
  }
  
  return defaultService
}

