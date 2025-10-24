/**
 * User Profile Management Routes
 *
 * Handles user profile, usage statistics, history, and GDPR compliance
 */

import { db, schema } from '../db/index.mjs'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

/**
 * GET /api/user/profile
 * Get user profile with optional team information
 */
export async function GET_profile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    // Get user with team information if teamId exists
    let userProfile = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      walletAddress: req.user.walletAddress,
      farcasterFid: req.user.farcasterFid,
      role: req.user.role,
      teamId: req.user.teamId,
      createdAt: req.user.createdAt,
      lastLoginAt: req.user.lastLoginAt,
      team: null,
    }

    // Fetch team information if user belongs to a team
    if (req.user.teamId) {
      const team = await db.query.teams.findFirst({
        where: eq(schema.teams.id, req.user.teamId),
      })

      if (team) {
        userProfile.team = {
          id: team.id,
          name: team.name,
          description: team.description,
          inviteCode: team.inviteCode,
          memberCount: team.memberCount,
          maxMembers: team.maxMembers,
          isOwner: team.ownerId === req.user.id,
          createdAt: team.createdAt,
        }
      }
    }

    return res.json({
      success: true,
      user: userProfile,
    })
  } catch (error) {
    console.error('[User] Get profile error:', error)
    return res.status(500).json({
      error: 'Failed to get profile',
      message: error.message,
    })
  }
}

/**
 * PUT /api/user/profile
 * Update user profile (limited fields)
 */
export async function PUT_profile(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { name, avatar } = req.body

    // Validation
    const updates = {}

    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return res.status(400).json({
          error: 'Invalid name',
          message: 'Name must be at least 2 characters long',
        })
      }
      updates.name = name.trim()
    }

    if (avatar !== undefined) {
      updates.avatar = avatar ? avatar.trim() : null
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Provide name or avatar to update',
      })
    }

    // Update user profile
    await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, req.user.id))

    // Fetch updated user
    const updatedUser = await db.query.users.findFirst({
      where: eq(schema.users.id, req.user.id),
    })

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        walletAddress: updatedUser.walletAddress,
        farcasterFid: updatedUser.farcasterFid,
        role: updatedUser.role,
        teamId: updatedUser.teamId,
        createdAt: updatedUser.createdAt,
        lastLoginAt: updatedUser.lastLoginAt,
      },
      message: 'Profile updated successfully',
    })
  } catch (error) {
    console.error('[User] Update profile error:', error)
    return res.status(500).json({
      error: 'Failed to update profile',
      message: error.message,
    })
  }
}

/**
 * GET /api/user/usage
 * Get API usage statistics for the user
 */
export async function GET_usage(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    // Get all generation history for this user
    const allHistory = await db.query.generationHistory.findMany({
      where: eq(schema.generationHistory.userId, req.user.id),
      orderBy: [desc(schema.generationHistory.startedAt)],
    })

    // Calculate total generations and credits
    const totalGenerations = allHistory.length
    const totalCreditsUsed = allHistory.reduce((sum, record) => sum + (record.creditsUsed || 0), 0)

    // Aggregate by provider
    const byProvider = {}
    const providers = ['openai', 'meshy', 'elevenlabs']

    providers.forEach(provider => {
      const providerRecords = allHistory.filter(r => r.provider === provider)
      byProvider[provider] = {
        count: providerRecords.length,
        credits: providerRecords.reduce((sum, r) => sum + (r.creditsUsed || 0), 0),
      }
    })

    // Aggregate by status
    const byStatus = {
      completed: allHistory.filter(r => r.status === 'completed').length,
      failed: allHistory.filter(r => r.status === 'failed').length,
      pending: allHistory.filter(r => r.status === 'pending' || r.status === 'processing').length,
    }

    // Get recent generations (last 10)
    const recentGenerations = allHistory.slice(0, 10).map(record => ({
      id: record.id,
      generationType: record.generationType,
      provider: record.provider,
      status: record.status,
      creditsUsed: record.creditsUsed,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      duration: record.duration,
      errorMessage: record.errorMessage,
    }))

    return res.json({
      success: true,
      usage: {
        totalGenerations,
        totalCreditsUsed,
        byProvider,
        byStatus,
        recentGenerations,
      },
    })
  } catch (error) {
    console.error('[User] Get usage error:', error)
    return res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message,
    })
  }
}

/**
 * GET /api/user/history
 * Get paginated generation history with filters
 */
