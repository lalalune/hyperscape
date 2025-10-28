/**
 * AI Context Preferences API Routes
 * Manages user preferences for AI context building
 */

import { Hono } from 'hono'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../database/db.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = new Hono()

/**
 * Convert Privy user ID to internal UUID
 */
async function getUserId(privyUserId) {
  const result = await query(
    'SELECT id FROM users WHERE privy_user_id = $1',
    [privyUserId]
  )
  return result.rows[0]?.id
}

/**
 * Default AI context preferences
 */
const DEFAULT_PREFERENCES = {
  useOwnPreview: true,
  useCdnContent: true,
  useTeamPreview: true,
  useAllSubmissions: false,
  maxContextItems: 100,
  preferRecent: true
}

/**
 * GET /api/ai-context/preferences
 * Get user's AI context preferences
 */
router.get('/preferences', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Try to get existing preferences
    let result = await query(
      'SELECT * FROM ai_context_preferences WHERE user_id = $1',
      [userId]
    )

    // If doesn't exist, create with defaults
    if (result.rows.length === 0) {
      result = await query(
        `INSERT INTO ai_context_preferences (
          user_id,
          use_own_preview,
          use_cdn_content,
          use_team_preview,
          use_all_submissions,
          max_context_items,
          prefer_recent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          DEFAULT_PREFERENCES.useOwnPreview,
          DEFAULT_PREFERENCES.useCdnContent,
          DEFAULT_PREFERENCES.useTeamPreview,
          DEFAULT_PREFERENCES.useAllSubmissions,
          DEFAULT_PREFERENCES.maxContextItems,
          DEFAULT_PREFERENCES.preferRecent
        ]
      )
    }

    const prefs = result.rows[0]

    return c.json({
      id: prefs.id,
      userId: prefs.user_id,
      useOwnPreview: prefs.use_own_preview,
      useCdnContent: prefs.use_cdn_content,
      useTeamPreview: prefs.use_team_preview,
      useAllSubmissions: prefs.use_all_submissions,
      maxContextItems: prefs.max_context_items,
      preferRecent: prefs.prefer_recent,
      createdAt: prefs.created_at,
      updatedAt: prefs.updated_at
    })
  } catch (error) {
    console.error('[AI Context] Error fetching preferences:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * PUT /api/ai-context/preferences
 * Update user's AI context preferences
 */
router.put('/preferences', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const body = await c.req.json()
    const {
      useOwnPreview,
      useCdnContent,
      useTeamPreview,
      useAllSubmissions,
      maxContextItems,
      preferRecent
    } = body

    // Check if preferences exist
    const existingResult = await query(
      'SELECT id FROM ai_context_preferences WHERE user_id = $1',
      [userId]
    )

    let result
    if (existingResult.rows.length === 0) {
      // Insert new preferences
      result = await query(
        `INSERT INTO ai_context_preferences (
          user_id,
          use_own_preview,
          use_cdn_content,
          use_team_preview,
          use_all_submissions,
          max_context_items,
          prefer_recent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          useOwnPreview ?? DEFAULT_PREFERENCES.useOwnPreview,
          useCdnContent ?? DEFAULT_PREFERENCES.useCdnContent,
          useTeamPreview ?? DEFAULT_PREFERENCES.useTeamPreview,
          useAllSubmissions ?? DEFAULT_PREFERENCES.useAllSubmissions,
          maxContextItems ?? DEFAULT_PREFERENCES.maxContextItems,
          preferRecent ?? DEFAULT_PREFERENCES.preferRecent
        ]
      )
    } else {
      // Update existing preferences
      const updates = []
      const values = []
      let paramCount = 1

      if (useOwnPreview !== undefined) {
        updates.push(`use_own_preview = $${paramCount++}`)
        values.push(useOwnPreview)
      }
      if (useCdnContent !== undefined) {
        updates.push(`use_cdn_content = $${paramCount++}`)
        values.push(useCdnContent)
      }
      if (useTeamPreview !== undefined) {
        updates.push(`use_team_preview = $${paramCount++}`)
        values.push(useTeamPreview)
      }
      if (useAllSubmissions !== undefined) {
        updates.push(`use_all_submissions = $${paramCount++}`)
        values.push(useAllSubmissions)
      }
      if (maxContextItems !== undefined) {
        updates.push(`max_context_items = $${paramCount++}`)
        values.push(maxContextItems)
      }
      if (preferRecent !== undefined) {
        updates.push(`prefer_recent = $${paramCount++}`)
        values.push(preferRecent)
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`)
      values.push(userId)

      result = await query(
        `UPDATE ai_context_preferences
         SET ${updates.join(', ')}
         WHERE user_id = $${paramCount}
         RETURNING *`,
        values
      )
    }

    const prefs = result.rows[0]

    return c.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: {
        id: prefs.id,
        useOwnPreview: prefs.use_own_preview,
        useCdnContent: prefs.use_cdn_content,
        useTeamPreview: prefs.use_team_preview,
        useAllSubmissions: prefs.use_all_submissions,
        maxContextItems: prefs.max_context_items,
        preferRecent: prefs.prefer_recent,
        updatedAt: prefs.updated_at
      }
    })
  } catch (error) {
    console.error('[AI Context] Error updating preferences:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * POST /api/ai-context/build
 * Build combined manifest context based on user preferences
 */
router.post('/build', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const body = await c.req.json()
    const { manifestType } = body

    if (!manifestType) {
      return c.json({ error: 'manifestType is required' }, 400)
    }

    // Get user's preferences
    const prefsResult = await query(
      'SELECT * FROM ai_context_preferences WHERE user_id = $1',
      [userId]
    )

    const prefs = prefsResult.rows[0] || DEFAULT_PREFERENCES

    const allItems = []
    const sources = {
      cdn: 0,
      preview: 0,
      team: 0,
      submissions: 0
    }

    // 1. Get items from user's own preview manifest
    if (prefs.use_own_preview) {
      const previewResult = await query(
        `SELECT content FROM preview_manifests
         WHERE user_id = $1 AND manifest_type = $2`,
        [userId, manifestType]
      )

      if (previewResult.rows.length > 0) {
        const previewItems = previewResult.rows[0].content || []
        allItems.push(...previewItems)
        sources.preview = previewItems.length
      }
    }

    // 2. Get items from CDN content (manifest files)
    if (prefs.use_cdn_content) {
      try {
        const manifestPath = path.join(
          __dirname,
          '../../../..',
          'packages/server/world/assets/manifests',
          `${manifestType}.json`
        )

        const content = await fs.readFile(manifestPath, 'utf-8')
        const cdnData = JSON.parse(content)

        const cdnItems = Array.isArray(cdnData) ? cdnData : Object.values(cdnData)
        allItems.push(...cdnItems)
        sources.cdn = cdnItems.length
      } catch (error) {
        // Manifest file doesn't exist or can't be read - that's ok
        console.log(`[AI Context] No CDN manifest found for ${manifestType}`)
      }
    }

    // 3. Get items from team preview manifests
    if (prefs.use_team_preview) {
      // Get user's teams
      const teamsResult = await query(
        `SELECT team_id FROM team_members WHERE user_id = $1`,
        [userId]
      )

      for (const team of teamsResult.rows) {
        const teamPreviewResult = await query(
          `SELECT content FROM preview_manifests
           WHERE team_id = $1 AND manifest_type = $2`,
          [team.team_id, manifestType]
        )

        if (teamPreviewResult.rows.length > 0) {
          const teamItems = teamPreviewResult.rows[0].content || []
          allItems.push(...teamItems)
          sources.team += teamItems.length
        }
      }
    }

    // 4. Get items from all submissions (if enabled)
    if (prefs.use_all_submissions) {
      const submissionsResult = await query(
        `SELECT item_data, edited_item_data, was_edited
         FROM manifest_submissions
         WHERE status = 'pending' AND manifest_type = $1`,
        [manifestType]
      )

      for (const submission of submissionsResult.rows) {
        const itemData = submission.was_edited && submission.edited_item_data
          ? submission.edited_item_data
          : submission.item_data
        allItems.push(itemData)
        sources.submissions++
      }
    }

    // Remove duplicates by id
    const uniqueItems = []
    const seenIds = new Set()

    for (const item of allItems) {
      if (item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id)
        uniqueItems.push(item)
      }
    }

    // Sort by most recent if preferRecent is enabled
    if (prefs.prefer_recent) {
      uniqueItems.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0)
        const dateB = new Date(b.createdAt || b.created_at || 0)
        return dateB - dateA
      })
    }

    // Limit to maxContextItems
    const maxItems = prefs.max_context_items || DEFAULT_PREFERENCES.maxContextItems
    const limitedItems = uniqueItems.slice(0, maxItems)

    return c.json({
      manifestType,
      items: limitedItems,
      sources,
      totalItems: limitedItems.length,
      wasLimited: uniqueItems.length > maxItems,
      originalCount: uniqueItems.length
    })
  } catch (error) {
    console.error('[AI Context] Error building context:', error)
    return c.json({ error: error.message }, 500)
  }
})

export default router
