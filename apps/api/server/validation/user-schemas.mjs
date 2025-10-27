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
  aiGatewayUrl: z.string().url().optional().or(z.literal('')),

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
 */
export function isValidProvider(provider) {
  return APIKeyProviderSchema.safeParse(provider).success
}

/**
 * Validate settings object
 */
export function isValidSettings(settings) {
  return UserSettingsSchema.safeParse(settings).success
}

/**
 * Sanitize settings to remove sensitive fields
 */
export function sanitizeSettings(settings) {
  if (!settings) return {}
  
  const { apiKeys, ...publicSettings } = settings
  return publicSettings
}

