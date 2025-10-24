/**
 * Project Management Routes
 *
 * Handles project creation, listing, updating, and deletion via API endpoints
 */

import { db, schema } from '../db/index.mjs'
import { eq, and, or, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { getUserTeam } from '../auth/teams.mjs'

/**
 * Generate a unique project ID
 */
function generateProjectId() {
  return `proj_${randomBytes(16).toString('hex')}`
}

/**
 * Check if user has access to a project (owner or team member)
 */
async function hasProjectAccess(userId, projectId) {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  })

  if (!project) {
    return { hasAccess: false, project: null, reason: 'Project not found' }
  }

  // User is the owner
  if (project.userId === userId) {
    return { hasAccess: true, project, isOwner: true }
  }

  // Check if user is in the project's team
  if (project.teamId) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    })

    if (user && user.teamId === project.teamId) {
      return { hasAccess: true, project, isOwner: false }
    }
  }

  return { hasAccess: false, project: null, reason: 'Access denied' }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST_createProject(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const {
      name,
      description,
      type,
      gameStyle,
      gameType,
      artDirection,
      tags,
      thumbnail,
      isPublic
    } = req.body

    // Validation
    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid project name',
        message: 'Project name must be at least 3 characters long',
      })
    }

    if (!type) {
      return res.status(400).json({
        error: 'Invalid project type',
        message: 'Project type is required (character, weapon, armor, item, environment, mixed)',
      })
    }

    const validTypes = ['character', 'weapon', 'armor', 'item', 'environment', 'mixed']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid project type',
        message: `Type must be one of: ${validTypes.join(', ')}`,
      })
    }

    // Optional: Get user's team if they're in one
    const userTeam = await getUserTeam(req.user.id)
    const teamId = userTeam ? userTeam.id : null

    // Generate unique ID
    const projectId = generateProjectId()

    // Create project
    const newProject = {
      id: projectId,
      userId: req.user.id,
      teamId,
      name: name.trim(),
      description: description?.trim() || null,
      type,
      gameStyle: gameStyle || null,
      gameType: gameType || null,
      artDirection: artDirection?.trim() || null,
      tags: tags ? JSON.stringify(tags) : null,
      thumbnail: thumbnail || null,
      assetCount: 0,
      isPublic: isPublic || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(schema.projects).values(newProject)

    return res.json({
      success: true,
      project: {
        id: newProject.id,
        userId: newProject.userId,
        teamId: newProject.teamId,
        name: newProject.name,
        description: newProject.description,
        type: newProject.type,
        gameStyle: newProject.gameStyle,
        gameType: newProject.gameType,
        artDirection: newProject.artDirection,
        tags: newProject.tags ? JSON.parse(newProject.tags) : [],
        thumbnail: newProject.thumbnail,
        assetCount: newProject.assetCount,
        isPublic: newProject.isPublic,
        createdAt: newProject.createdAt,
        updatedAt: newProject.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Projects] Create project error:', error)
    return res.status(400).json({
      error: 'Failed to create project',
      message: error.message,
    })
  }
}

/**
 * GET /api/projects
 * List user's projects with filtering and pagination
 */
export async function GET_projects(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    // Parse query parameters
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 20, 100) // Max 100 per page
    const offset = (page - 1) * limit

    const typeFilter = req.query.type
    const gameStyleFilter = req.query.gameStyle
    const gameTypeFilter = req.query.gameType
    const teamProjects = req.query.teamProjects === 'true'

    // Build filter conditions
    const conditions = []

    // User's own projects OR team projects
    if (teamProjects && req.user.teamId) {
      conditions.push(
        or(
          eq(schema.projects.userId, req.user.id),
          eq(schema.projects.teamId, req.user.teamId)
        )
      )
    } else {
      conditions.push(eq(schema.projects.userId, req.user.id))
    }

    // Additional filters
    if (typeFilter) {
      conditions.push(eq(schema.projects.type, typeFilter))
    }

    if (gameStyleFilter) {
      conditions.push(eq(schema.projects.gameStyle, gameStyleFilter))
    }

    if (gameTypeFilter) {
      conditions.push(eq(schema.projects.gameType, gameTypeFilter))
    }

    // Combine all conditions
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

    // Get total count
    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(schema.projects)
      .where(whereClause)

    const totalCount = Number(countResult[0].count)
    const totalPages = Math.ceil(totalCount / limit)

    // Get projects
    const projects = await db.query.projects.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
    })

    // Format response
    const formattedProjects = projects.map(project => ({
      id: project.id,
      userId: project.userId,
      teamId: project.teamId,
      name: project.name,
      description: project.description,
      type: project.type,
      gameStyle: project.gameStyle,
      gameType: project.gameType,
      artDirection: project.artDirection,
      tags: project.tags ? JSON.parse(project.tags) : [],
      thumbnail: project.thumbnail,
      assetCount: project.assetCount,
      isPublic: project.isPublic,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }))

    return res.json({
      success: true,
      projects: formattedProjects,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    })
  } catch (error) {
    console.error('[Projects] List projects error:', error)
    return res.status(500).json({
      error: 'Failed to list projects',
      message: error.message,
    })
  }
}

/**
 * GET /api/projects/:id
 * Get project details
 */
