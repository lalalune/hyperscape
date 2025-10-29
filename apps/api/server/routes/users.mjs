/**
 * Users API Routes
 * Handles user profile management
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { query } from '../database/db.mjs'
import { encrypt, decrypt } from '../utils/crypto.mjs'
import {
  AddAPIKeyBodySchema,
  DeleteAPIKeyParamsSchema,
  UpdateProfileBodySchema,
  UpdateSettingsBodySchema
} from '../validation/user-schemas.mjs'
import { detectChainType } from '../utils/wallet-validation.mjs'

const router = new Hono()

/**
 * Mask an API key for display (works with both plaintext and encrypted keys)
 */
function maskApiKey(key) {
  if (!key) return ''

  // Check if this is an encrypted key (format: iv:authTag:encrypted)
  if (key.includes(':') && key.split(':').length === 3) {
    // It's encrypted, just show that it exists
    return '•••••••••••••••• (encrypted)'
  }

  // Plaintext key - mask it
  if (key.length <= 11) return key // Too short to mask properly
  return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`
}

// GET /api/users/me - Get current user profile
router.get('/me', async (c) => {
  try {
    // Get user ID from Privy authentication header
    const userId = c.req.header('x-user-id')

    if (!userId) {
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    // Find user by Privy DID
    let result = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, avatar_url, role, settings, created_at
       FROM users
       WHERE privy_user_id = $1`,
      [userId]
    )

    // If user doesn't exist, create with defaults
    if (result.rows.length === 0) {
      console.log(`[Users API] Creating new user for Privy DID: ${userId}`)

      // Get wallet addresses from request body or headers
      const body = await c.req.json().catch(() => ({}))
      const walletAddresses = body?.wallet_addresses || []
      const legacyWalletAddress = body?.wallet_address || c.req.header('x-wallet-address')

      // Get wallet addresses from header (sent by frontend as JSON array)
      const walletAddressesHeader = c.req.header('x-wallet-addresses')
      const headerWallets = walletAddressesHeader ? JSON.parse(walletAddressesHeader) : []

      // Combine into array and dedupe
      const allWallets = [...new Set([...walletAddresses, ...headerWallets, legacyWalletAddress].filter(Boolean))]

      // Check if any wallet is whitelisted for admin
      let role = 'member'
      let matchedWallet = null

      if (allWallets.length > 0) {
        console.log(`[Users API] Checking ${allWallets.length} wallet(s) for whitelist:`, allWallets)

        for (const wallet of allWallets) {
          const chainType = detectChainType(wallet)
          if (!chainType) continue

          const whitelistCheck = await query(
            'SELECT id FROM admin_whitelist WHERE wallet_address = $1 AND chain_type = $2',
            [wallet, chainType]
          )

          if (whitelistCheck.rows.length > 0) {
            role = 'admin'
            matchedWallet = wallet
            console.log(`[Users API] Wallet ${wallet} (${chainType}) found in whitelist, creating as admin`)
            break
          }
        }
      }

      // Use the primary wallet address (first one, or matched whitelisted one)
      const primaryWallet = matchedWallet || allWallets[0] || null

      result = await query(
        `INSERT INTO users (privy_user_id, wallet_address, role, settings)
         VALUES ($1, $2, $3, $4)
         RETURNING id, privy_user_id, email, wallet_address, display_name, avatar_url, role, settings, created_at`,
        [userId, primaryWallet, role, JSON.stringify({})]
      )
    } else {
      // User exists, but check if we need to update wallet address or promote role
      const user = result.rows[0]
      const body = await c.req.json().catch(() => ({}))
      const walletAddresses = body?.wallet_addresses || []
      const legacyWalletAddress = body?.wallet_address || c.req.header('x-wallet-address')

      // Get wallet addresses from header (sent by frontend as JSON array)
      const walletAddressesHeader = c.req.header('x-wallet-addresses')
      const headerWallets = walletAddressesHeader ? JSON.parse(walletAddressesHeader) : []

      // Combine into array and dedupe
      const allWallets = [...new Set([...walletAddresses, ...headerWallets, legacyWalletAddress].filter(Boolean))]

      if (allWallets.length > 0 && !user.wallet_address) {
        console.log(`[Users API] Updating wallet address for user ${userId}`)

        // Check if any wallet is whitelisted
        let matchedWallet = null
        let shouldPromote = false

        if (user.role === 'member') {
          for (const wallet of allWallets) {
            const chainType = detectChainType(wallet)
            if (!chainType) continue

            const whitelistCheck = await query(
              'SELECT id FROM admin_whitelist WHERE wallet_address = $1 AND chain_type = $2',
              [wallet, chainType]
            )

            if (whitelistCheck.rows.length > 0) {
              matchedWallet = wallet
              shouldPromote = true
              console.log(`[Users API] Wallet ${wallet} (${chainType}) found in whitelist, promoting to admin`)
              break
            }
          }
        }

        // Use matched wallet or first wallet
        const primaryWallet = matchedWallet || allWallets[0]

        if (shouldPromote) {
          await query(
            'UPDATE users SET wallet_address = $1, role = $2 WHERE privy_user_id = $3',
            [primaryWallet, 'admin', userId]
          )
        } else {
          await query(
            'UPDATE users SET wallet_address = $1 WHERE privy_user_id = $2',
            [primaryWallet, userId]
          )
        }

        // Re-fetch user with updated data
        result = await query(
          `SELECT id, privy_user_id, email, wallet_address, display_name, avatar_url, role, settings, created_at
           FROM users
           WHERE privy_user_id = $1`,
          [userId]
        )
      }
    }

    const user = result.rows[0]

    return c.json({
      id: user.id,
      privy_user_id: user.privy_user_id,
      email: user.email,
      wallet_address: user.wallet_address,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
      settings: user.settings || {},
      created_at: user.created_at
    })
  } catch (error) {
    console.error('[Users API] Error fetching user profile:', error)
    return c.json({ error: 'Failed to fetch user profile' }, 500)
  }
})

