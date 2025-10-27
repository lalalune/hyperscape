/**
 * TypeScript Type Definitions for Crypto Utilities
 */

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param text - Plain text to encrypt (must be a non-empty string)
 * @returns Encrypted hex string in format: iv:authTag:encrypted
 * @throws {TypeError} If text is null, undefined, or empty string
 * @throws {Error} If encryption fails
 */
export function encrypt(text: string): string

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param encryptedData - Encrypted hex string in format: iv:authTag:encrypted (must be a non-empty string)
 * @returns Decrypted plain text
 * @throws {TypeError} If encryptedData is null, undefined, or empty string
 * @throws {Error} If decryption fails or data format is invalid
 */
export function decrypt(encryptedData: string): string

/**
 * Check if a value is encrypted (has format: iv:authTag:encrypted)
 * @param value - String to check (accepts null/undefined)
 * @returns True if value appears to be encrypted, false for null/undefined or non-encrypted strings
 */
export function isEncrypted(value: string | null | undefined): boolean

