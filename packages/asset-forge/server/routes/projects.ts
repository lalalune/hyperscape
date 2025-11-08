/**
 * Project Routes
 * Project management endpoints
 */

import { Elysia, t } from 'elysia'
import { authPlugin } from '../middleware/privyAuth'
import { projectService } from '../services/ProjectService'

export const projectRoutes = new Elysia({ prefix: '/api/projects', name: 'projects' })
  .use(authPlugin)

  /**
   * GET /api/projects
   * List user's projects
   */
  .get(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      const projects = await projectService.getProjectsByOwner(user.id)
      return projects
    },
    {
      detail: {
        tags: ['Projects'],
        summary: 'List user projects',
        description: 'Returns all active projects owned by the authenticated user'
      }
    }
  )

  /**
   * POST /api/projects
   * Create new project
   */
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      const project = await projectService.createProject(
        body.name,
        user.id,
        body.description
      )
      return project
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String())
      }),
      detail: {
        tags: ['Projects'],
        summary: 'Create project',
        description: 'Creates a new project for the authenticated user'
      }
    }
  )

  /**
   * GET /api/projects/:id
   * Get single project
   */
  .get(
    '/:id',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      const project = await projectService.getProject(params.id, user.id)

      if (!project) {
        set.status = 404
        return { error: 'Project not found or access denied' }
      }

      return project
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        tags: ['Projects'],
        summary: 'Get project',
        description: 'Returns a single project (with ownership verification)'
      }
    }
  )

  /**
   * PATCH /api/projects/:id
   * Update project
   */
  .patch(
    '/:id',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      const updated = await projectService.updateProject(
        params.id,
        user.id,
        body
      )

      if (!updated) {
        set.status = 404
        return { error: 'Project not found or access denied' }
      }

      return updated
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        description: t.Optional(t.String()),
        status: t.Optional(t.Union([t.Literal('active'), t.Literal('archived')]))
      }),
      detail: {
        tags: ['Projects'],
        summary: 'Update project',
        description: 'Updates a project (with ownership verification)'
      }
    }
  )

  /**
   * DELETE /api/projects/:id
   * Delete project (soft delete)
   */
  .delete(
    '/:id',
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      try {
        await projectService.deleteProject(params.id, user.id)
        return { success: true, message: 'Project deleted' }
      } catch (error) {
        set.status = 404
        return { error: (error as Error).message }
      }
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        tags: ['Projects'],
        summary: 'Delete project',
        description: 'Soft deletes a project (with ownership verification)'
      }
    }
  )
