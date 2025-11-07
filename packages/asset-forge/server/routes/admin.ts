/**
 * Admin Routes
 * Admin-only endpoints for platform management
 */

import { Elysia, t } from 'elysia'
import { requireAdmin } from '../middleware/privyAuth'
import { db } from '../db/db'
import { users, activityLog, assets, projects } from '../db/schema'
import { eq, desc, count, sql } from 'drizzle-orm'
import { userService } from '../services/UserService'

export const adminRoutes = new Elysia({ prefix: '/api/admin', name: 'admin' })
  .use(requireAdmin)

  /**
   * GET /api/admin/stats
   * Get platform statistics
   */
  .get(
    '/stats',
    async () => {
      const [userCount] = await db.select({ count: count() }).from(users)
      const [assetCount] = await db.select({ count: count() }).from(assets)
      const [projectCount] = await db.select({ count: count() }).from(projects)

      // Get activity in last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const [recentActivity] = await db
        .select({ count: count() })
        .from(activityLog)
        .where(sql`${activityLog.createdAt} > ${yesterday}`)

      return {
        users: userCount.count,
        assets: assetCount.count,
        projects: projectCount.count,
        recentActivity: recentActivity.count,
      }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Get platform statistics',
        description: 'Returns high-level statistics about the platform (Admin only)',
      },
      response: {
        200: t.Object({
          users: t.Number(),
          assets: t.Number(),
          projects: t.Number(),
          recentActivity: t.Number(),
        }),
      },
    }
  )

  /**
   * GET /api/admin/users
   * List all users with pagination
   */
  .get(
    '/users',
    async ({ query }) => {
      const page = query.page || 1
      const limit = query.limit || 50
      const offset = (page - 1) * limit

      // Get total count
      const [totalResult] = await db.select({ count: count() }).from(users)
      const total = totalResult.count

      // Get paginated users
      const userList = await db
        .select({
          id: users.id,
          privyUserId: users.privyUserId,
          email: users.email,
          walletAddress: users.walletAddress,
          displayName: users.displayName,
          role: users.role,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset)

      return {
        users: userList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      }),
      detail: {
        tags: ['Admin'],
        summary: 'List all users',
        description: 'Returns paginated list of all users (Admin only)',
      },
    }
  )

  /**
   * PUT /api/admin/users/:id/role
   * Update user role
   */
  .put(
    '/users/:id/role',
    async ({ params, body, user, set }) => {
      const targetUserId = params.id

      // Prevent admin from demoting themselves
      if (targetUserId === user!.id && body.role !== 'admin') {
        set.status = 400
        return {
          error: 'Invalid operation',
          message: 'Cannot change your own admin role',
        }
      }

      // Update role
      const [updated] = await db
        .update(users)
        .set({ role: body.role, updatedAt: new Date() })
        .where(eq(users.id, targetUserId))
        .returning()

      if (!updated) {
        set.status = 404
        return { error: 'User not found' }
      }

      // Clear cache
      userService.clearCacheByUserId(targetUserId)

      // Log activity
      await userService.logActivity(user!.id, 'user', 'role_updated', {
        targetUserId,
        newRole: body.role,
      })

      return {
        success: true,
        user: {
          id: updated.id,
          role: updated.role,
        },
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        role: t.Union([t.Literal('admin'), t.Literal('member')]),
      }),
      detail: {
        tags: ['Admin'],
        summary: 'Update user role',
        description: 'Changes a user role (Admin only)',
      },
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            role: t.String(),
          }),
        }),
        400: t.Object({
          error: t.String(),
          message: t.String(),
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
    }
  )

  /**
   * GET /api/admin/activity
   * Get recent activity log
   */
  .get(
    '/activity',
    async ({ query }) => {
      const limit = query.limit || 100

      const activities = await db
        .select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(limit)

      return { activities }
    },
    {
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
      }),
      detail: {
        tags: ['Admin'],
        summary: 'Get activity log',
        description: 'Returns recent user activity (Admin only)',
      },
    }
  )

  /**
   * GET /api/admin/assets
   * List all assets with filtering
   */
  .get(
    '/assets',
    async ({ query }) => {
      const page = query.page || 1
      const limit = query.limit || 50
      const offset = (page - 1) * limit
      const statusFilter = query.status

      // Build query
      let dbQuery = db.select().from(assets).orderBy(desc(assets.createdAt))

      if (statusFilter) {
        dbQuery = dbQuery.where(eq(assets.status, statusFilter)) as any
      }

      const assetList = await dbQuery.limit(limit).offset(offset)

      // Get total count
      let countQuery = db.select({ count: count() }).from(assets)
      if (statusFilter) {
        countQuery = countQuery.where(eq(assets.status, statusFilter)) as any
      }
      const [totalResult] = await countQuery
      const total = totalResult.count

      return {
        assets: assetList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        status: t.Optional(
          t.Union([
            t.Literal('draft'),
            t.Literal('processing'),
            t.Literal('completed'),
            t.Literal('failed'),
            t.Literal('approved'),
            t.Literal('published'),
            t.Literal('archived'),
          ])
        ),
      }),
      detail: {
        tags: ['Admin'],
        summary: 'List all assets',
        description: 'Returns paginated list of all assets with optional status filter (Admin only)',
      },
    }
  )

  /**
   * GET /api/admin/assets/pending
   * Get assets pending approval
   */
  .get(
    '/assets/pending',
    async () => {
      const pendingAssets = await db
        .select()
        .from(assets)
        .where(eq(assets.status, 'completed'))
        .orderBy(desc(assets.createdAt))

      return { assets: pendingAssets }
    },
    {
      detail: {
        tags: ['Admin'],
        summary: 'Get pending assets',
        description: 'Returns assets that are completed and awaiting approval (Admin only)',
      },
    }
  )

  /**
   * PUT /api/admin/assets/:id/approve
   * Approve an asset for export
   */
  .put(
    '/assets/:id/approve',
    async ({ params, user, set }) => {
      const assetId = params.id

      // Check if asset exists
      const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1)

      if (!asset) {
        set.status = 404
        return { error: 'Asset not found' }
      }

      // Update status to approved
      const [updated] = await db
        .update(assets)
        .set({
          status: 'approved',
          updatedAt: new Date(),
        })
        .where(eq(assets.id, assetId))
        .returning()

      // Log activity
      await userService.logActivity(user!.id, 'asset', 'approved', {
        assetId,
        assetName: asset.name,
        assetType: asset.type,
      })

      return {
        success: true,
        asset: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
        },
        message: `Asset "${updated.name}" approved and ready for export`,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      detail: {
        tags: ['Admin'],
        summary: 'Approve asset',
        description: 'Approves an asset for export to the assets repository (Admin only)',
      },
      response: {
        200: t.Object({
          success: t.Boolean(),
          asset: t.Object({
            id: t.String(),
            name: t.String(),
            status: t.String(),
          }),
          message: t.String(),
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
    }
  )

  /**
   * PUT /api/admin/assets/:id/reject
   * Reject an asset
   */
  .put(
    '/assets/:id/reject',
    async ({ params, body, user, set }) => {
      const assetId = params.id

      // Check if asset exists
      const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1)

      if (!asset) {
        set.status = 404
        return { error: 'Asset not found' }
      }

      // Update status to failed with reason
      const [updated] = await db
        .update(assets)
        .set({
          status: 'failed',
          metadata: {
            ...((asset.metadata as any) || {}),
            rejectionReason: body.reason,
            rejectedAt: new Date().toISOString(),
            rejectedBy: user!.id,
          },
          updatedAt: new Date(),
        })
        .where(eq(assets.id, assetId))
        .returning()

      // Log activity
      await userService.logActivity(user!.id, 'asset', 'rejected', {
        assetId,
        assetName: asset.name,
        reason: body.reason,
      })

      return {
        success: true,
        asset: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
        },
        message: `Asset "${updated.name}" rejected`,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        reason: t.String({ minLength: 1, maxLength: 500 }),
      }),
      detail: {
        tags: ['Admin'],
        summary: 'Reject asset',
        description: 'Rejects an asset with a reason (Admin only)',
      },
      response: {
        200: t.Object({
          success: t.Boolean(),
          asset: t.Object({
            id: t.String(),
            name: t.String(),
            status: t.String(),
          }),
          message: t.String(),
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
    }
  )
