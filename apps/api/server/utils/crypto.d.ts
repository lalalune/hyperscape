/**
 * TypeScript Type Definitions for Crypto Utilities
 */

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted hex string in format: iv:authTag:encrypted
 */
export function encrypt(text: string | null | undefined): string | null | undefined

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param encryptedData - Encrypted hex string in format: iv:authTag:encrypted
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string | null | undefined): string | null | undefined

/**
 * Check if a value is encrypted (has format: iv:authTag:encrypted)
 * @param value - String to check
 * @returns True if value appears to be encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean

