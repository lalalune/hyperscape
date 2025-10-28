/**
 * Projects API Routes
 * Handles project CRUD operations
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'

const router = new Hono()

// GET /api/projects - Get all projects for a user
router.get('/', async (c) => {
  try {
    // In production, get user_id from authenticated session
    // For now, we'll return all projects or filter by query param
    const userId = c.req.query('userId')

    let sql = `
      SELECT
        p.*,
        u.display_name as owner_name,
        (SELECT COUNT(*) FROM assets WHERE project_id = p.id) as asset_count
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.status != 'deleted'
    `

    const params = []
    if (userId) {
      // Support both UUID and Privy DID formats
      sql += ' AND u.privy_user_id = $1'
      params.push(userId)
    }

    sql += ' ORDER BY p.updated_at DESC'

    const result = await query(sql, params)

    return c.json({
      projects: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        assetCount: parseInt(row.asset_count) || 0,
        lastModified: formatTimeAgo(row.updated_at),
        createdAt: row.created_at,
        userId: row.owner_id
      }))
    })
  } catch (error) {
    console.error('[Projects API] Error fetching projects:', error)
    return c.json({ error: 'Failed to fetch projects' }, 500)
  }
})

// GET /api/projects/:id - Get a single project
router.get('/:id', async (c) => {
  try {
    const result = await query(
      `SELECT p.*, u.display_name as owner_name
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1 AND p.status != 'deleted'`,
      [c.req.param('id')]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(result.rows[0])
  } catch (error) {
    console.error('[Projects API] Error fetching project:', error)
    return c.json({ error: 'Failed to fetch project' }, 500)
  }
})

// POST /api/projects - Create a new project
router.post('/', async (c) => {
  try {
    const { name, description, userId, status = 'active' } = await c.req.json()

    if (!name || !userId) {
      return c.json({ error: 'Name and userId are required' }, 400)
    }

    // First, ensure user exists or create them, and get their UUID
    const userResult = await query(
      `INSERT INTO users (privy_user_id, display_name)
       VALUES ($1, $2)
       ON CONFLICT (privy_user_id) DO UPDATE SET privy_user_id = EXCLUDED.privy_user_id
       RETURNING id`,
      [userId, 'User']
    )

    const userUuid = userResult.rows[0].id

    const result = await query(
      `INSERT INTO projects (name, description, owner_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, userUuid, status]
    )

    const project = result.rows[0]

    return c.json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      assetCount: 0,
      lastModified: formatTimeAgo(project.updated_at),
      createdAt: project.created_at,
      userId: project.owner_id
    }, 201)
  } catch (error) {
    console.error('[Projects API] Error creating project:', error)
    return c.json({ error: 'Failed to create project' }, 500)
  }
})

// PATCH /api/projects/:id - Update a project
router.patch('/:id', async (c) => {
  try {
    const { name, description, status } = await c.req.json()
    const updates = []
    const params = []
    let paramCount = 1

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`)
      params.push(name)
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      params.push(description)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`)
      params.push(status)
    }

    if (updates.length === 0) {
      return c.json({ error: 'No updates provided' }, 400)
    }

    params.push(c.req.param('id'))

    const result = await query(
      `UPDATE projects
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND status != 'deleted'
       RETURNING *`,
      params
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const project = result.rows[0]

    return c.json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      assetCount: 0,
      lastModified: formatTimeAgo(project.updated_at),
      createdAt: project.created_at,
      userId: project.owner_id
    })
  } catch (error) {
    console.error('[Projects API] Error updating project:', error)
    return c.json({ error: 'Failed to update project' }, 500)
  }
})

// DELETE /api/projects/:id - Delete a project (soft delete)
router.delete('/:id', async (c) => {
  try {
    const result = await query(
      `UPDATE projects
       SET status = 'deleted', archived_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [c.req.param('id')]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ success: true, message: 'Project deleted' })
  } catch (error) {
    console.error('[Projects API] Error deleting project:', error)
    return c.json({ error: 'Failed to delete project' }, 500)
  }
})

// Helper function to format time ago
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`
    }
  }

  return 'just now'
}

export default router
