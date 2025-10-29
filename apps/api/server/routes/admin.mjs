/**
 * Admin API Routes
 * Admin-only endpoints for platform management
 */

import { Hono } from 'hono'
import { query } from '../database/db.mjs'
import { requireAdmin } from '../middleware/auth-hono.mjs'
import adminModelsRouter from './admin-models.mjs'
import { isValidWalletAddress, detectChainType, getChainDisplayName } from '../utils/wallet-validation.mjs'

const router = new Hono()

// Mount model configuration routes (admin-only)
router.use('/models/*', requireAdmin)
router.route('/models', adminModelsRouter)

/**
 * GET /api/admin/users
 * Get all users (paginated)
 */
router.get('/users', requireAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query('page')) || 1
    const limit = parseInt(c.req.query('limit')) || 50
    const offset = (page - 1) * limit

    // Get total count
    const countResult = await query('SELECT COUNT(*) FROM users')
    const totalUsers = parseInt(countResult.rows[0].count)
    const totalPages = Math.ceil(totalUsers / limit)

    // Get paginated users
    const result = await query(
      `SELECT id, privy_user_id, email, wallet_address, display_name, role, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    return c.json({
      users: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    })
  } catch (error) {
    console.error('[Admin API] Error fetching users:', error)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

/**
 * PUT /api/admin/users/:id/role
 * Update user role
 */
router.put('/users/:id/role', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const { role } = await c.req.json()

    // Validate role
    if (!role || !['admin', 'team_leader', 'member'].includes(role)) {
      return c.json({
        error: 'Invalid role',
        message: 'Role must be "admin", "team_leader", or "member"'
      }, 400)
    }

    // Prevent admin from demoting themselves
    const user = c.get('user')
    if (user.id === id && role !== 'admin') {
      return c.json({
        error: 'Cannot demote yourself',
        message: 'You cannot change your own admin role'
      }, 400)
    }

    // Update user role
    const result = await query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, privy_user_id, email, wallet_address, display_name, role, created_at, updated_at`,
      [role, id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({
      success: true,
      message: `User role updated to ${role}`,
      user: result.rows[0]
    })
  } catch (error) {
    console.error('[Admin API] Error updating user role:', error)
    return c.json({ error: 'Failed to update user role' }, 500)
  }
})

/**
 * GET /api/admin/activity
 * Get recent platform activity
 */
