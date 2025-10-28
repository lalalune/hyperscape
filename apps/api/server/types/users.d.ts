/**
 * TypeScript Type Definitions for User Management
 * Provides strict typing for user routes and API key management
 */

export type APIKeyProvider = 'openai' | 'meshy' | 'elevenlabs'

/**
 * Result of user ID validation
 */
export interface UserIdValidationResult {
  valid: boolean
  userId: string | null
  error: string | null
}

export interface APIKeyData {
  provider: APIKeyProvider
  maskedKey: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

export interface UserProfile {
  id: string
  privy_user_id: string
  email: string | null
  wallet_address: string | null
  display_name: string | null
  avatar_url: string | null
  role: 'admin' | 'team_leader' | 'member'
  settings: UserSettings
  created_at: string
  updated_at?: string
  last_login_at?: string | null
}

export interface UserSettings {
  // Appearance
  theme?: 'dark' | 'light' | 'auto'
  compactMode?: boolean
  animationsEnabled?: boolean

  // Notifications
  emailNotifications?: boolean
  browserNotifications?: boolean
  generationNotifications?: boolean

  // Performance
  autoSaveEnabled?: boolean
  lowPowerMode?: boolean
  preloadModels?: boolean

  // Privacy
  analyticsEnabled?: boolean
  crashReportsEnabled?: boolean

  // Language
  language?: 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh'

  // API Configuration
  aiGatewayUrl?: string

  // API Keys (encrypted)
  apiKeys?: {
    openai?: EncryptedData
    openaiCreatedAt?: string
    openaiLastUsed?: string | null
    meshy?: EncryptedData
    meshyCreatedAt?: string
    meshyLastUsed?: string | null
    elevenlabs?: EncryptedData
    elevenlabsCreatedAt?: string
    elevenlabsLastUsed?: string | null
  }
}

export interface EncryptedData {
  iv: string
  authTag: string
  encrypted: string
}

export interface DecryptedAPIKeys {
  openai?: string
  meshy?: string
  elevenlabs?: string
}

/**
 * User API Key Management Functions
 */
export function getUserApiKey(
  privyUserId: string,
  provider: APIKeyProvider
): Promise<string | null>

export function getUserApiKeys(
  privyUserId: string
): Promise<DecryptedAPIKeys>

/**
 * Crypto Functions
 * Supports both object and serialized string forms of encrypted data
 */

/**
 * Encrypts plain text and returns a serialized string (default)
 * @param text - Plain text to encrypt
 * @returns Serialized encrypted data in format "iv:authTag:encrypted"
 */
export function encrypt(text: string): string

/**
 * Encrypts plain text and returns a serialized string
 * @param text - Plain text to encrypt
 * @param serialize - When true or omitted, returns serialized "iv:authTag:encrypted" string
 * @returns Serialized encrypted data in format "iv:authTag:encrypted"
 */
export function encrypt(text: string, serialize: true): string

/**
 * Encrypts plain text and returns structured object
 * @param text - Plain text to encrypt
 * @param serialize - When false, returns EncryptedData object
 * @returns EncryptedData object with separate iv, authTag, and encrypted properties
 */
export function encrypt(text: string, serialize: false): EncryptedData

/**
 * Decrypts a serialized encrypted string (default)
 * @param encryptedData - Serialized encrypted data in format "iv:authTag:encrypted"
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string

/**
 * Decrypts an EncryptedData object
 * @param encryptedData - EncryptedData object with iv, authTag, and encrypted properties
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: EncryptedData): string

/**
 * Checks if a value is encrypted (serialized string format)
 * @param value - Value to check
 * @returns True if value matches encrypted string pattern "iv:authTag:encrypted"
 */
export function isEncrypted(value: string): boolean

/**
 * Checks if a value is encrypted (object format)
 * @param value - Value to check
 * @returns True if value has EncryptedData structure
 */
export function isEncrypted(value: EncryptedData): boolean

