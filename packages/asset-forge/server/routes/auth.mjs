/**
 * Authentication Routes
 * 
 * Handles Privy token exchange and user login
 */

import { verifyPrivyToken, getOrCreateUser } from '../auth/privy.mjs'
import { createJWT } from '../auth/jwt.mjs'
import { joinTeam, getUserTeam } from '../auth/teams.mjs'

/**
 * POST /api/auth/login
 * Exchange Privy token for Asset Forge JWT
 */
export async function POST_login(req, res) {
  try {
    const { privyToken, inviteCode } = req.body

    if (!privyToken) {
      return res.status(400).json({
        error: 'Missing privyToken',
        message: 'Privy access token is required',
      })
    }

    // Verify Privy token
    const privyUserInfo = await verifyPrivyToken(privyToken)

    if (!privyUserInfo) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Failed to verify Privy token',
      })
    }

    // Get or create user
    const user = await getOrCreateUser(privyUserInfo)

    // Handle team invitation if provided
    let joinedTeam = null
    if (inviteCode && inviteCode.trim()) {
      try {
        // Check if user is already in a team
        const existingTeam = await getUserTeam(user.id)
        if (existingTeam) {
          return res.status(400).json({
            error: 'Already in team',
            message: 'User is already a member of a team. Leave current team before joining another.',
          })
        }

        // Try to join the team
        joinedTeam = await joinTeam(user.id, inviteCode.trim().toUpperCase())
      } catch (teamError) {
        // Log the error but don't fail the login
        console.warn('[Auth] Failed to join team during login:', teamError.message)
        // Could return a warning in the response instead of failing completely
      }
    }

    // Create Asset Forge JWT
    const token = createJWT(user)

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
      team: joinedTeam ? {
        id: joinedTeam.id,
        name: joinedTeam.name,
        description: joinedTeam.description,
        inviteCode: joinedTeam.inviteCode,
        memberCount: joinedTeam.memberCount,
        maxMembers: joinedTeam.maxMembers,
      } : null,
    })
  } catch (error) {
    console.error('[Auth] Login error:', error)
    return res.status(500).json({
      error: 'Login failed',
      message: error.message,
    })
  }
}

/**
 * GET /api/auth/me
 * Get current user information
 */
export async function GET_me(req, res) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Not authenticated',
    })
  }

  // Get user's team information
  let team = null
  try {
    team = await getUserTeam(req.user.id)
  } catch (error) {
    console.warn('[Auth] Failed to get user team:', error.message)
  }

  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      role: req.user.role,
      teamId: req.user.teamId,
      privyUserId: req.user.privyUserId,
      farcasterFid: req.user.farcasterFid,
      walletAddress: req.user.walletAddress,
    },
    team: team ? {
      id: team.id,
      name: team.name,
      description: team.description,
      inviteCode: team.inviteCode,
      memberCount: team.memberCount,
      maxMembers: team.maxMembers,
      isActive: team.isActive,
      createdAt: team.createdAt,
    } : null,
  })
}

/**
 * POST /api/auth/logout
 * Logout (invalidate session)
 */
export async function POST_logout(req, res) {
  // In a JWT-based system, logout is mainly client-side
  // But we could track revoked tokens if needed
  return res.json({
    success: true,
    message: 'Logged out successfully',
  })
}