router.get('/activity', requireAdmin, async (c) => {
  try {
    const events = []

    // Get recent user signups
    const recentSignups = await query(
      `SELECT
        u.id as "userId",
        u.display_name as "userName",
        u.created_at as timestamp
       FROM users u
       ORDER BY u.created_at DESC
       LIMIT 5`
    )

    recentSignups.rows.forEach(row => {
      events.push({
        id: `signup-${row.userId}`,
        type: 'signup',
        userId: row.userId,
        userName: row.userName || 'New User',
        message: `${row.userName || 'New user'} joined the platform`,
        timestamp: row.timestamp,
        success: true
      })
    })

    // Get recent user logins
    const recentLogins = await query(
      `SELECT
        u.id as "userId",
        u.display_name as "userName",
        u.last_login_at as timestamp
       FROM users u
       WHERE u.last_login_at IS NOT NULL
       ORDER BY u.last_login_at DESC
       LIMIT 10`
    )

    recentLogins.rows.forEach(row => {
      events.push({
        id: `login-${row.userId}-${Date.parse(row.timestamp)}`,
        type: 'login',
        userId: row.userId,
        userName: row.userName || 'Unknown User',
        message: `${row.userName || 'User'} logged in`,
        timestamp: row.timestamp,
        success: true
      })
    })

    // Get recent asset creations
    try {
      const recentAssets = await query(
        `SELECT
          a.id as "assetId",
          a.owner_id as "userId",
          u.display_name as "userName",
          a.created_at as timestamp,
          a.type,
          a.name
         FROM assets a
         LEFT JOIN users u ON a.owner_id = u.id
         ORDER BY a.created_at DESC
         LIMIT 10`
      )

      recentAssets.rows.forEach(row => {
        events.push({
          id: `asset-${row.assetId}`,
          type: 'asset_created',
          userId: row.userId,
          userName: row.userName || 'Unknown User',
          message: `${row.userName || 'User'} created ${row.type || 'asset'}: ${row.name || 'Untitled'}`,
          timestamp: row.timestamp,
          success: true,
          metadata: {
            assetType: row.type,
            assetName: row.name
          }
        })
      })
    } catch (err) {
      // Assets table might be empty
    }

    // Get recent manifest submissions
    try {
      const recentSubmissions = await query(
        `SELECT
          ms.id,
          ms.user_id as "userId",
          u.display_name as "userName",
          ms.manifest_type as "manifestType",
          ms.item_id as "itemId",
          ms.status,
          ms.submitted_at as timestamp
         FROM manifest_submissions ms
         LEFT JOIN users u ON ms.user_id = u.id
         ORDER BY ms.submitted_at DESC
         LIMIT 10`
      )

      recentSubmissions.rows.forEach(row => {
        const isApproved = row.status === 'approved'
        const isRejected = row.status === 'rejected'

        events.push({
          id: `submission-${row.id}`,
          type: 'generation',
          userId: row.userId,
          userName: row.userName || 'Unknown User',
          message: isApproved
            ? `${row.userName || 'User'}'s ${row.manifestType} submission was approved`
            : isRejected
            ? `${row.userName || 'User'}'s ${row.manifestType} submission was rejected`
            : `${row.userName || 'User'} submitted ${row.manifestType}: ${row.itemId}`,
          timestamp: row.timestamp,
          success: row.status !== 'rejected',
          metadata: {
            type: row.manifestType,
            itemId: row.itemId,
            status: row.status
          }
        })
      })
    } catch (err) {
      // Submissions table might be empty
    }

    // Get recent quest creations
    try {
      const recentQuests = await query(
        `SELECT
          q.id,
          q.owner_id as "userId",
          u.display_name as "userName",
          q.name,
          q.quest_type as "questType",
          q.created_at as timestamp
         FROM quests q
         LEFT JOIN users u ON q.owner_id = u.id
         ORDER BY q.created_at DESC
         LIMIT 5`
      )

      recentQuests.rows.forEach(row => {
        events.push({
          id: `quest-${row.id}`,
          type: 'generation',
          userId: row.userId,
          userName: row.userName || 'Unknown User',
          message: `${row.userName || 'User'} created quest: ${row.name}`,
          timestamp: row.timestamp,
          success: true,
          metadata: {
            questType: row.questType,
            questName: row.name
          }
        })
      })
    } catch (err) {
      // Quests table might be empty
    }

    // Get recent NPC creations
    try {
      const recentNPCs = await query(
        `SELECT
          n.id,
          n.owner_id as "userId",
          u.display_name as "userName",
          n.name,
          n.npc_type as "npcType",
          n.created_at as timestamp
         FROM npcs n
         LEFT JOIN users u ON n.owner_id = u.id
         ORDER BY n.created_at DESC
         LIMIT 5`
      )

      recentNPCs.rows.forEach(row => {
        events.push({
          id: `npc-${row.id}`,
          type: 'generation',
          userId: row.userId,
          userName: row.userName || 'Unknown User',
          message: `${row.userName || 'User'} created NPC: ${row.name}`,
          timestamp: row.timestamp,
          success: true,
          metadata: {
            npcType: row.npcType,
            npcName: row.name
          }
        })
      })
    } catch (err) {
      // NPCs table might be empty
    }

    // Get recent team approvals
    try {
      const recentTeams = await query(
        `SELECT
          t.id,
          t.owner_id as "userId",
          u.display_name as "userName",
          t.name,
          t.approval_status as "approvalStatus",
          COALESCE(t.approved_at, t.created_at) as timestamp
         FROM teams t
         LEFT JOIN users u ON t.owner_id = u.id
         WHERE t.approval_status IN ('approved', 'rejected')
         ORDER BY COALESCE(t.approved_at, t.created_at) DESC
         LIMIT 5`
      )

      recentTeams.rows.forEach(row => {
        const isApproved = row.approvalStatus === 'approved'
        events.push({
          id: `team-${row.id}`,
          type: 'generation',
          userId: row.userId,
          userName: row.userName || 'Unknown User',
          message: isApproved
            ? `Team "${row.name}" was approved`
            : `Team "${row.name}" was rejected`,
          timestamp: row.timestamp,
          success: isApproved,
          metadata: {
            teamName: row.name,
            status: row.approvalStatus
          }
        })
      })
    } catch (err) {
      // Teams table might be empty
    }

    // Sort all events by timestamp descending
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Return the most recent 25 events
    return c.json(events.slice(0, 25))
  } catch (error) {
    console.error('[Admin API] Error fetching activity:', error)
    return c.json({ error: 'Failed to fetch activity' }, 500)
  }
})

