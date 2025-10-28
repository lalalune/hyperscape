/**
 * Teams API Routes
 * Handles team CRUD operations and member management
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'
import crypto from 'crypto'

const router = new Hono()

// GET /api/teams - Get all teams for a user
router.get('/', async (c) => {
  try {
    const userId = c.req.query('userId')

    let sql = `
      SELECT
        t.*,
        u.display_name as owner_name,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
        COALESCE(
          (SELECT role FROM team_members WHERE team_id = t.id AND user_id = $1 LIMIT 1),
          CASE WHEN t.owner_id = $1 THEN 'owner' ELSE NULL END
        ) as user_role
      FROM teams t
      LEFT JOIN users u ON t.owner_id = u.id
    `

    const params = [userId || 'none']

    if (userId) {
      sql += `
        WHERE t.owner_id = $1
        OR t.id IN (SELECT team_id FROM team_members WHERE user_id = $1)
      `
    }

    sql += ' ORDER BY t.updated_at DESC'

    const result = await query(sql, params)

    // Get members for each team
    const teams = await Promise.all(result.rows.map(async (team) => {
      const membersResult = await query(
        `SELECT
          tm.id,
          tm.role,
          u.id as user_id,
          u.display_name as name,
          u.email
        FROM team_members tm
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1
        ORDER BY tm.joined_at ASC`,
        [team.id]
      )

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        role: team.user_role || 'member',
        memberCount: parseInt(team.member_count) || 0,
        members: membersResult.rows,
        createdAt: team.created_at
      }
    }))

    return c.json({ teams })
  } catch (error) {
    console.error('[Teams API] Error fetching teams:', error)
    return c.json({ error: 'Failed to fetch teams' }, 500)
  }
})

// GET /api/teams/:id - Get a single team
router.get('/:id', async (c) => {
  try {
    const result = await query(
      `SELECT t.*, u.display_name as owner_name
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.id = $1`,
      [c.req.param('id')]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    const team = result.rows[0]

    // Get members
    const membersResult = await query(
      `SELECT
        tm.id,
        tm.role,
        u.id as user_id,
        u.display_name as name,
        u.email
      FROM team_members tm
      LEFT JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.joined_at ASC`,
      [team.id]
    )

    return c.json({
      ...team,
      members: membersResult.rows
    })
  } catch (error) {
    console.error('[Teams API] Error fetching team:', error)
    return c.json({ error: 'Failed to fetch team' }, 500)
  }
})

// POST /api/teams - Create a new team
router.post('/', async (c) => {
  try {
    const { name, description, userId } = await c.req.json()

    if (!name || !userId) {
      return c.json({ error: 'Name and userId are required' }, 400)
    }

    // Ensure user exists
    await query(
      `INSERT INTO users (id, privy_user_id, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (privy_user_id) DO NOTHING`,
      [userId, userId, 'User']
    )

    const result = await query(
      `INSERT INTO teams (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, userId]
    )

    const team = result.rows[0]

    // Add creator as owner in team_members
    await query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [team.id, userId]
    )

    return c.json({
      id: team.id,
      name: team.name,
      description: team.description,
      role: 'owner',
      memberCount: 1,
      members: [],
      createdAt: team.created_at
    }, 201)
  } catch (error) {
    console.error('[Teams API] Error creating team:', error)
    return c.json({ error: 'Failed to create team' }, 500)
  }
})

// PATCH /api/teams/:id - Update a team
router.patch('/:id', async (c) => {
  try {
    const { name, description } = await c.req.json()
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

    if (updates.length === 0) {
      return c.json({ error: 'No updates provided' }, 400)
    }

    params.push(c.req.param('id'))

    const result = await query(
      `UPDATE teams
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      params
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    return c.json(result.rows[0])
  } catch (error) {
    console.error('[Teams API] Error updating team:', error)
    return c.json({ error: 'Failed to update team' }, 500)
  }
})

// DELETE /api/teams/:id - Delete a team
router.delete('/:id', async (c) => {
  try {
    const result = await query(
      `DELETE FROM teams WHERE id = $1 RETURNING id`,
      [c.req.param('id')]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    return c.json({ success: true, message: 'Team deleted' })
  } catch (error) {
    console.error('[Teams API] Error deleting team:', error)
    return c.json({ error: 'Failed to delete team' }, 500)
  }
})

// POST /api/teams/:id/invite - Invite a member to a team
router.post('/:id/invite', async (c) => {
  try {
    const body = await c.req.json()
    const { email } = body
    const teamId = c.req.param('id')

    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    // Check if team exists
    const teamResult = await query(
      `SELECT id FROM teams WHERE id = $1`,
      [teamId]
    )

    if (teamResult.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Assuming invited_by comes from authenticated session
    const invitedBy = body.invitedBy || c.req.query('userId') || 'system'

    await query(
      `INSERT INTO team_invitations (team_id, email, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [teamId, email, invitedBy, token, expiresAt]
    )

    return c.json({
      success: true,
      message: 'Invitation sent',
      token
    }, 201)
  } catch (error) {
    console.error('[Teams API] Error inviting member:', error)
    return c.json({ error: 'Failed to invite member' }, 500)
  }
})

export default router
