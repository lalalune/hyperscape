/**
 * Admin Approvals API Routes
 * Admin-only endpoints for reviewing and approving manifest submissions
 */

import { Hono } from 'hono'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '../database/db.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = new Hono()

/**
 * Convert Privy user ID to internal UUID
 */
async function getUserId(privyUserId) {
  const result = await query(
    'SELECT id FROM users WHERE privy_user_id = $1',
    [privyUserId]
  )
  return result.rows[0]?.id
}

/**
 * Check if user is admin
 */
async function isAdmin(userId) {
  const result = await query('SELECT role FROM users WHERE id = $1', [userId])
  return result.rows[0]?.role === 'admin' || result.rows[0]?.role === 'owner'
}

/**
 * GET /api/admin/submissions/pending
 * Get all pending submissions (admin only)
 */
router.get('/pending', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check admin status
    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    // Get all pending submissions with user info
    const result = await query(
      `SELECT
        s.*,
        u.display_name,
        u.email
       FROM manifest_submissions s
       JOIN users u ON s.user_id = u.id
       WHERE s.status = 'pending'
       ORDER BY s.submitted_at ASC`
    )

    return c.json({
      count: result.rows.length,
      submissions: result.rows.map(row => ({
        id: row.id,
        manifestType: row.manifest_type,
        itemId: row.item_id,
        itemData: row.item_data,
        status: row.status,
        submittedAt: row.submitted_at,
        hasDetails: row.has_details,
        hasSprites: row.has_sprites,
        hasImages: row.has_images,
        has3dModel: row.has_3d_model,
        spriteUrls: row.sprite_urls,
        imageUrls: row.image_urls,
        modelUrl: row.model_url,
        user: {
          displayName: row.display_name,
          email: row.email
        }
      }))
    })
  } catch (error) {
    console.error('[Admin Approvals] Error fetching pending submissions:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/admin/submissions/stats
 * Get admin submission statistics
 */
router.get('/stats', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check admin status
    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    // Get pending count
    const pendingResult = await query(
      `SELECT COUNT(*) as count FROM manifest_submissions WHERE status = 'pending'`
    )

    // Get approved today count
    const approvedTodayResult = await query(
      `SELECT COUNT(*) as count
       FROM manifest_submissions
       WHERE status = 'approved'
       AND reviewed_at >= CURRENT_DATE`
    )

    // Get rejected today count
    const rejectedTodayResult = await query(
      `SELECT COUNT(*) as count
       FROM manifest_submissions
       WHERE status = 'rejected'
       AND reviewed_at >= CURRENT_DATE`
    )

    // Get total submissions count
    const totalResult = await query(
      `SELECT COUNT(*) as count FROM manifest_submissions`
    )

    return c.json({
      pending: parseInt(pendingResult.rows[0].count) || 0,
      approvedToday: parseInt(approvedTodayResult.rows[0].count) || 0,
      rejectedToday: parseInt(rejectedTodayResult.rows[0].count) || 0,
      total: parseInt(totalResult.rows[0].count) || 0
    })
  } catch (error) {
    console.error('[Admin Approvals] Error fetching stats:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * GET /api/admin/submissions/:id
 * Get submission with full details (admin only)
 */
router.get('/:id', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check admin status
    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const id = c.req.param('id')

    const result = await query(
      `SELECT
        s.*,
        u.display_name,
        u.email,
        u.wallet_address
       FROM manifest_submissions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Submission not found' }, 404)
    }

    const submission = result.rows[0]

    return c.json({
      id: submission.id,
      manifestType: submission.manifest_type,
      itemId: submission.item_id,
      itemData: submission.item_data,
      editedItemData: submission.edited_item_data,
      wasEdited: submission.was_edited,
      status: submission.status,
      submittedAt: submission.submitted_at,
      reviewedAt: submission.reviewed_at,
      reviewedBy: submission.reviewed_by,
      adminNotes: submission.admin_notes,
      rejectionReason: submission.rejection_reason,
      hasDetails: submission.has_details,
      hasSprites: submission.has_sprites,
      hasImages: submission.has_images,
      has3dModel: submission.has_3d_model,
      spriteUrls: submission.sprite_urls,
      imageUrls: submission.image_urls,
      modelUrl: submission.model_url,
      user: {
        displayName: submission.display_name,
        email: submission.email,
        walletAddress: submission.wallet_address
      }
    })
  } catch (error) {
    console.error('[Admin Approvals] Error fetching submission:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * PUT /api/admin/submissions/:id/edit
 * Edit submission before approval (admin only)
 */
router.put('/:id/edit', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check admin status
    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const id = c.req.param('id')
    const { editedItemData, adminNotes } = await c.req.json()

    if (!editedItemData) {
      return c.json({ error: 'editedItemData is required' }, 400)
    }

    const result = await query(
      `UPDATE manifest_submissions
       SET edited_item_data = $1,
           was_edited = true,
           admin_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(editedItemData), adminNotes || null, id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Submission not found' }, 404)
    }

    const submission = result.rows[0]

    return c.json({
      success: true,
      message: 'Submission edited successfully',
      submission: {
        id: submission.id,
        editedItemData: submission.edited_item_data,
        wasEdited: submission.was_edited,
        adminNotes: submission.admin_notes,
        updatedAt: submission.updated_at
      }
    })
  } catch (error) {
    console.error('[Admin Approvals] Error editing submission:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * POST /api/admin/submissions/:id/approve
 * Approve submission and add to manifest (admin only)
 */
router.post('/:id/approve', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check admin status
    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const id = c.req.param('id')
    const { adminNotes } = await c.req.json()

    // Get submission details
    const submissionResult = await query(
      'SELECT * FROM manifest_submissions WHERE id = $1',
      [id]
    )

    if (submissionResult.rows.length === 0) {
      return c.json({ error: 'Submission not found' }, 404)
    }

    const submission = submissionResult.rows[0]

    // Update submission status
    await query(
      `UPDATE manifest_submissions
       SET status = 'approved',
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $1,
           admin_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [userId, adminNotes || null, id]
    )

    // Use edited data if exists, otherwise use original
    const itemToAdd = submission.was_edited && submission.edited_item_data
      ? submission.edited_item_data
      : submission.item_data

    // Get system user (owner of original manifests)
    const systemUserResult = await query(
      `SELECT id FROM users WHERE privy_user_id = 'system' LIMIT 1`
    )

    if (systemUserResult.rows.length === 0) {
      return c.json({ error: 'System user not found' }, 500)
    }

    const systemUserId = systemUserResult.rows[0].id

    // Get or create system manifest
    let manifestResult = await query(
      `SELECT * FROM preview_manifests
       WHERE user_id = $1 AND manifest_type = $2 AND is_original = true`,
      [systemUserId, submission.manifest_type]
    )

    let manifestData = []
    if (manifestResult.rows.length > 0) {
      manifestData = manifestResult.rows[0].content || []
    }

    // Add or update item in manifest content
    if (Array.isArray(manifestData)) {
      const existingIndex = manifestData.findIndex(
        item => item.id === submission.item_id
      )
      if (existingIndex >= 0) {
        manifestData[existingIndex] = itemToAdd
      } else {
        manifestData.push(itemToAdd)
      }
    }

    // Update or create preview manifest with new item
    if (manifestResult.rows.length > 0) {
      // Update existing manifest
      await query(
        `UPDATE preview_manifests
         SET content = $1,
             version = version + 1,
             status = 'published',
             published_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND manifest_type = $3 AND is_original = true`,
        [JSON.stringify(manifestData), systemUserId, submission.manifest_type]
      )
    } else {
      // Create new manifest
      await query(
        `INSERT INTO preview_manifests (
          user_id,
          manifest_type,
          content,
          is_original,
          status,
          published_at,
          version
        )
        VALUES ($1, $2, $3, true, 'published', CURRENT_TIMESTAMP, 1)`,
        [systemUserId, submission.manifest_type, JSON.stringify(manifestData)]
      )
    }

    // Also write back to file system for backwards compatibility
    const manifestPath = path.join(
      __dirname,
      '../../../..',
      'packages/server/world/assets/manifests',
      `${submission.manifest_type}.json`
    )

    try {
      await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2))
    } catch (error) {
      console.warn('[Admin Approvals] Failed to write manifest file:', error.message)
      // Don't fail the approval if file write fails
    }

    // Create notification for user
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [
        submission.user_id,
        'submission_approved',
        'Submission Approved',
        `Your ${submission.manifest_type} item "${itemToAdd.name}" has been approved and added to the game!`
      ]
    )

    // Create version record
    await query(
      `INSERT INTO manifest_versions (
        entity_type,
        entity_id,
        version_number,
        change_type,
        data_snapshot,
        changed_by,
        change_summary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'submission',
        id,
        1,
        'approved',
        JSON.stringify(itemToAdd),
        userId,
        `Approved submission: ${itemToAdd.name}`
      ]
    )

    return c.json({
      success: true,
      message: 'Submission approved and added to manifest',
      submission: {
        id,
        status: 'approved',
        manifestType: submission.manifest_type,
        itemId: submission.item_id
      }
    })
  } catch (error) {
    console.error('[Admin Approvals] Error approving submission:', error)
    return c.json({ error: error.message }, 500)
  }
})

/**
 * POST /api/admin/submissions/:id/reject
 * Reject submission (admin only)
 */
router.post('/:id/reject', async (c) => {
  try {
    const privyUserId = c.req.header('x-user-id')
    if (!privyUserId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = await getUserId(privyUserId)
    if (!userId) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check admin status
    const userIsAdmin = await isAdmin(userId)
    if (!userIsAdmin) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const id = c.req.param('id')
    const { rejectionReason, adminNotes } = await c.req.json()

    if (!rejectionReason || rejectionReason.trim() === '') {
      return c.json({ error: 'rejectionReason is required' }, 400)
    }

    // Get submission details for notification
    const submissionResult = await query(
      'SELECT user_id, manifest_type, item_data FROM manifest_submissions WHERE id = $1',
      [id]
    )

    if (submissionResult.rows.length === 0) {
      return c.json({ error: 'Submission not found' }, 404)
    }

    const submission = submissionResult.rows[0]

    // Update submission status
    const result = await query(
      `UPDATE manifest_submissions
       SET status = 'rejected',
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = $1,
           rejection_reason = $2,
           admin_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [userId, rejectionReason, adminNotes || null, id]
    )

    // Create notification for user
    const itemName = submission.item_data?.name || 'Unknown item'
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [
        submission.user_id,
        'submission_rejected',
        'Submission Rejected',
        `Your ${submission.manifest_type} item "${itemName}" was rejected. Reason: ${rejectionReason}`
      ]
    )

    return c.json({
      success: true,
      message: 'Submission rejected',
      submission: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        rejectionReason: result.rows[0].rejection_reason,
        reviewedAt: result.rows[0].reviewed_at
      }
    })
  } catch (error) {
    console.error('[Admin Approvals] Error rejecting submission:', error)
    return c.json({ error: error.message }, 500)
  }
})

export default router
