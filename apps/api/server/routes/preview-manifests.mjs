/**
 * Preview Manifests API Routes
 * Manages user and team preview manifests for AI content generation
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'

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
 * GET /api/preview-manifests
 * Get all user's preview manifests or filtered by type
 */
router.get('/', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const type = c.req.query('type')

    let result
    if (type) {
      result = await query(
        `SELECT * FROM preview_manifests
         WHERE user_id = $1 AND manifest_type = $2
         ORDER BY updated_at DESC`,
        [userId, type]
      )
    } else {
      result = await query(
        `SELECT * FROM preview_manifests
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
      )
    }

    return c.json({
      count: result.rows.length,
      manifests: result.rows.map(row => ({
        id: row.id,
        type: row.manifest_type,
        content: row.content,
        version: row.version,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    })
  } catch (error) {
    console.error('[Preview Manifests] Error fetching manifests:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/preview-manifests/:type
 * Get specific manifest type's content array
 * Auto-creates if doesn't exist
 */
router.get('/:type', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const type = c.req.param('type')

    // Try to get existing manifest
    let result = await query(
      `SELECT * FROM preview_manifests
       WHERE user_id = $1 AND manifest_type = $2`,
      [userId, type]
    )

    // If doesn't exist, create it
    if (result.rows.length === 0) {
      result = await query(
        `INSERT INTO preview_manifests (user_id, manifest_type, content)
         VALUES ($1, $2, '[]'::jsonb)
         ON CONFLICT (user_id, team_id, manifest_type) DO NOTHING
         RETURNING *`,
        [userId, type]
      )

      // If still nothing (edge case), create with explicit query
      if (result.rows.length === 0) {
        result = await query(
          `SELECT * FROM preview_manifests
           WHERE user_id = $1 AND manifest_type = $2`,
          [userId, type]
        )
      }
    }

    const manifest = result.rows[0]
    if (!manifest) {
      return c.json({ error: 'Failed to create or retrieve manifest' }, 500)
    }

    return c.json({
      id: manifest.id,
      type: manifest.manifest_type,
      content: manifest.content || [],
      version: manifest.version,
      createdAt: manifest.created_at,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error getting manifest:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/preview-manifests/:type/merged
 * Get merged view: original (published) items + user's draft items
 * This is the main endpoint for viewing manifests in Asset Forge
 */
router.get('/:type/merged', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const type = c.req.param('type')

    // Get system user ID (owner of original manifests)
    const systemUserResult = await query(
      `SELECT id FROM users WHERE privy_user_id = 'system' LIMIT 1`
    )

    if (systemUserResult.rows.length === 0) {
      return c.json({ error: 'System manifests not initialized' }, 500)
    }

    const systemUserId = systemUserResult.rows[0].id

    // Get original (published) manifest from system user
    const originalResult = await query(
      `SELECT * FROM preview_manifests
       WHERE user_id = $1 AND manifest_type = $2 AND is_original = true`,
      [systemUserId, type]
    )

    // Get user's draft manifest (if exists)
    const userResult = await query(
      `SELECT * FROM preview_manifests
       WHERE user_id = $1 AND manifest_type = $2 AND user_id != $3`,
      [userId, type, systemUserId]
    )

    // Merge content: original items + user's draft items
    const originalContent = originalResult.rows[0]?.content || []
    const userContent = userResult.rows[0]?.content || []

    // Mark each item with its source
    const markedOriginalContent = (Array.isArray(originalContent) ? originalContent : []).map(item => ({
      ...item,
      _source: 'original',
      _status: 'published',
      _editable: false
    }))

    const markedUserContent = (Array.isArray(userContent) ? userContent : []).map(item => ({
      ...item,
      _source: 'user',
      _status: userResult.rows[0]?.status || 'draft',
      _editable: true
    }))

    // Combine: user items can override original items with same ID
    const contentMap = new Map()

    // First add all original items
    for (const item of markedOriginalContent) {
      contentMap.set(item.id, item)
    }

    // Then overlay user items (override if same ID)
    for (const item of markedUserContent) {
      contentMap.set(item.id, item)
    }

    const mergedContent = Array.from(contentMap.values())

    return c.json({
      type,
      content: mergedContent,
      stats: {
        total: mergedContent.length,
        original: markedOriginalContent.length,
        user: markedUserContent.length,
        overridden: markedOriginalContent.filter(orig =>
          markedUserContent.some(user => user.id === orig.id)
        ).length
      },
      version: userResult.rows[0]?.version || originalResult.rows[0]?.version || 1,
      userManifestId: userResult.rows[0]?.id,
      updatedAt: userResult.rows[0]?.updated_at || originalResult.rows[0]?.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error getting merged manifest:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * POST /api/preview-manifests/:type/item
 * Add item to preview manifest content array
 */
router.post('/:type/item', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const type = c.req.param('type')
    const item = await c.req.json()

    if (!item || !item.id) {
      return c.json({ error: 'Item must have an id field' }, 400)
    }

    // Ensure manifest exists
    await query(
      `INSERT INTO preview_manifests (user_id, manifest_type, content)
       VALUES ($1, $2, '[]'::jsonb)
       ON CONFLICT (user_id, team_id, manifest_type) DO NOTHING`,
      [userId, type]
    )

    // Add item to content array and increment version
    const result = await query(
      `UPDATE preview_manifests
       SET content = content || $1::jsonb,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND manifest_type = $3 AND team_id IS NULL
       RETURNING *`,
      [JSON.stringify(item), userId, type]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Manifest not found' }, 404)
    }

    const manifest = result.rows[0]
    return c.json({
      id: manifest.id,
      type: manifest.manifest_type,
      content: manifest.content,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error adding item:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * PUT /api/preview-manifests/:type/:itemId
 * Update item in content array
 */
router.put('/:type/:itemId', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const type = c.req.param('type')
    const itemId = c.req.param('itemId')
    const updatedItem = await c.req.json()

    if (!updatedItem || !updatedItem.id) {
      return c.json({ error: 'Updated item must have an id field' }, 400)
    }

    // Remove old item and add updated item
    const result = await query(
      `UPDATE preview_manifests
       SET content = (
         SELECT jsonb_agg(item)
         FROM jsonb_array_elements(content) item
         WHERE item->>'id' != $1
       ) || $2::jsonb,
       version = version + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3 AND manifest_type = $4 AND team_id IS NULL
       RETURNING *`,
      [itemId, JSON.stringify(updatedItem), userId, type]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Manifest not found' }, 404)
    }

    const manifest = result.rows[0]
    return c.json({
      id: manifest.id,
      type: manifest.manifest_type,
      content: manifest.content,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error updating item:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * DELETE /api/preview-manifests/:type/:itemId
 * Delete item from content array
 */
router.delete('/:type/:itemId', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const type = c.req.param('type')
    const itemId = c.req.param('itemId')

    // Remove item from content array
    const result = await query(
      `UPDATE preview_manifests
       SET content = (
         SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
         FROM jsonb_array_elements(content) item
         WHERE item->>'id' != $1
       ),
       version = version + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND manifest_type = $3 AND team_id IS NULL
       RETURNING *`,
      [itemId, userId, type]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Manifest not found' }, 404)
    }

    const manifest = result.rows[0]
    return c.json({
      success: true,
      id: manifest.id,
      type: manifest.manifest_type,
      content: manifest.content,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error deleting item:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/preview-manifests/team/:teamId
 * Get team's preview manifests
 */
router.get('/team/:teamId', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const teamId = c.req.param('teamId')

    // Verify user is team member
    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    )

    if (memberCheck.rows.length === 0) {
      return c.json({ error: 'You are not a member of this team' }, 403)
    }

    // Get team manifests
    const result = await query(
      `SELECT * FROM preview_manifests
       WHERE team_id = $1
       ORDER BY updated_at DESC`,
      [teamId]
    )

    return c.json({
      count: result.rows.length,
      teamId,
      manifests: result.rows.map(row => ({
        id: row.id,
        type: row.manifest_type,
        content: row.content,
        version: row.version,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    })
  } catch (error) {
    console.error('[Preview Manifests] Error fetching team manifests:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * POST /api/preview-manifests/team/:teamId/:type/item
 * Add item to team preview manifest
 */
router.post('/team/:teamId/:type/item', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const teamId = c.req.param('teamId')
    const type = c.req.param('type')
    const item = await c.req.json()

    if (!item || !item.id) {
      return c.json({ error: 'Item must have an id field' }, 400)
    }

    // Verify user is team member
    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    )

    if (memberCheck.rows.length === 0) {
      return c.json({ error: 'You are not a member of this team' }, 403)
    }

    // Ensure manifest exists
    await query(
      `INSERT INTO preview_manifests (team_id, manifest_type, content)
       VALUES ($1, $2, '[]'::jsonb)
       ON CONFLICT (user_id, team_id, manifest_type) DO NOTHING`,
      [teamId, type]
    )

    // Add item to content array and increment version
    const result = await query(
      `UPDATE preview_manifests
       SET content = content || $1::jsonb,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE team_id = $2 AND manifest_type = $3 AND user_id IS NULL
       RETURNING *`,
      [JSON.stringify(item), teamId, type]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team manifest not found' }, 404)
    }

    const manifest = result.rows[0]
    return c.json({
      id: manifest.id,
      teamId,
      type: manifest.manifest_type,
      content: manifest.content,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error adding item to team manifest:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * PUT /api/preview-manifests/team/:teamId/:type/:itemId
 * Update item in team preview manifest
 */
router.put('/team/:teamId/:type/:itemId', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const teamId = c.req.param('teamId')
    const type = c.req.param('type')
    const itemId = c.req.param('itemId')
    const updatedItem = await c.req.json()

    if (!updatedItem || !updatedItem.id) {
      return c.json({ error: 'Updated item must have an id field' }, 400)
    }

    // Verify user is team member
    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    )

    if (memberCheck.rows.length === 0) {
      return c.json({ error: 'You are not a member of this team' }, 403)
    }

    // Remove old item and add updated item
    const result = await query(
      `UPDATE preview_manifests
       SET content = (
         SELECT jsonb_agg(item)
         FROM jsonb_array_elements(content) item
         WHERE item->>'id' != $1
       ) || $2::jsonb,
       version = version + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE team_id = $3 AND manifest_type = $4 AND user_id IS NULL
       RETURNING *`,
      [itemId, JSON.stringify(updatedItem), teamId, type]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team manifest not found' }, 404)
    }

    const manifest = result.rows[0]
    return c.json({
      id: manifest.id,
      teamId,
      type: manifest.manifest_type,
      content: manifest.content,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error updating team manifest item:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * DELETE /api/preview-manifests/team/:teamId/:type/:itemId
 * Delete item from team preview manifest
 */
router.delete('/team/:teamId/:type/:itemId', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    const teamId = c.req.param('teamId')
    const type = c.req.param('type')
    const itemId = c.req.param('itemId')

    // Verify user is team member
    const memberCheck = await query(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    )

    if (memberCheck.rows.length === 0) {
      return c.json({ error: 'You are not a member of this team' }, 403)
    }

    // Remove item from content array
    const result = await query(
      `UPDATE preview_manifests
       SET content = (
         SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
         FROM jsonb_array_elements(content) item
         WHERE item->>'id' != $1
       ),
       version = version + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE team_id = $2 AND manifest_type = $3 AND user_id IS NULL
       RETURNING *`,
      [itemId, teamId, type]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team manifest not found' }, 404)
    }

    const manifest = result.rows[0]
    return c.json({
      success: true,
      id: manifest.id,
      teamId,
      type: manifest.manifest_type,
      content: manifest.content,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[Preview Manifests] Error deleting team manifest item:', error)
    return c.json({ error: error.message }, 500)
  }
})

export default router