export async function GET_history(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    // Parse query parameters
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100) // Max 100 per page
    const provider = req.query.provider
    const status = req.query.status
    const startDate = req.query.startDate
    const endDate = req.query.endDate

    // Limit maximum page number to prevent excessive offsets
    if (page > 10000) {
      return res.status(400).json({
        error: 'Invalid input: page must not exceed 10,000',
      })
    }

    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = [eq(schema.generationHistory.userId, req.user.id)]

    if (provider) {
      conditions.push(eq(schema.generationHistory.provider, provider))
    }

    if (status) {
      conditions.push(eq(schema.generationHistory.status, status))
    }

    if (startDate) {
      const parsedStartDate = Date.parse(startDate)
      if (isNaN(parsedStartDate)) {
        return res.status(400).json({
          error: 'Invalid input: startDate must be a valid date string',
        })
      }
      const startTimestamp = new Date(parsedStartDate)
      conditions.push(gte(schema.generationHistory.startedAt, startTimestamp))
    }

    if (endDate) {
      const parsedEndDate = Date.parse(endDate)
      if (isNaN(parsedEndDate)) {
        return res.status(400).json({
          error: 'Invalid input: endDate must be a valid date string',
        })
      }
      const endTimestamp = new Date(parsedEndDate)
      conditions.push(lte(schema.generationHistory.startedAt, endTimestamp))
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

    const startTime = performance.now()

    // Execute count and history queries in parallel
    const [countResult, historyRecords] = await Promise.all([
      // Get total count for pagination
      db
        .select({ count: sql`count(*)` })
        .from(schema.generationHistory)
        .where(whereClause),

      // Get paginated history with asset and project information
      db
        .select({
        id: schema.generationHistory.id,
        assetId: schema.generationHistory.assetId,
        generationType: schema.generationHistory.generationType,
        provider: schema.generationHistory.provider,
        prompt: schema.generationHistory.prompt,
        settings: schema.generationHistory.settings,
        status: schema.generationHistory.status,
        errorMessage: schema.generationHistory.errorMessage,
        creditsUsed: schema.generationHistory.creditsUsed,
        startedAt: schema.generationHistory.startedAt,
        completedAt: schema.generationHistory.completedAt,
        duration: schema.generationHistory.duration,
        assetName: schema.assets.name,
        assetType: schema.assets.type,
        projectId: schema.projects.id,
        projectName: schema.projects.name,
      })
      .from(schema.generationHistory)
      .leftJoin(schema.assets, eq(schema.generationHistory.assetId, schema.assets.id))
      .leftJoin(schema.projects, eq(schema.assets.projectId, schema.projects.id))
      .where(whereClause)
      .orderBy(desc(schema.generationHistory.startedAt))
      .limit(limit)
      .offset(offset)
    ])

    const duration = performance.now() - startTime
    const totalCount = Number(countResult[0]?.count || 0)
    const totalPages = Math.ceil(totalCount / limit)

    console.log('[User] Generation history queries completed', {
      duration: `${duration.toFixed(2)}ms`,
      parallel: true,
      page,
      records: historyRecords.length,
      total: totalCount
    })

    const history = historyRecords.map(record => ({
      id: record.id,
      generationType: record.generationType,
      provider: record.provider,
      prompt: record.prompt,
      settings: record.settings ? JSON.parse(record.settings) : null,
      status: record.status,
      errorMessage: record.errorMessage,
      creditsUsed: record.creditsUsed,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      duration: record.duration,
      asset: record.assetId ? {
        id: record.assetId,
        name: record.assetName,
        type: record.assetType,
      } : null,
      project: record.projectId ? {
        id: record.projectId,
        name: record.projectName,
      } : null,
    }))

    return res.json({
      success: true,
      history,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        provider: provider || null,
        status: status || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    })
  } catch (error) {
    console.error('[User] Get history error:', error)
    return res.status(500).json({
      error: 'Failed to get generation history',
      message: error.message,
    })
  }
}

/**
 * DELETE /api/user/account
 * Delete user account (DANGEROUS - cascade deletes all user data)
 */
export async function DELETE_account(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const userId = req.user.id

    // Optional: Verify password or require confirmation token in production
    const { confirmationCode } = req.body

    // Simple confirmation check (in production, use more secure methods)
    if (confirmationCode !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Please provide confirmationCode: "DELETE_MY_ACCOUNT" to confirm account deletion',
      })
    }

    // Check if user is a team owner
    const ownedTeam = await db.query.teams.findFirst({
      where: eq(schema.teams.ownerId, userId),
    })

    if (ownedTeam) {
      return res.status(400).json({
        error: 'Cannot delete account',
        message: 'You must transfer team ownership or delete your team before deleting your account',
      })
    }

    // Delete user (cascade will handle: projects, assets, sessions, apiKeys, generationHistory, voiceProfiles)
    await db.delete(schema.users).where(eq(schema.users.id, userId))

    return res.json({
      success: true,
      message: 'Account deleted successfully. All associated data has been removed.',
    })
  } catch (error) {
    console.error('[User] Delete account error:', error)
    return res.status(500).json({
      error: 'Failed to delete account',
      message: error.message,
    })
  }
}

/**
 * POST /api/user/export
 * Export all user data (GDPR compliance)
 */
