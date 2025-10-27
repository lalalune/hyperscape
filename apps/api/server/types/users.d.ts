/**
 * TypeScript Type Definitions for User Management
 * Provides strict typing for user routes and API key management
 */

export type APIKeyProvider = 'openai' | 'meshy' | 'elevenlabs'

export interface APIKeyData {
  id: APIKeyProvider
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
    openai?: string
    openaiCreatedAt?: string
    openaiLastUsed?: string | null
    meshy?: string
    meshyCreatedAt?: string
    meshyLastUsed?: string | null
    elevenlabs?: string
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
 */
export function encrypt(text: string): string
export function decrypt(encryptedData: string): string
export function isEncrypted(value: string): boolean

