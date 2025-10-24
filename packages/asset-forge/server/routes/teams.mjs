/**
 * Team Management Routes
 *
 * Handles team creation, joining, and management via API endpoints
 */

import {
  createTeam,
  joinTeam,
  getTeamById,
  getUserTeam,
  getTeamMembers,
  leaveTeam,
  deleteTeam,
  transferTeamOwnership
} from '../auth/teams.mjs'

/**
 * POST /api/teams/create
 * Create a new team
 */
export async function POST_createTeam(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { name, description, maxMembers } = req.body

    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid team name',
        message: 'Team name must be at least 3 characters long',
      })
    }

    const team = await createTeam(
      req.user.id,
      name.trim(),
      description?.trim() || '',
      maxMembers || 10
    )

    return res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        inviteCode: team.inviteCode,
        memberCount: team.memberCount,
        maxMembers: team.maxMembers,
        isActive: team.isActive,
        createdAt: team.createdAt,
      },
    })
  } catch (error) {
    console.error('[Teams] Create team error:', error)
    return res.status(400).json({
      error: 'Failed to create team',
      message: error.message,
    })
  }
}

/**
 * GET /api/teams/preview/:inviteCode
 * Preview team information before joining (public endpoint)
 */
export async function GET_teamPreview(req, res) {
  try {
    const { inviteCode } = req.params

    if (!inviteCode || inviteCode.trim().length !== 8) {
      return res.status(400).json({
        error: 'Invalid invite code',
        message: 'Invite code must be 8 characters long',
      })
    }

    const { getTeamByInviteCode } = await import('../auth/teams.mjs')
    const team = await getTeamByInviteCode(inviteCode.trim().toUpperCase())

    if (!team) {
      return res.status(404).json({
        error: 'Team not found',
        message: 'No team found with this invite code',
      })
    }

    if (!team.isActive) {
      return res.status(400).json({
        error: 'Team inactive',
        message: 'This team is no longer active',
      })
    }

    // Get owner information
    const { db, schema } = await import('../db/index.mjs')
    const { eq } = await import('drizzle-orm')

    const owner = await db.query.users.findFirst({
      where: eq(schema.users.id, team.ownerId),
    })

    return res.json({
      success: true,
      team: {
        name: team.name,
        description: team.description,
        memberCount: team.memberCount,
        maxMembers: team.maxMembers,
        ownerName: owner?.name || 'Unknown',
      },
    })
  } catch (error) {
    console.error('[Teams] Preview team error:', error)
    return res.status(500).json({
      error: 'Failed to preview team',
      message: error.message,
    })
  }
}

/**
 * POST /api/teams/join
 * Join a team using an invite code
 */
export async function POST_joinTeam(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { inviteCode } = req.body

    if (!inviteCode || inviteCode.trim().length !== 8) {
      return res.status(400).json({
        error: 'Invalid invite code',
        message: 'Invite code must be 8 characters long',
      })
    }

    const team = await joinTeam(req.user.id, inviteCode.trim().toUpperCase())

    return res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        memberCount: team.memberCount,
        maxMembers: team.maxMembers,
      },
    })
  } catch (error) {
    console.error('[Teams] Join team error:', error)
    return res.status(400).json({
      error: 'Failed to join team',
      message: error.message,
    })
  }
}

/**
 * GET /api/teams/my-team
 * Get the current user's team
 */
export async function GET_myTeam(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const team = await getUserTeam(req.user.id)

    if (!team) {
      return res.json({
        success: true,
        team: null,
        message: 'User is not a member of any team',
      })
    }

    return res.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        inviteCode: team.inviteCode,
        memberCount: team.memberCount,
        maxMembers: team.maxMembers,
        isActive: team.isActive,
        createdAt: team.createdAt,
      },
    })
  } catch (error) {
    console.error('[Teams] Get team error:', error)
    return res.status(500).json({
      error: 'Failed to get team',
      message: error.message,
    })
  }
}

/**
 * GET /api/teams/:teamId/members
 * Get team members (team members and owner only)
 */
export async function GET_teamMembers(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { teamId } = req.params

    // Check if user is a member of this team
    const userTeam = await getUserTeam(req.user.id)
    if (!userTeam || userTeam.id !== teamId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not a member of this team',
      })
    }

    const members = await getTeamMembers(teamId)

    return res.json({
      success: true,
      members: members.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        role: member.role,
        joinedAt: member.createdAt,
        isOwner: userTeam.ownerId === member.id,
      })),
    })
  } catch (error) {
    console.error('[Teams] Get team members error:', error)
    return res.status(500).json({
      error: 'Failed to get team members',
      message: error.message,
    })
  }
}

/**
 * POST /api/teams/:teamId/leave
 * Leave a team
 */