export async function POST_export(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const userId = req.user.id

    const startTime = performance.now()

    // Gather all user data in parallel for maximum performance
    const [userProfile, projects, assets, voiceProfiles, generationHistory, apiKeysData, sessions] = await Promise.all([
      db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      }),

      db.query.projects.findMany({
        where: eq(schema.projects.userId, userId),
      }),

      db.query.assets.findMany({
        where: eq(schema.assets.userId, userId),
      }),

      db.query.voiceProfiles.findMany({
        where: eq(schema.voiceProfiles.userId, userId),
      }),

      db.query.generationHistory.findMany({
        where: eq(schema.generationHistory.userId, userId),
        orderBy: [desc(schema.generationHistory.startedAt)],
      }),

      db.query.apiKeys.findMany({
        where: eq(schema.apiKeys.userId, userId),
      }),

      db.query.sessions.findMany({
        where: eq(schema.sessions.userId, userId),
        orderBy: [desc(schema.sessions.createdAt)],
      })
    ])

    const duration = performance.now() - startTime
    console.log('[User] Data export queries completed', {
      duration: `${duration.toFixed(2)}ms`,
      parallel: true,
      userId
    })

    // Mask API keys for security
    const maskedApiKeys = apiKeysData.map(key => ({
      id: key.id,
      provider: key.provider,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      encryptedKey: '***REDACTED***', // Never export actual keys
    }))

    // Get team information if applicable
    let teamData = null
    if (userProfile.teamId) {
      teamData = await db.query.teams.findFirst({
        where: eq(schema.teams.id, userProfile.teamId),
      })
    }

    // Construct complete data export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        dataVersion: '1.0',
        userId: userId,
      },
      profile: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        avatar: userProfile.avatar,
        privyUserId: userProfile.privyUserId,
        farcasterFid: userProfile.farcasterFid,
        walletAddress: userProfile.walletAddress,
        role: userProfile.role,
        teamId: userProfile.teamId,
        createdAt: userProfile.createdAt,
        lastLoginAt: userProfile.lastLoginAt,
        isActive: userProfile.isActive,
      },
      team: teamData,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        type: p.type,
        gameStyle: p.gameStyle,
        gameType: p.gameType,
        artDirection: p.artDirection,
        tags: p.tags ? JSON.parse(p.tags) : [],
        assetCount: p.assetCount,
        isPublic: p.isPublic,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      assets: assets.map(a => ({
        id: a.id,
        projectId: a.projectId,
        name: a.name,
        description: a.description,
        type: a.type,
        category: a.category,
        glbPath: a.glbPath,
        thumbnailPath: a.thumbnailPath,
        conceptArtPath: a.conceptArtPath,
        prompt: a.prompt,
        meshyTaskId: a.meshyTaskId,
        generationSettings: a.generationSettings ? JSON.parse(a.generationSettings) : null,
        vertexCount: a.vertexCount,
        triangleCount: a.triangleCount,
        fileSize: a.fileSize,
        properties: a.properties ? JSON.parse(a.properties) : null,
        tags: a.tags ? JSON.parse(a.tags) : [],
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      voiceProfiles: voiceProfiles.map(v => ({
        id: v.id,
        projectId: v.projectId,
        name: v.name,
        description: v.description,
        elevenLabsVoiceId: v.elevenLabsVoiceId,
        voiceName: v.voiceName,
        voiceSettings: v.voiceSettings ? JSON.parse(v.voiceSettings) : null,
        audioClips: v.audioClips ? JSON.parse(v.audioClips) : [],
        totalClips: v.totalClips,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      generationHistory: generationHistory.map(g => ({
        id: g.id,
        assetId: g.assetId,
        generationType: g.generationType,
        provider: g.provider,
        prompt: g.prompt,
        settings: g.settings ? JSON.parse(g.settings) : null,
        status: g.status,
        errorMessage: g.errorMessage,
        creditsUsed: g.creditsUsed,
        startedAt: g.startedAt,
        completedAt: g.completedAt,
        duration: g.duration,
      })),
      apiKeys: maskedApiKeys,
      sessions: sessions.map(s => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        // token intentionally excluded for security
      })),
      statistics: {
        totalProjects: projects.length,
        totalAssets: assets.length,
        totalVoiceProfiles: voiceProfiles.length,
        totalGenerations: generationHistory.length,
        totalCreditsUsed: generationHistory.reduce((sum, g) => sum + (g.creditsUsed || 0), 0),
        activeSessions: sessions.filter(s => new Date(s.expiresAt) > new Date()).length,
      },
    }

    return res.json({
      success: true,
      data: exportData,
      message: 'User data exported successfully',
    })
  } catch (error) {
    console.error('[User] Export data error:', error)
    return res.status(500).json({
      error: 'Failed to export user data',
      message: error.message,
    })
  }
}