/**
 * GET /api/admin/stats
 * Platform statistics
 */
router.get('/stats', requireAdmin, async (c) => {
  try {
    // Get all stats in parallel
    const [usersResult, projectsResult, assetsResult, teamsResult, adminUsersResult] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM projects WHERE status != \'deleted\''),
      query('SELECT COUNT(*) FROM assets WHERE status != \'archived\''),
      query('SELECT COUNT(*) FROM teams'),
      query('SELECT COUNT(*) FROM users WHERE role = \'admin\'')
    ])

    return c.json({
      totalUsers: parseInt(usersResult.rows[0].count),
      totalProjects: parseInt(projectsResult.rows[0].count),
      totalAssets: parseInt(assetsResult.rows[0].count),
      totalTeams: parseInt(teamsResult.rows[0].count),
      adminUsers: parseInt(adminUsersResult.rows[0].count),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Admin API] Error fetching stats:', error)
    return c.json({ error: 'Failed to fetch platform statistics' }, 500)
  }
})

/**
 * GET /api/admin/whitelist
 * Get all whitelisted wallet addresses (admin reference only)
 */
router.get('/whitelist', requireAdmin, async (c) => {
  try {
    const result = await query(
      `SELECT
        w.id,
        w.wallet_address as "walletAddress",
        w.chain_type as "chainType",
        w.reason,
        w.created_at as "createdAt",
        json_build_object(
          'id', u.id,
          'name', u.display_name
        ) as "addedBy"
       FROM admin_whitelist w
       LEFT JOIN users u ON w.added_by = u.id
       ORDER BY w.created_at DESC`
    )

    return c.json({
      whitelist: result.rows
    })
  } catch (error) {
    console.error('[Admin API] Error fetching whitelist:', error)
    return c.json({ error: 'Failed to fetch whitelist' }, 500)
  }
})

/**
 * POST /api/admin/whitelist/add
 * Add wallet address to whitelist (admin reference only)
 */
router.post('/whitelist/add', requireAdmin, async (c) => {
  try {
    const { walletAddress, chainType, reason } = await c.req.json()

    if (!walletAddress) {
      return c.json({
        error: 'Wallet address is required'
      }, 400)
    }

    // Auto-detect chain type if not provided
    const detectedOrProvidedChainType = chainType || detectChainType(walletAddress)

    if (!detectedOrProvidedChainType) {
      return c.json({
        error: 'Unable to determine chain type. Please specify chainType parameter.',
        supportedChains: ['ethereum', 'solana']
      }, 400)
    }

    // Normalize chain type
    const normalizedChainType = detectedOrProvidedChainType.toLowerCase()

    // Validate chain type
    if (!['ethereum', 'solana'].includes(normalizedChainType)) {
      return c.json({
        error: 'Invalid chain type. Must be "ethereum" or "solana"'
      }, 400)
    }

    // Validate wallet address format for the specified chain
    if (!isValidWalletAddress(walletAddress, normalizedChainType)) {
      const chainName = getChainDisplayName(normalizedChainType)
      return c.json({
        error: `Invalid ${chainName} wallet address format.`,
        details: normalizedChainType === 'ethereum'
          ? 'Ethereum addresses must start with 0x and be 42 characters long'
          : 'Solana addresses must be 32-44 base58 characters'
      }, 400)
    }

    // Check if already whitelisted for this chain
    const existingResult = await query(
      'SELECT id FROM admin_whitelist WHERE wallet_address = $1 AND chain_type = $2',
      [walletAddress, normalizedChainType]
    )

    if (existingResult.rows.length > 0) {
      return c.json({
        error: `Wallet address already whitelisted on ${getChainDisplayName(normalizedChainType)}`
      }, 409)
    }

    const user = c.get('user')
    // Add to whitelist
    const result = await query(
      `INSERT INTO admin_whitelist (wallet_address, chain_type, added_by, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, wallet_address as "walletAddress", chain_type as "chainType", reason, created_at as "createdAt"`,
      [walletAddress, normalizedChainType, user.id, reason || null]
    )

    return c.json({
      success: true,
      message: `${getChainDisplayName(normalizedChainType)} wallet added to whitelist`,
      data: result.rows[0]
    }, 201)
  } catch (error) {
    console.error('[Admin API] Error adding to whitelist:', error)
    return c.json({ error: 'Failed to add to whitelist' }, 500)
  }
})

