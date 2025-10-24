/**
 * Team Management Module
 *
 * Handles team creation, joining, and management functionality
 */

import { db, schema } from '../db/index.mjs'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('TeamManagement')

/**
 * Generate a unique team invite code
 */
function generateInviteCode() {
  return randomBytes(4).toString('hex').toUpperCase() // 8 character code like "A1B2C3D4"
}

/**
 * Create a new team
 *
 * @param {string} ownerId - User ID of the team owner
 * @param {string} name - Team name
 * @param {string} description - Team description (optional)
 * @param {number} maxMembers - Maximum number of team members (default: 10)
 * @returns {Promise<Object>} Created team object
 */
export async function createTeam(ownerId, name, description = '', maxMembers = 10) {
  // Check if user already owns a team
  const existingOwnerTeam = await db.query.teams.findFirst({
    where: eq(schema.teams.ownerId, ownerId),
  })

  if (existingOwnerTeam) {
    throw new Error('User already owns a team')
  }

  // Check if user is already in a team
  const existingUserTeam = await db.query.users.findFirst({
    where: eq(schema.users.id, ownerId),
  })

  if (existingUserTeam.teamId) {
    throw new Error('User is already a member of a team')
  }

  // Generate unique invite code
  let inviteCode
  let isUnique = false
  let attempts = 0

  while (!isUnique && attempts < 10) {
    inviteCode = generateInviteCode()
    const existingCode = await db.query.teams.findFirst({
      where: eq(schema.teams.inviteCode, inviteCode),
    })
    if (!existingCode) {
      isUnique = true
    }
    attempts++
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique invite code')
  }

  // Create the team
  const teamId = `team_${randomBytes(16).toString('hex')}`

  const newTeam = {
    id: teamId,
    name,
    description,
    inviteCode,
    ownerId,
    maxMembers,
    memberCount: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await db.insert(schema.teams).values(newTeam)

  // Add owner to the team
  await db.update(schema.users)
    .set({
      teamId: teamId,
      lastLoginAt: new Date(),
    })
    .where(eq(schema.users.id, ownerId))

  return newTeam
}

/**
 * Join a team using an invite code
 *
 * CRITICAL: Uses database transaction to prevent race condition
 * This ensures atomic capacity checking and member addition (TOCTOU protection)
 *
 * @param {string} userId - User ID of the person joining
 * @param {string} inviteCode - Team invite code
 * @returns {Promise<Object>} Team object if successful
 */
export async function joinTeam(userId, inviteCode) {
  // Pre-check: User existence and team membership (outside transaction for early validation)
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })

  if (!user) {
    logger.warn('Join team failed: user not found', { userId, inviteCode })
    throw new Error('User not found')
  }

  if (user.teamId) {
    logger.warn('Join team failed: user already in team', { userId, currentTeamId: user.teamId })
    throw new Error('User is already a member of a team')
  }

  // Find the team by invite code (outside transaction for early validation)
  const team = await db.query.teams.findFirst({
    where: and(
      eq(schema.teams.inviteCode, inviteCode),
      eq(schema.teams.isActive, true)
    ),
  })

  if (!team) {
    logger.warn('Join team failed: invalid invite code', { inviteCode })
    throw new Error('Invalid invite code or team is inactive')
  }

  // ATOMIC TRANSACTION: Prevent race condition between capacity check and member addition
  // This ensures that concurrent join requests cannot exceed team capacity
  try {
    const result = await db.transaction(async (tx) => {
      // Re-fetch team inside transaction for atomic capacity check
      // This prevents TOCTOU (Time of Check, Time of Use) vulnerability
      const teamInTx = await tx.query.teams.findFirst({
        where: eq(schema.teams.id, team.id),
      })

      if (!teamInTx) {
        throw new Error('Team not found in transaction')
      }

      // CRITICAL: Atomic capacity check inside transaction
      if (teamInTx.memberCount >= teamInTx.maxMembers) {
        logger.warn('Team capacity limit reached', {
          teamId: team.id,
          teamName: team.name,
          currentCount: teamInTx.memberCount,
          maxMembers: teamInTx.maxMembers,
          attemptedUserId: userId
        })
        throw new Error('Team is at maximum capacity')
      }

      // Re-verify user is not in a team (prevent race condition with multiple concurrent joins)
      const userInTx = await tx.query.users.findFirst({
        where: eq(schema.users.id, userId),
      })

      if (userInTx && userInTx.teamId) {
        logger.warn('User joined another team concurrently', {
          userId,
          teamId: userInTx.teamId
        })
        throw new Error('User is already a member of a team')
      }

      // Add user to team (within transaction)
      await tx.update(schema.users)
        .set({
          teamId: team.id,
          lastLoginAt: new Date(),
        })
        .where(eq(schema.users.id, userId))

      // Update team member count (within same transaction)
      await tx.update(schema.teams)
        .set({
          memberCount: teamInTx.memberCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.teams.id, team.id))

      logger.info('User joined team successfully', {
        userId,
        teamId: team.id,
        teamName: team.name,
        newMemberCount: teamInTx.memberCount + 1,
        maxMembers: teamInTx.maxMembers
      })

      return team
    })

    return result
  } catch (error) {
    // Transaction failed - log and re-throw
    logger.error('Join team transaction failed', error, {
      userId,
      teamId: team.id,
      inviteCode
    })
    throw error
  }
}