// PUT /api/users/me - Update user profile
router.put('/me', zValidator('json', UpdateProfileBodySchema), async (c) => {
  const startTime = Date.now()

  try {
    const userId = c.req.header('x-user-id')

    if (!userId) {
      console.warn('[Users API] PUT /me - No user ID in headers')
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    console.log(`[Users API] PUT /me - User: ${userId}`)
    const { display_name, email, avatar_url } = c.req.valid('json')

    // Build dynamic update query
    const updates = []
    const params = []
    let paramCount = 1

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount++}`)
      params.push(display_name)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`)
      params.push(email)
    }
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`)
      params.push(avatar_url)
    }

    if (updates.length === 0) {
      return c.json({ error: 'No updates provided' }, 400)
    }

    // Always update updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(userId)

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE privy_user_id = $${paramCount}
       RETURNING id, privy_user_id, email, wallet_address, display_name, avatar_url, role, settings, created_at, updated_at`,
      params
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const user = result.rows[0]

    console.log(`[Users API] PUT /me - User: ${userId} - completed in ${Date.now() - startTime}ms`)
    return c.json({
      id: user.id,
      privy_user_id: user.privy_user_id,
      email: user.email,
      wallet_address: user.wallet_address,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
      settings: user.settings || {},
      created_at: user.created_at,
      updated_at: user.updated_at
    })
  } catch (error) {
    console.error(`[Users API] Error updating user profile - failed in ${Date.now() - startTime}ms:`, error)
    return c.json({ error: 'Failed to update user profile' }, 500)
  }
})