/**
 * POST /api/admin/whitelist/remove
 * Remove wallet address from whitelist
 */
router.post('/whitelist/remove', requireAdmin, async (c) => {
  try {
    const { walletAddress, chainType } = await c.req.json()

    if (!walletAddress) {
      return c.json({
        error: 'Wallet address is required'
      }, 400)
    }

    // If chainType provided, delete specific chain entry
    // Otherwise, delete all entries for this address
    let result
    if (chainType) {
      result = await query(
        'DELETE FROM admin_whitelist WHERE wallet_address = $1 AND chain_type = $2 RETURNING id, chain_type as "chainType"',
        [walletAddress, chainType.toLowerCase()]
      )
    } else {
      result = await query(
        'DELETE FROM admin_whitelist WHERE wallet_address = $1 RETURNING id, chain_type as "chainType"',
        [walletAddress]
      )
    }

    if (result.rows.length === 0) {
      return c.json({
        error: 'Wallet address not found in whitelist'
      }, 404)
    }

    const removedChains = result.rows.map(r => getChainDisplayName(r.chainType)).join(', ')

    return c.json({
      success: true,
      message: `Wallet removed from whitelist (${removedChains})`
    })
  } catch (error) {
    console.error('[Admin API] Error removing from whitelist:', error)
    return c.json({ error: 'Failed to remove from whitelist' }, 500)
  }
})

/**
 * POST /api/admin/users/bulk-role
 * Bulk update user roles
 */
router.post('/users/bulk-role', requireAdmin, async (c) => {
  try {
    const { userIds, role } = await c.req.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ error: 'userIds array is required' }, 400)
    }

    if (!role || !['admin', 'team_leader', 'member'].includes(role)) {
      return c.json({ error: 'Valid role (admin, team_leader, or member) is required' }, 400)
    }

    const user = c.get('user')
    // Prevent admin from demoting themselves
    if (userIds.includes(user.id) && role !== 'admin') {
      return c.json({
        error: 'Cannot demote yourself',
        message: 'You cannot change your own admin role'
      }, 400)
    }

    // Build placeholders for parameterized query
    const placeholders = userIds.map((_, i) => `$${i + 2}`).join(', ')

    const result = await query(
      `UPDATE users
       SET role = $1
       WHERE id IN (${placeholders})
       RETURNING id, privy_user_id, email, display_name, role`,
      [role, ...userIds]
    )

    return c.json({
      success: true,
      message: `Updated ${result.rows.length} users to ${role}`,
      updatedCount: result.rows.length,
      users: result.rows
    })
  } catch (error) {
    console.error('[Admin API] Error bulk updating user roles:', error)
    return c.json({ error: 'Failed to update user roles' }, 500)
  }
})

/**
 * POST /api/admin/users/bulk-archive
 * Bulk archive/deactivate users
 */
router.post('/users/bulk-archive', requireAdmin, async (c) => {
  try {
    const { userIds } = await c.req.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ error: 'userIds array is required' }, 400)
    }

    const user = c.get('user')
    // Prevent admin from archiving themselves
    if (userIds.includes(user.id)) {
      return c.json({
        error: 'Cannot archive yourself'
      }, 400)
    }

    // Build placeholders for parameterized query
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ')

    // For now, we'll update a status field if it exists, or just mark them somehow
    // This is a placeholder - adjust based on your actual user schema
    const result = await query(
      `UPDATE users
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
       RETURNING id`,
      userIds
    )

    return c.json({
      success: true,
      message: `Archived ${result.rows.length} users`,
      archivedCount: result.rows.length
    })
  } catch (error) {
    console.error('[Admin API] Error bulk archiving users:', error)
    return c.json({ error: 'Failed to archive users' }, 500)
  }
})

/**
 * POST /api/admin/projects/bulk-archive
 * Bulk archive projects
 */
router.post('/projects/bulk-archive', requireAdmin, async (c) => {
  try {
    const { projectIds } = await c.req.json()

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return c.json({ error: 'projectIds array is required' }, 400)
    }

    // Build placeholders for parameterized query
    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `UPDATE projects
       SET status = 'archived', archived_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
       RETURNING id`,
      projectIds
    )

    return c.json({
      success: true,
      message: `Archived ${result.rows.length} projects`,
      archivedCount: result.rows.length
    })
  } catch (error) {
    console.error('[Admin API] Error bulk archiving projects:', error)
    return c.json({ error: 'Failed to archive projects' }, 500)
  }
})

