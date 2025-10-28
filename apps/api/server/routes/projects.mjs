/**
 * Projects API Routes
 * Handles project CRUD operations
 */

import express from 'express'
import { query } from '../database/db.mjs'

const router = express.Router()

// GET /api/projects - Get all projects for a user
router.get('/', async (req, res) => {
  try {
    // In production, get user_id from authenticated session
    // For now, we'll return all projects or filter by query param
    const userId = req.query.userId

    let sql = `
      SELECT
        p.*,
        u.display_name as owner_name,
        (SELECT COUNT(*) FROM assets WHERE project_id = p.id) as asset_count,
        (SELECT json_agg(tm.user_id) FROM team_members tm WHERE tm.team_id = p.team_id) as team_members
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

    // Return array directly (not wrapped in {projects:[]})
    res.json(result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
      type: row.metadata?.type || 'game',
      gameStyle: row.metadata?.gameStyle,
      gameType: row.metadata?.gameType,
      artDirection: row.metadata?.artDirection,
      teamSize: row.metadata?.teamSize,
      tags: row.metadata?.tags || [],
      ownerId: row.owner_id,
      teamMembers: row.team_members || [],
      isPublic: row.metadata?.isPublic || false,
      shareId: row.metadata?.shareId,
        assetCount: parseInt(row.asset_count) || 0,
        createdAt: row.created_at,
      updatedAt: row.updated_at
    })))
  } catch (error) {
    console.error('[Projects API] Error fetching projects:', error)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// GET /api/projects/:id - Get a single project
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.display_name as owner_name
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = $1 AND p.status != 'deleted'`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('[Projects API] Error fetching project:', error)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      userId, 
      type = 'game',
      gameStyle,
      gameType,
      artDirection,
      teamSize,
      tags,
      isPublic = false,
      status = 'active' 
    } = req.body

    if (!name || !userId) {
      return res.status(400).json({ error: 'Name and userId are required' })
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

    // Build metadata object with all project-specific fields
    const metadata = {
      type,
      gameStyle,
      gameType,
      artDirection,
      teamSize,
      tags: tags || [],
      isPublic
    }

    const result = await query(
      `INSERT INTO projects (name, description, owner_id, status, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description, userUuid, status, JSON.stringify(metadata)]
    )

    const project = result.rows[0]

    res.status(201).json({
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.metadata.type,
      gameStyle: project.metadata.gameStyle,
      gameType: project.metadata.gameType,
      artDirection: project.metadata.artDirection,
      teamSize: project.metadata.teamSize,
      tags: project.metadata.tags || [],
      ownerId: project.owner_id,
      teamMembers: [],
      isPublic: project.metadata.isPublic,
      assetCount: 0,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    })
  } catch (error) {
    console.error('[Projects API] Error creating project:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// PUT /api/projects/:id - Update a project (using PUT to match frontend)
router.put('/:id', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      status,
      type,
      gameStyle,
      gameType,
      artDirection,
      teamSize,
      tags,
      isPublic
    } = req.body

    // Get current project to merge metadata
    const currentResult = await query(
      'SELECT * FROM projects WHERE id = $1 AND status != \'deleted\'',
      [req.params.id]
    )

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const current = currentResult.rows[0]
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

    // Merge metadata fields
    const currentMetadata = current.metadata || {}
    const newMetadata = {
      ...currentMetadata,
      ...(type !== undefined && { type }),
      ...(gameStyle !== undefined && { gameStyle }),
      ...(gameType !== undefined && { gameType }),
      ...(artDirection !== undefined && { artDirection }),
      ...(teamSize !== undefined && { teamSize }),
      ...(tags !== undefined && { tags }),
      ...(isPublic !== undefined && { isPublic })
    }

    updates.push(`metadata = $${paramCount++}`)
    params.push(JSON.stringify(newMetadata))

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    params.push(req.params.id)

    const result = await query(
      `UPDATE projects
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount} AND status != 'deleted'
       RETURNING *`,
      params
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const project = result.rows[0]

    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.metadata?.type || 'game',
      gameStyle: project.metadata?.gameStyle,
      gameType: project.metadata?.gameType,
      artDirection: project.metadata?.artDirection,
      teamSize: project.metadata?.teamSize,
      tags: project.metadata?.tags || [],
      ownerId: project.owner_id,
      teamMembers: [],
      isPublic: project.metadata?.isPublic || false,
      shareId: project.metadata?.shareId,
      assetCount: 0,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    })
  } catch (error) {
    console.error('[Projects API] Error updating project:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

// DELETE /api/projects/:id - Delete a project (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      `UPDATE projects
       SET status = 'deleted', archived_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json({ success: true, message: 'Project deleted' })
  } catch (error) {
    console.error('[Projects API] Error deleting project:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

// POST /api/projects/:id/share - Share a project (generates public share link)
router.post('/:id/share', async (req, res) => {
  try {
    // Generate a unique share ID
    const { randomBytes } = await import('crypto')
    const shareId = randomBytes(16).toString('hex')

    // Get current project
    const currentResult = await query(
      'SELECT * FROM projects WHERE id = $1 AND status != \'deleted\'',
      [req.params.id]
    )

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const current = currentResult.rows[0]
    const metadata = {
      ...(current.metadata || {}),
      isPublic: true,
      shareId
    }

    // Update project with share ID and make it public
    await query(
      `UPDATE projects
       SET metadata = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(metadata), req.params.id]
    )

    // Construct share URL (frontend URL + /share/ + shareId)
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${shareId}`

    res.json({
      shareId,
      shareUrl
    })
  } catch (error) {
    console.error('[Projects API] Error sharing project:', error)
    res.status(500).json({ error: 'Failed to share project' })
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
