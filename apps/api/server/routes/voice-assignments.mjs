/**
 * Voice Assignments API Routes
 * Handles voice assignment persistence for NPCs and Mobs from game manifests
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'

const router = new Hono()

/**
 * GET /api/voice-assignments/:manifestId
 * Get voice assignments for a specific manifest
 */
router.get('/:manifestId', async (c) => {
  try {
    const manifestId = c.req.param('manifestId')

    const result = await query(
      'SELECT * FROM voice_manifests WHERE id = $1',
      [manifestId]
    )

    if (result.rows.length === 0) {
      return c.json({
        error: `Voice manifest '${manifestId}' not found`
      }, 404)
    }

    const manifest = result.rows[0]

    return c.json({
      manifestId: manifest.id,
      name: manifest.name,
      description: manifest.description,
      assignments: manifest.voice_assignments || [],
      version: manifest.version,
      updatedAt: manifest.updated_at,
      createdAt: manifest.created_at
    })
  } catch (error) {
    console.error('[VoiceAssignments API] Error retrieving assignments:', error)
    return c.json({
      error: 'Failed to retrieve voice assignments',
      details: error.message
    }, 500)
  }
})

/**
 * POST /api/voice-assignments
 * Create new voice assignments manifest
 */
router.post('/', async (c) => {
  try {
    const { name, description, assignments, projectId, ownerId } = await c.req.json()

    // Validate required fields
    if (!name) {
      return c.json({ error: 'name is required' }, 400)
    }

    if (!assignments || !Array.isArray(assignments)) {
      return c.json({ error: 'assignments array is required' }, 400)
    }

    if (!ownerId) {
      return c.json({ error: 'ownerId is required' }, 400)
    }

    // Validate assignment structure
    for (const assignment of assignments) {
      if (!assignment.npcId || !assignment.voiceId || !assignment.voiceName) {
        return c.json({
          error: 'Each assignment must have npcId, voiceId, and voiceName'
        }, 400)
      }
    }

    const result = await query(
      `INSERT INTO voice_manifests (name, description, voice_assignments, project_id, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description, JSON.stringify(assignments), projectId || null, ownerId]
    )

    const manifest = result.rows[0]

    return c.json({
      success: true,
      message: 'Voice assignments created successfully',
      manifestId: manifest.id,
      assignments: manifest.voice_assignments,
      createdAt: manifest.created_at
    }, 201)
  } catch (error) {
    console.error('[VoiceAssignments API] Error creating assignments:', error)
    return c.json({
      error: 'Failed to create voice assignments',
      details: error.message
    }, 500)
  }
})

/**
 * PUT /api/voice-assignments/:manifestId
 * Update existing voice assignments
 */
router.put('/:manifestId', async (c) => {
  try {
    const manifestId = c.req.param('manifestId')
    const { name, description, assignments } = await c.req.json()

    // Check if manifest exists
    const existing = await query(
      'SELECT * FROM voice_manifests WHERE id = $1',
      [manifestId]
    )

    if (existing.rows.length === 0) {
      return c.json({
        error: `Voice manifest '${manifestId}' not found`
      }, 404)
    }

    // Validate assignments if provided
    if (assignments) {
      if (!Array.isArray(assignments)) {
        return c.json({ error: 'assignments must be an array' }, 400)
      }

      for (const assignment of assignments) {
        if (!assignment.npcId || !assignment.voiceId || !assignment.voiceName) {
          return c.json({
            error: 'Each assignment must have npcId, voiceId, and voiceName'
          }, 400)
        }
      }
    }

    // Build dynamic update query
    const updates = []
    const values = []
    let paramCount = 1

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`)
      values.push(name)
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`)
      values.push(description)
    }

    if (assignments !== undefined) {
      updates.push(`voice_assignments = $${paramCount++}`)
      values.push(JSON.stringify(assignments))
    }

    // Increment version
    updates.push(`version = version + 1`)

    if (updates.length === 1) {
      return c.json({
        error: 'No valid fields to update'
      }, 400)
    }

    values.push(manifestId)

    const result = await query(
      `UPDATE voice_manifests
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    )

    const manifest = result.rows[0]

    return c.json({
      success: true,
      message: 'Voice assignments updated successfully',
      manifestId: manifest.id,
      assignments: manifest.voice_assignments,
      version: manifest.version,
      updatedAt: manifest.updated_at
    })
  } catch (error) {
    console.error('[VoiceAssignments API] Error updating assignments:', error)
    return c.json({
      error: 'Failed to update voice assignments',
      details: error.message
    }, 500)
  }
})

/**
 * DELETE /api/voice-assignments/:manifestId
 * Delete voice assignments manifest
 */
router.delete('/:manifestId', async (c) => {
  try {
    const manifestId = c.req.param('manifestId')

    const result = await query(
      'DELETE FROM voice_manifests WHERE id = $1 RETURNING *',
      [manifestId]
    )

    if (result.rows.length === 0) {
      return c.json({
        error: `Voice manifest '${manifestId}' not found`
      }, 404)
    }

    return c.json({
      success: true,
      message: 'Voice assignments deleted successfully',
      manifestId
    })
  } catch (error) {
    console.error('[VoiceAssignments API] Error deleting assignments:', error)
    return c.json({
      error: 'Failed to delete voice assignments',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice-assignments/by-owner/:ownerId
 * Get all voice assignment manifests for a specific owner
 */
router.get('/by-owner/:ownerId', async (c) => {
  try {
    const ownerId = c.req.param('ownerId')

    const result = await query(
      `SELECT * FROM voice_manifests
       WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [ownerId]
    )

    const manifests = result.rows.map(row => ({
      manifestId: row.id,
      name: row.name,
      description: row.description,
      assignments: row.voice_assignments || [],
      version: row.version,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return c.json({
      count: manifests.length,
      manifests
    })
  } catch (error) {
    console.error('[VoiceAssignments API] Error retrieving owner manifests:', error)
    return c.json({
      error: 'Failed to retrieve voice assignments',
      details: error.message
    }, 500)
  }
})

/**
 * GET /api/voice-assignments/by-project/:projectId
 * Get all voice assignment manifests for a specific project
 */
router.get('/by-project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')

    const result = await query(
      `SELECT * FROM voice_manifests
       WHERE project_id = $1
       ORDER BY updated_at DESC`,
      [projectId]
    )

    const manifests = result.rows.map(row => ({
      manifestId: row.id,
      name: row.name,
      description: row.description,
      assignments: row.voice_assignments || [],
      version: row.version,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return c.json({
      count: manifests.length,
      manifests
    })
  } catch (error) {
    console.error('[VoiceAssignments API] Error retrieving project manifests:', error)
    return c.json({
      error: 'Failed to retrieve voice assignments',
      details: error.message
    }, 500)
  }
})

export default router