/**
 * POST /api/admin/projects/bulk-delete
 * Bulk delete projects
 */
router.post('/projects/bulk-delete', requireAdmin, async (c) => {
  try {
    const { projectIds } = await c.req.json()

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return c.json({ error: 'projectIds array is required' }, 400)
    }

    // Build placeholders for parameterized query
    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `UPDATE projects
       SET status = 'deleted', archived_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
       RETURNING id`,
      projectIds
    )

    return c.json({
      success: true,
      message: `Deleted ${result.rows.length} projects`,
      deletedCount: result.rows.length
    })
  } catch (error) {
    console.error('[Admin API] Error bulk deleting projects:', error)
    return c.json({ error: 'Failed to delete projects' }, 500)
  }
})

/**
 * POST /api/admin/projects/bulk-visibility
 * Bulk change project visibility
 */
router.post('/projects/bulk-visibility', requireAdmin, async (c) => {
  try {
    const { projectIds, visibility } = await c.req.json()

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return c.json({ error: 'projectIds array is required' }, 400)
    }

    if (!visibility || !['public', 'private', 'team'].includes(visibility)) {
      return c.json({ error: 'Valid visibility (public, private, or team) is required' }, 400)
    }

    // Build placeholders for parameterized query
    const placeholders = projectIds.map((_, i) => `$${i + 2}`).join(', ')

    // Note: This assumes a visibility column exists. Adjust based on actual schema
    const result = await query(
      `UPDATE projects
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders})
       RETURNING id`,
      [visibility, ...projectIds]
    )

    return c.json({
      success: true,
      message: `Updated visibility for ${result.rows.length} projects`,
      updatedCount: result.rows.length
    })
  } catch (error) {
    console.error('[Admin API] Error bulk updating project visibility:', error)
    return c.json({ error: 'Failed to update project visibility' }, 500)
  }
})

/**
 * GET /api/admin/teams/pending
 * Get all pending team approval requests
 */
router.get('/teams/pending', requireAdmin, async (c) => {
  try {
    const result = await query(
      `SELECT
        t.id,
        t.name,
        t.description,
        t.created_at as "createdAt",
        json_build_object(
          'id', u.id,
          'name', u.display_name,
          'email', u.email,
          'walletAddress', u.wallet_address
        ) as owner,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.approval_status = 'pending'
       ORDER BY t.created_at ASC`
    )

    return c.json({
      teams: result.rows
    })
  } catch (error) {
    console.error('[Admin API] Error fetching pending teams:', error)
    return c.json({ error: 'Failed to fetch pending teams' }, 500)
  }
})

/**
 * POST /api/admin/teams/:id/approve
 * Approve a team and promote owner to team_leader role
 */
router.post('/teams/:id/approve', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')

    // Get team details
    const teamResult = await query(
      'SELECT id, name, owner_id FROM teams WHERE id = $1',
      [id]
    )

    if (teamResult.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    const team = teamResult.rows[0]

    const user = c.get('user')
    // Update team approval status
    await query(
      `UPDATE teams
       SET approval_status = 'approved',
           approved_at = CURRENT_TIMESTAMP,
           approved_by = $1
       WHERE id = $2`,
      [user.id, id]
    )

    // Promote team owner to team_leader role
    await query(
      `UPDATE users
       SET role = 'team_leader'
       WHERE id = $1 AND role = 'member'`,
      [team.owner_id]
    )

    return c.json({
      success: true,
      message: `Team "${team.name}" approved and owner promoted to Team Leader`
    })
  } catch (error) {
    console.error('[Admin API] Error approving team:', error)
    return c.json({ error: 'Failed to approve team' }, 500)
  }
})

/**
 * POST /api/admin/teams/:id/reject
 * Reject a team approval request
 */
router.post('/teams/:id/reject', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const { reason } = await c.req.json()

    const result = await query(
      `UPDATE teams
       SET approval_status = 'rejected',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING name`,
      [id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    return c.json({
      success: true,
      message: `Team "${result.rows[0].name}" rejected${reason ? `: ${reason}` : ''}`
    })
  } catch (error) {
    console.error('[Admin API] Error rejecting team:', error)
    return c.json({ error: 'Failed to reject team' }, 500)
  }
})

export default router