export async function POST_leaveTeam(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { teamId } = req.params

    // Check if user is a member of this team
    const userTeam = await getUserTeam(req.user.id)
    if (!userTeam || userTeam.id !== teamId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not a member of this team',
      })
    }

    await leaveTeam(req.user.id)

    return res.json({
      success: true,
      message: 'Successfully left the team',
    })
  } catch (error) {
    console.error('[Teams] Leave team error:', error)
    return res.status(400).json({
      error: 'Failed to leave team',
      message: error.message,
    })
  }
}

/**
 * DELETE /api/teams/:teamId
 * Delete a team (owner only)
 */
export async function DELETE_team(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { teamId } = req.params

    await deleteTeam(req.user.id, teamId)

    return res.json({
      success: true,
      message: 'Team deleted successfully',
    })
  } catch (error) {
    console.error('[Teams] Delete team error:', error)
    return res.status(400).json({
      error: 'Failed to delete team',
      message: error.message,
    })
  }
}

/**
 * PUT /api/teams/:teamId
 * Update team settings (owner only)
 */
export async function PUT_updateTeam(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { teamId } = req.params
    const { name, description, maxMembers } = req.body

    // Validate input
    if (name && name.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid team name',
        message: 'Team name must be at least 3 characters long',
      })
    }

    if (maxMembers && (maxMembers < 2 || maxMembers > 100)) {
      return res.status(400).json({
        error: 'Invalid max members',
        message: 'Max members must be between 2 and 100',
      })
    }

    // Check if user is the owner of this team
    const userTeam = await getUserTeam(req.user.id)
    if (!userTeam || userTeam.id !== teamId || userTeam.ownerId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only team owners can update team settings',
      })
    }

    // Update team in database
    const { db, schema } = await import('../db/index.mjs')
    const { eq } = await import('drizzle-orm')

    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description.trim()
    if (maxMembers !== undefined) updates.maxMembers = maxMembers

    await db.update(schema.teams)
      .set(updates)
      .where(eq(schema.teams.id, teamId))

    // Fetch updated team
    const updatedTeam = await getTeamById(teamId)

    return res.json({
      success: true,
      message: 'Team updated successfully',
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        maxMembers: updatedTeam.maxMembers,
      },
    })
  } catch (error) {
    console.error('[Teams] Update team error:', error)
    return res.status(400).json({
      error: 'Failed to update team',
      message: error.message,
    })
  }
}

/**
 * DELETE /api/teams/:teamId/members/:memberId
 * Remove a member from the team (owner only)
 */
export async function DELETE_removeMember(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { teamId, memberId } = req.params

    // Check if user is the team owner
    const userTeam = await getUserTeam(req.user.id)
    if (!userTeam || userTeam.id !== teamId || userTeam.ownerId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only team owners can remove members',
      })
    }

    // Can't remove yourself (use leave team instead)
    if (memberId === req.user.id) {
      return res.status(400).json({
        error: 'Cannot remove yourself',
        message: 'Use the leave team endpoint instead',
      })
    }

    // Verify member is in this team
    const { db, schema } = await import('../db/index.mjs')
    const { eq, and } = await import('drizzle-orm')

    const member = await db.query.users.findFirst({
      where: and(
        eq(schema.users.id, memberId),
        eq(schema.users.teamId, teamId)
      ),
    })

    if (!member) {
      return res.status(404).json({
        error: 'Member not found',
        message: 'This user is not a member of this team',
      })
    }

    // Remove member from team
    await db.update(schema.users)
      .set({
        teamId: null,
      })
      .where(eq(schema.users.id, memberId))

    // Update team member count
    await db.update(schema.teams)
      .set({
        memberCount: Math.max(0, userTeam.memberCount - 1),
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, teamId))

    return res.json({
      success: true,
      message: 'Member removed from team successfully',
    })
  } catch (error) {
    console.error('[Teams] Remove member error:', error)
    return res.status(400).json({
      error: 'Failed to remove member',
      message: error.message,
    })
  }
}

/**
 * POST /api/teams/:teamId/transfer-ownership
 * Transfer team ownership (owner only)
 */
export async function POST_transferOwnership(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { teamId } = req.params
    const { newOwnerId } = req.body

    if (!newOwnerId) {
      return res.status(400).json({
        error: 'Missing new owner ID',
        message: 'New owner ID is required',
      })
    }

    // Check if user is the current owner
    const userTeam = await getUserTeam(req.user.id)
    if (!userTeam || userTeam.id !== teamId || userTeam.ownerId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only team owners can transfer ownership',
      })
    }

    await transferTeamOwnership(req.user.id, newOwnerId, teamId)

    return res.json({
      success: true,
      message: 'Team ownership transferred successfully',
    })
  } catch (error) {
    console.error('[Teams] Transfer ownership error:', error)
    return res.status(400).json({
      error: 'Failed to transfer ownership',
      message: error.message,
    })
  }
}
