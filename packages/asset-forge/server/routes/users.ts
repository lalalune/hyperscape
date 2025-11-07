/**
 * User Routes
 * User profile and settings management
 */

import { Elysia, t } from 'elysia'
import { authPlugin, requireAuth } from '../middleware/privyAuth'
import { userService } from '../services/UserService'

export const userRoutes = new Elysia({ prefix: '/api/users', name: 'users' })
  .use(authPlugin)

  /**
   * GET /api/users/me
   * Get current user profile
   */
  .get(
    '/me',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      return {
        id: user.id,
        privyUserId: user.privyUserId,
        email: user.email,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        settings: user.settings,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      }
    },
    {
      detail: {
        tags: ['Users'],
        summary: 'Get current user profile',
        description: 'Returns the authenticated user profile',
      },
      response: {
        200: t.Object({
          id: t.String(),
          privyUserId: t.String(),
          email: t.Nullable(t.String()),
          walletAddress: t.Nullable(t.String()),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          role: t.String(),
          settings: t.Any(),
          createdAt: t.Date(),
          lastLoginAt: t.Nullable(t.Date()),
        }),
        401: t.Object({
          error: t.String(),
          message: t.String(),
        }),
      },
    }
  )

  /**
   * PATCH /api/users/me
   * Update current user profile
   */
  .patch(
    '/me',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401
        return { error: 'Unauthorized', message: 'Authentication required' }
      }

      const updated = await userService.updateUser(user.id, body)

      // Log activity
      await userService.logActivity(user.id, 'user', 'updated', { fields: Object.keys(body) })

      return {
        id: updated.id,
        privyUserId: updated.privyUserId,
        email: updated.email,
        walletAddress: updated.walletAddress,
        displayName: updated.displayName,
        avatarUrl: updated.avatarUrl,
        role: updated.role,
        settings: updated.settings,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }
    },
    {
      body: t.Object({
        displayName: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        avatarUrl: t.Optional(t.String({ maxLength: 512 })),
        settings: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Users'],
        summary: 'Update user profile',
        description: 'Updates the authenticated user profile',
      },
      response: {
        200: t.Object({
          id: t.String(),
          privyUserId: t.String(),
          email: t.Nullable(t.String()),
          walletAddress: t.Nullable(t.String()),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          role: t.String(),
          settings: t.Any(),
          createdAt: t.Date(),
          updatedAt: t.Date(),
        }),
        401: t.Object({
          error: t.String(),
          message: t.String(),
        }),
      },
    }
  )