// PUT /api/users/me/settings - Update user settings
router.put('/me/settings', zValidator('json', UpdateSettingsBodySchema), async (c) => {
  const startTime = Date.now()

  try {
    const userId = c.req.header('x-user-id')

    if (!userId) {
      console.warn('[Users API] PUT /me/settings - No user ID in headers')
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    console.log(`[Users API] PUT /me/settings - User: ${userId}`)
    const { settings } = c.req.valid('json')

    // First, get current settings to merge
    const currentResult = await query(
      `SELECT settings FROM users WHERE privy_user_id = $1`,
      [userId]
    )

    if (currentResult.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const currentSettings = currentResult.rows[0].settings || {}
    const mergedSettings = { ...currentSettings, ...settings }

    // Update with merged settings
    const result = await query(
      `UPDATE users
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE privy_user_id = $2
       RETURNING settings`,
      [JSON.stringify(mergedSettings), userId]
    )

    const duration = Date.now() - startTime
    console.log(`[Users API] PUT /me/settings - User ${userId} settings updated successfully in ${duration}ms`)

    return c.json({
      settings: result.rows[0].settings
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Users API] Error updating user settings in PUT /me/settings - failed in ${duration}ms:`, error)
    return c.json({ error: 'Failed to update user settings' }, 500)
  }
})

// PATCH /api/users/me/last-login - Update last login timestamp
router.patch('/me/last-login', async (c) => {
  try {
    const userId = c.req.header('x-user-id')

    if (!userId) {
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    const result = await query(
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP
       WHERE privy_user_id = $1
       RETURNING last_login_at`,
      [userId]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({
      success: true,
      last_login_at: result.rows[0].last_login_at
    })
  } catch (error) {
    console.error('[Users API] Error updating last login:', error)
    return c.json({ error: 'Failed to update last login' }, 500)
  }
})

// GET /api/users/me/api-keys - Get user's third-party API keys (encrypted)
router.get('/me/api-keys', async (c) => {
  try {
    const userId = c.req.header('x-user-id')

    if (!userId) {
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    // Get user settings
    const result = await query(
      `SELECT settings FROM users WHERE privy_user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const settings = result.rows[0].settings || {}
    const apiKeys = settings.apiKeys || {}

    // Return masked keys for display (decrypts and masks)
    const maskedKeys = []
    
    if (apiKeys.openai) {
      maskedKeys.push({
        provider: 'openai',
        maskedKey: maskApiKey(apiKeys.openai),
        isActive: true,
        lastUsedAt: apiKeys.openaiLastUsed || null,
        createdAt: apiKeys.openaiCreatedAt || new Date().toISOString()
      })
    }

    if (apiKeys.meshy) {
      maskedKeys.push({
        provider: 'meshy',
        maskedKey: maskApiKey(apiKeys.meshy),
        isActive: true,
        lastUsedAt: apiKeys.meshyLastUsed || null,
        createdAt: apiKeys.meshyCreatedAt || new Date().toISOString()
      })
    }

    if (apiKeys.elevenlabs) {
      maskedKeys.push({
        provider: 'elevenlabs',
        maskedKey: maskApiKey(apiKeys.elevenlabs),
        isActive: true,
        lastUsedAt: apiKeys.elevenlabsLastUsed || null,
        createdAt: apiKeys.elevenlabsCreatedAt || new Date().toISOString()
      })
    }

    return c.json(maskedKeys)
  } catch (error) {
    console.error('[Users API] Error fetching API keys:', error)
    return c.json({ error: 'Failed to fetch API keys' }, 500)
  }
})

// POST /api/users/me/api-keys - Add or update third-party API key
router.post('/me/api-keys', zValidator('json', AddAPIKeyBodySchema), async (c) => {
  const startTime = Date.now()

  try {
    const userId = c.req.header('x-user-id')
    const { provider, apiKey } = c.req.valid('json')

    if (!userId) {
      console.warn('[Users API] POST /me/api-keys - No user ID in headers')
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    console.log(`[Users API] POST /me/api-keys - User: ${userId}, Provider: ${provider}`)

    // Get current settings
    const currentResult = await query(
      `SELECT settings FROM users WHERE privy_user_id = $1`,
      [userId]
    )

    if (currentResult.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const currentSettings = currentResult.rows[0].settings || {}
    const apiKeys = currentSettings.apiKeys || {}

    // Encrypt the API key before storing (uses crypto.encrypt with ENCRYPTION_SECRET)
    const encryptedKey = encrypt(apiKey)

    apiKeys[provider] = encryptedKey
    apiKeys[`${provider}CreatedAt`] = new Date().toISOString()
    apiKeys[`${provider}LastUsed`] = null

    const mergedSettings = {
      ...currentSettings,
      apiKeys
    }

    // Update settings
    await query(
      `UPDATE users
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE privy_user_id = $2`,
      [JSON.stringify(mergedSettings), userId]
    )

    const duration = Date.now() - startTime
    console.log(`[Users API] POST /me/api-keys - Success (${duration}ms) - Provider: ${provider}`)

    return c.json({
      success: true,
      message: `${provider} API key added successfully`,
      provider
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Users API] POST /me/api-keys - Error (${duration}ms):`, error.message)
    return c.json({ error: 'Failed to add API key' }, 500)
  }
})

// DELETE /api/users/me/api-keys/:provider - Delete third-party API key
router.delete('/me/api-keys/:provider', zValidator('param', DeleteAPIKeyParamsSchema), async (c) => {
  const startTime = Date.now()

  try {
    const userId = c.req.header('x-user-id')
    const { provider } = c.req.valid('param')

    if (!userId) {
      console.warn('[Users API] DELETE /me/api-keys/:provider - No user ID in headers')
      return c.json({ error: 'User ID not provided in headers' }, 401)
    }

    console.log(`[Users API] DELETE /me/api-keys/${provider} - User: ${userId}`)

    // Get current settings
    const currentResult = await query(
      `SELECT settings FROM users WHERE privy_user_id = $1`,
      [userId]
    )

    if (currentResult.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const currentSettings = currentResult.rows[0].settings || {}
    const apiKeys = currentSettings.apiKeys || {}

    // Remove the API key
    delete apiKeys[provider]
    delete apiKeys[`${provider}CreatedAt`]
    delete apiKeys[`${provider}LastUsed`]

    const mergedSettings = {
      ...currentSettings,
      apiKeys
    }

    // Update settings
    await query(
      `UPDATE users
       SET settings = $1, updated_at = CURRENT_TIMESTAMP
       WHERE privy_user_id = $2`,
      [JSON.stringify(mergedSettings), userId]
    )

    const duration = Date.now() - startTime
    console.log(`[Users API] DELETE /me/api-keys/${provider} - Success (${duration}ms)`)

    return c.json({
      success: true,
      message: `${provider} API key deleted successfully`
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Users API] DELETE /me/api-keys/${provider} - Error (${duration}ms):`, error.message)
    return c.json({ error: 'Failed to delete API key' }, 500)
  }
})

/**
 * Helper function to get decrypted API key for a provider
 * Used by services that need to actually call external APIs
 * 
 * SECURITY: This function enforces server-side ownership by querying the database
 * with privy_user_id as a constraint. It only returns keys that belong to the
 * specified user, preventing unauthorized access to other users' API keys.
 * 
 * @param {string} privyUserId - Validated Privy user ID (must be pre-validated)
 * @param {string} provider - API provider (openai, meshy, elevenlabs)
 * @returns {Promise<string|null>} Decrypted API key or null if not found
 */
export async function getUserApiKey(privyUserId, provider) {
  try {
    // Query enforces ownership: only returns keys for THIS specific user
    const result = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [privyUserId]
    )

    if (result.rows.length === 0) {
      console.log(`[Users API] No user found for userId: ${privyUserId}`)
      return null
    }

    const settings = result.rows[0].settings || {}
    const apiKeys = settings.apiKeys || {}
    const encryptedKey = apiKeys[provider]

    if (!encryptedKey) {
      console.log(`[Users API] No ${provider} API key found for user: ${privyUserId}`)
      return null
    }

    // Decrypt the key
    const decryptedKey = decrypt(encryptedKey)
    console.log(`[Users API] Successfully retrieved ${provider} API key for user: ${privyUserId}`)
    return decryptedKey
  } catch (error) {
    console.error(`[Users API] Error getting API key for ${provider}:`, error)
    return null
  }
}

/**
 * Get all user API keys (decrypted) for services
 * Returns: { openai: '...', meshy: '...', elevenlabs: '...' }
 */
export async function getUserApiKeys(privyUserId) {
  try {
    const result = await query(
      'SELECT settings FROM users WHERE privy_user_id = $1',
      [privyUserId]
    )

    if (result.rows.length === 0) {
      return {}
    }

    const settings = result.rows[0].settings || {}
    const apiKeys = settings.apiKeys || {}

    const decryptedKeys = {}
    
    if (apiKeys.openai) {
      decryptedKeys.openai = decrypt(apiKeys.openai)
    }
    if (apiKeys.meshy) {
      decryptedKeys.meshy = decrypt(apiKeys.meshy)
    }
    if (apiKeys.elevenlabs) {
      decryptedKeys.elevenlabs = decrypt(apiKeys.elevenlabs)
    }

    return decryptedKeys
  } catch (error) {
    console.error('[Users API] Error getting user API keys:', error)
    return {}
  }
}

export default router
