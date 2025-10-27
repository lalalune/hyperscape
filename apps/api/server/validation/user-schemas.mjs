/**
 * Zod Validation Schemas for User Management API
 * Comprehensive validation for user profile, settings, and API keys
 */

import { z } from 'zod'

// =============================================================================
// API KEY SCHEMAS
// =============================================================================

export const APIKeyProviderSchema = z.enum(['openai', 'meshy', 'elevenlabs'], {
  errorMap: () => ({ message: 'Provider must be one of: openai, meshy, elevenlabs' })
})

export const AddAPIKeyBodySchema = z.object({
  provider: APIKeyProviderSchema,
  apiKey: z.string()
    .min(10, 'API key must be at least 10 characters')
    .max(500, 'API key is too long')
    .refine(
      (key) => !key.includes(':') || key.split(':').length !== 3,
      { message: 'Invalid API key format - appears to be encrypted already' }
    )
}).strict()

export const DeleteAPIKeyParamsSchema = z.object({
  provider: APIKeyProviderSchema
})

// =============================================================================
// USER PROFILE SCHEMAS
// =============================================================================

export const UpdateProfileBodySchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().url().optional()
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
)

// =============================================================================
// USER SETTINGS SCHEMAS
// =============================================================================

export const ThemeSchema = z.enum(['dark', 'light', 'auto'])
export const LanguageSchema = z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh'])

export const UserSettingsSchema = z.object({
  // Appearance
  theme: ThemeSchema.optional(),
  compactMode: z.boolean().optional(),
  animationsEnabled: z.boolean().optional(),

  // Notifications
  emailNotifications: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
  generationNotifications: z.boolean().optional(),

  // Performance
  autoSaveEnabled: z.boolean().optional(),
  lowPowerMode: z.boolean().optional(),
  preloadModels: z.boolean().optional(),

  // Privacy
  analyticsEnabled: z.boolean().optional(),
  crashReportsEnabled: z.boolean().optional(),

  // Language
  language: LanguageSchema.optional(),

  // API Configuration
  aiGatewayUrl: z.string().url().or(z.literal('')).optional(),

  // API Keys (internal - not exposed via API)
  apiKeys: z.record(z.string(), z.any()).optional()
}).strict()

export const UpdateSettingsBodySchema = z.object({
  settings: UserSettingsSchema
}).strict()

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate API key provider
 * @param {unknown} provider - Provider value to validate (expected: APIKeyProvider)
 * @returns {boolean} True if provider is one of: 'openai', 'meshy', 'elevenlabs'
 */
export function isValidProvider(provider) {
  return APIKeyProviderSchema.safeParse(provider).success
}

/**
 * Validate settings object
 * @param {unknown} settings - Settings object to validate (expected: Partial<UserSettings>)
 * @returns {boolean} True if settings conform to UserSettingsSchema
 */
export function isValidSettings(settings) {
  return UserSettingsSchema.safeParse(settings).success
}

/**
 * Sanitize settings to remove sensitive fields
 * Strips apiKeys and other sensitive data before exposing settings to client
 * @param {unknown | null} settings - Raw settings object (expected: Partial<UserSettings>)
 * @returns {Partial<UserSettings> | Record<string, any>} Public settings object without sensitive fields
 */
export function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {}
  
  const { apiKeys, ...publicSettings } = settings
  return publicSettings
}

// =============================================================================
// USER ID VALIDATION
// =============================================================================

/**
 * Privy User ID Schema
 * Format: Typically alphanumeric string that may include dashes, underscores, or colons
 * Examples: "did:privy:abc123", "user_123", or UUID format
 */
export const PrivyUserIdSchema = z.string()
  .min(1, 'User ID cannot be empty')
  .max(256, 'User ID is too long')
  .refine(
    (id) => /^[a-zA-Z0-9:_-]+$/.test(id),
    { message: 'User ID contains invalid characters. Only alphanumeric, colons, dashes, and underscores allowed.' }
  )

/**
 * Validate and canonicalize a user ID from request header
 * @param {string | undefined} rawUserId - Raw user ID from header
 * @returns {{ valid: boolean, userId: string | null, error: string | null }}
 */
export function validateUserId(rawUserId) {
  // Check if provided
  if (!rawUserId) {
    return {
      valid: false,
      userId: null,
      error: 'User ID is required'
    }
  }

  // Canonicalize: trim whitespace
  const trimmedId = String(rawUserId).trim()

  // Validate against schema
  const result = PrivyUserIdSchema.safeParse(trimmedId)
  
  if (!result.success) {
    const errorMessage = result.error.errors[0]?.message || 'Invalid user ID format'
    return {
      valid: false,
      userId: null,
      error: errorMessage
    }
  }

  return {
    valid: true,
    userId: result.data,
    error: null
  }
}