export async function GET_project(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { id } = req.params

    // Check access
    const { hasAccess, project, reason } = await hasProjectAccess(req.user.id, id)

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: reason || 'You do not have access to this project',
      })
    }

    // Get asset count (in case it's out of sync)
    const assetCountResult = await db
      .select({ count: sql`count(*)` })
      .from(schema.assets)
      .where(eq(schema.assets.projectId, id))

    const assetCount = Number(assetCountResult[0].count)

    return res.json({
      success: true,
      project: {
        id: project.id,
        userId: project.userId,
        teamId: project.teamId,
        name: project.name,
        description: project.description,
        type: project.type,
        gameStyle: project.gameStyle,
        gameType: project.gameType,
        artDirection: project.artDirection,
        tags: project.tags ? JSON.parse(project.tags) : [],
        thumbnail: project.thumbnail,
        assetCount,
        isPublic: project.isPublic,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Projects] Get project error:', error)
    return res.status(500).json({
      error: 'Failed to get project',
      message: error.message,
    })
  }
}

/**
 * PUT /api/projects/:id
 * Update project
 */
export async function PUT_updateProject(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { id } = req.params
    const {
      name,
      description,
      gameStyle,
      gameType,
      artDirection,
      tags,
      thumbnail,
      isPublic
    } = req.body

    // Check access and ownership
    const { hasAccess, project, isOwner, reason } = await hasProjectAccess(req.user.id, id)

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: reason || 'You do not have access to this project',
      })
    }

    // Only owner or team owner can update
    if (!isOwner) {
      const userTeam = await getUserTeam(req.user.id)
      if (!userTeam || userTeam.ownerId !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only project owner or team owner can update projects',
        })
      }
    }

    // Validate name if provided
    if (name !== undefined && name.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid project name',
        message: 'Project name must be at least 3 characters long',
      })
    }

    // Build update object
    const updates = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (gameStyle !== undefined) updates.gameStyle = gameStyle || null
    if (gameType !== undefined) updates.gameType = gameType || null
    if (artDirection !== undefined) updates.artDirection = artDirection?.trim() || null
    if (tags !== undefined) updates.tags = tags ? JSON.stringify(tags) : null
    if (thumbnail !== undefined) updates.thumbnail = thumbnail || null
    if (isPublic !== undefined) updates.isPublic = isPublic

    // Update project
    await db
      .update(schema.projects)
      .set(updates)
      .where(eq(schema.projects.id, id))

    // Fetch updated project
    const updatedProject = await db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    })

    return res.json({
      success: true,
      project: {
        id: updatedProject.id,
        userId: updatedProject.userId,
        teamId: updatedProject.teamId,
        name: updatedProject.name,
        description: updatedProject.description,
        type: updatedProject.type,
        gameStyle: updatedProject.gameStyle,
        gameType: updatedProject.gameType,
        artDirection: updatedProject.artDirection,
        tags: updatedProject.tags ? JSON.parse(updatedProject.tags) : [],
        thumbnail: updatedProject.thumbnail,
        assetCount: updatedProject.assetCount,
        isPublic: updatedProject.isPublic,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Projects] Update project error:', error)
    return res.status(400).json({
      error: 'Failed to update project',
      message: error.message,
    })
  }
}

/**
 * DELETE /api/projects/:id
 * Delete project (cascades to assets)
 */
export async function DELETE_project(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { id } = req.params

    // Check ownership
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    })

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    // Only owner can delete
    if (project.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only project owner can delete projects',
      })
    }

    // Delete project (cascade deletes assets automatically)
    await db.delete(schema.projects).where(eq(schema.projects.id, id))

    return res.json({
      success: true,
      message: 'Project deleted successfully',
    })
  } catch (error) {
    console.error('[Projects] Delete project error:', error)
    return res.status(400).json({
      error: 'Failed to delete project',
      message: error.message,
    })
  }
}

/**
 * POST /api/projects/:id/share
 * Share project with team
 */
export async function POST_shareProject(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }

    const { id } = req.params

    // Check ownership
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    })

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    if (project.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only project owner can share projects',
      })
    }

    // Check if user is in a team
    const userTeam = await getUserTeam(req.user.id)

    if (!userTeam) {
      return res.status(400).json({
        error: 'No team found',
        message: 'You must be a member of a team to share projects',
      })
    }

    // Share project with team
    await db
      .update(schema.projects)
      .set({
        teamId: userTeam.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, id))

    // Fetch updated project
    const updatedProject = await db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    })

    return res.json({
      success: true,
      message: 'Project shared with team successfully',
      project: {
        id: updatedProject.id,
        userId: updatedProject.userId,
        teamId: updatedProject.teamId,
        name: updatedProject.name,
        description: updatedProject.description,
        type: updatedProject.type,
        gameStyle: updatedProject.gameStyle,
        gameType: updatedProject.gameType,
        artDirection: updatedProject.artDirection,
        tags: updatedProject.tags ? JSON.parse(updatedProject.tags) : [],
        thumbnail: updatedProject.thumbnail,
        assetCount: updatedProject.assetCount,
        isPublic: updatedProject.isPublic,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
      },
    })
  } catch (error) {
    console.error('[Projects] Share project error:', error)
    return res.status(400).json({
      error: 'Failed to share project',
      message: error.message,
    })
  }
}