/**
 * Get team by ID
 *
 * @param {string} teamId - Team ID
 * @returns {Promise<Object|null>} Team object or null
 */
export async function getTeamById(teamId) {
  return await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  })
}

/**
 * Get team by invite code
 *
 * @param {string} inviteCode - Team invite code
 * @returns {Promise<Object|null>} Team object or null
 */
export async function getTeamByInviteCode(inviteCode) {
  return await db.query.teams.findFirst({
    where: and(
      eq(schema.teams.inviteCode, inviteCode),
      eq(schema.teams.isActive, true)
    ),
  })
}

/**
 * Get team members
 *
 * @param {string} teamId - Team ID
 * @returns {Promise<Array>} Array of user objects
 */
export async function getTeamMembers(teamId) {
  return await db.query.users.findMany({
    where: eq(schema.users.teamId, teamId),
  })
}

/**
 * Get user's team
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Team object or null
 */
export async function getUserTeam(userId) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })

  if (!user || !user.teamId) {
    return null
  }

  return await getTeamById(user.teamId)
}

/**
 * Leave a team
 *
 * CRITICAL: Uses database transaction to prevent race condition
 * Ensures atomic member removal and count update
 *
 * @param {string} userId - User ID of the person leaving
 * @returns {Promise<boolean>} Success status
 */
export async function leaveTeam(userId) {
  // Pre-check: User existence and team membership (outside transaction)
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })

  if (!user || !user.teamId) {
    logger.warn('Leave team failed: user not in team', { userId })
    throw new Error('User is not a member of any team')
  }

  const team = await getTeamById(user.teamId)

  if (!team) {
    logger.warn('Leave team failed: team not found', { userId, teamId: user.teamId })
    throw new Error('Team not found')
  }

  // Can't leave if you're the owner
  if (team.ownerId === userId) {
    logger.warn('Leave team failed: user is team owner', { userId, teamId: team.id })
    throw new Error('Team owners cannot leave their team. Transfer ownership or delete the team instead.')
  }

  // ATOMIC TRANSACTION: Prevent race condition between member removal and count update
  try {
    await db.transaction(async (tx) => {
      // Re-verify user is still in the team (prevent double-leave race condition)
      const userInTx = await tx.query.users.findFirst({
        where: eq(schema.users.id, userId),
      })

      if (!userInTx || !userInTx.teamId) {
        logger.warn('User left team concurrently', { userId })
        throw new Error('User is not a member of any team')
      }

      // Remove user from team (within transaction)
      await tx.update(schema.users)
        .set({
          teamId: null,
          lastLoginAt: new Date(),
        })
        .where(eq(schema.users.id, userId))

      // Get current team state within transaction
      const teamInTx = await tx.query.teams.findFirst({
        where: eq(schema.teams.id, team.id),
      })

      if (!teamInTx) {
        throw new Error('Team not found in transaction')
      }

      // Update team member count (within same transaction)
      await tx.update(schema.teams)
        .set({
          memberCount: Math.max(0, teamInTx.memberCount - 1),
          updatedAt: new Date(),
        })
        .where(eq(schema.teams.id, team.id))

      logger.info('User left team successfully', {
        userId,
        teamId: team.id,
        teamName: team.name,
        newMemberCount: Math.max(0, teamInTx.memberCount - 1)
      })
    })

    return true
  } catch (error) {
    logger.error('Leave team transaction failed', error, {
      userId,
      teamId: team.id
    })
    throw error
  }
}

/**
 * Delete a team (owner only)
 *
 * @param {string} userId - User ID (must be team owner)
 * @param {string} teamId - Team ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTeam(userId, teamId) {
  const team = await getTeamById(teamId)

  if (!team) {
    throw new Error('Team not found')
  }

  if (team.ownerId !== userId) {
    throw new Error('Only team owners can delete teams')
  }

  // Remove all team members from the team
  await db.update(schema.users)
    .set({
      teamId: null,
      lastLoginAt: new Date(),
    })
    .where(eq(schema.users.teamId, teamId))

  // Delete the team
  await db.delete(schema.teams).where(eq(schema.teams.id, teamId))

  return true
}

/**
 * Transfer team ownership
 *
 * @param {string} currentOwnerId - Current team owner ID
 * @param {string} newOwnerId - New team owner ID
 * @param {string} teamId - Team ID
 * @returns {Promise<boolean>} Success status
 */
export async function transferTeamOwnership(currentOwnerId, newOwnerId, teamId) {
  const team = await getTeamById(teamId)

  if (!team) {
    throw new Error('Team not found')
  }

  if (team.ownerId !== currentOwnerId) {
    throw new Error('Only team owners can transfer ownership')
  }

  // Check if new owner is in the team
  const newOwner = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, newOwnerId),
      eq(schema.users.teamId, teamId)
    ),
  })

  if (!newOwner) {
    throw new Error('New owner must be a member of the team')
  }

  // Transfer ownership
  await db.update(schema.teams)
    .set({
      ownerId: newOwnerId,
      updatedAt: new Date(),
    })
    .where(eq(schema.teams.id, teamId))

  return true
}
