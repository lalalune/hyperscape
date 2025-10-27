/**
 * API Key Resolution Middleware
 * Resolves API keys from authenticated user or environment variables
 * Attaches resolved keys to req.resolvedApiKeys for use in route handlers
 */

import { getUserApiKey } from '../routes/users.mjs'

/**
 * Map provider names to environment variable names
 */
const PROVIDER_ENV_MAP = {
  meshy: 'MESHY_API_KEY',
  openai: 'OPENAI_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY'
}

/**
 * Map provider names to user-facing error codes
 */
const PROVIDER_ERROR_CODES = {
  meshy: 'MESHY_5031',
  openai: 'OPENAI_5031',
  elevenlabs: 'ELEVENLABS_5031',
  anthropic: 'ANTHROPIC_5031'
}

/**
 * Creates middleware that resolves API key for a specific provider
 * 
 * @param {string} provider - The provider name (e.g., 'meshy', 'openai', 'elevenlabs')
 * @param {object} options - Configuration options
 * @param {boolean} options.required - Whether the API key is required (default: true)
 * @param {string} options.errorMessage - Custom error message if key not found
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Usage in routes:
 * app.post('/api/generate', 
 *   requireAuth,
 *   resolveApiKey('meshy'),
 *   async (req, res) => {
 *     const meshyKey = req.resolvedApiKeys.meshy
 *     // ... use the key
 *   }
 * )
 */
export function resolveApiKey(provider, options = {}) {
  const { 
    required = true,
    errorMessage = null 
  } = options

  return async (req, res, next) => {
    try {
      // Initialize resolvedApiKeys object if it doesn't exist
      if (!req.resolvedApiKeys) {
        req.resolvedApiKeys = {}
      }

      // Get user ID from authenticated user (set by requireAuth middleware)
      // req.user is set by requireAuth and contains privy_user_id
      const userId = req.user?.privy_user_id

      // Try to get user's API key first (if authenticated)
      let apiKey = null
      if (userId) {
        apiKey = await getUserApiKey(userId, provider)
      }

      // Fall back to environment variable if no user key found
      if (!apiKey) {
        const envVarName = PROVIDER_ENV_MAP[provider]
        if (envVarName) {
          apiKey = process.env[envVarName]
        }
      }

      // If key is required but not found, return error
      if (required && !apiKey) {
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)
        const errorCode = PROVIDER_ERROR_CODES[provider] || 'API_KEY_MISSING'
        
        return res.status(503).json({
          error: `${providerName} API key not configured`,
          message: errorMessage || `Please add your ${providerName} API key in Profile settings`,
          code: errorCode
        })
      }

      // Attach resolved key to request
      req.resolvedApiKeys[provider] = apiKey

      next()
    } catch (error) {
      // Forward errors to error handler
      next(error)
    }
  }
}

/**
 * Creates middleware that resolves multiple API keys at once
 * Useful when an endpoint needs multiple provider keys
 * 
 * @param {string[]} providers - Array of provider names
 * @param {object} options - Configuration options
 * @param {boolean} options.requireAll - Whether all keys are required (default: true)
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Resolve multiple keys:
 * app.post('/api/multi-provider',
 *   requireAuth,
 *   resolveMultipleApiKeys(['openai', 'elevenlabs']),
 *   async (req, res) => {
 *     const { openai, elevenlabs } = req.resolvedApiKeys
 *     // ... use the keys
 *   }
 * )
 */
export function resolveMultipleApiKeys(providers, options = {}) {
  const { requireAll = true } = options

  return async (req, res, next) => {
    try {
      // Initialize resolvedApiKeys object
      if (!req.resolvedApiKeys) {
        req.resolvedApiKeys = {}
      }

      const userId = req.user?.privy_user_id
      const missingProviders = []

      // Resolve each provider key
      for (const provider of providers) {
        let apiKey = null

        // Try user's API key first
        if (userId) {
          apiKey = await getUserApiKey(userId, provider)
        }

        // Fall back to environment variable
        if (!apiKey) {
          const envVarName = PROVIDER_ENV_MAP[provider]
          if (envVarName) {
            apiKey = process.env[envVarName]
          }
        }

        if (apiKey) {
          req.resolvedApiKeys[provider] = apiKey
        } else if (requireAll) {
          missingProviders.push(provider)
        }
      }

      // If any required keys are missing, return error
      if (requireAll && missingProviders.length > 0) {
        const providerNames = missingProviders
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join(', ')

        return res.status(503).json({
          error: 'Required API keys not configured',
          message: `Please add your API keys for: ${providerNames}`,
          code: 'MULTIPLE_KEYS_MISSING',
          missingProviders
        })
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Convenience middleware for common single-provider scenarios
 */
export const resolveMeshyKey = resolveApiKey('meshy')
export const resolveOpenAIKey = resolveApiKey('openai')
export const resolveElevenLabsKey = resolveApiKey('elevenlabs')
export const resolveAnthropicKey = resolveApiKey('anthropic')

