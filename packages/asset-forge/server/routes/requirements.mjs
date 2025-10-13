/**
 * Asset Requirements API Routes
 * Endpoints for checking asset coverage and getting generation queues
 */

import { Router } from 'express'
import { AssetRequirementsService } from '../services/AssetRequirementsService.mjs'
import path from 'path'

const router = Router()

// Initialize service
let requirementsService = null

function getService(req) {
  if (!requirementsService) {
    const assetsDir = path.join(process.cwd(), '../../hyperscape/world/assets')
    requirementsService = new AssetRequirementsService(assetsDir, assetsDir)
  }
  return requirementsService
}

/**
 * GET /api/requirements/coverage
 * Get asset coverage report
 */
router.get('/coverage', async (req, res) => {
  try {
    const service = getService(req)
    const coverage = await service.validateCoverage()
    
    res.json({
      success: true,
      coverage
    })
  } catch (error) {
    console.error('[Requirements API] Coverage check failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/requirements/queue
 * Get generation queue sorted by priority
 */
router.get('/queue', async (req, res) => {
  try {
    const service = getService(req)
    const { priority, category, limit } = req.query
    
    let queue = await service.getGenerationQueue()
    
    // Apply filters
    if (priority && priority !== 'all') {
      queue = queue.filter(asset => asset.priority === priority)
    }
    
    if (category) {
      queue = queue.filter(asset => asset.category === category)
    }
    
    if (limit) {
      queue = queue.slice(0, parseInt(limit, 10))
    }
    
    res.json({
      success: true,
      queue,
      total: queue.length
    })
  } catch (error) {
    console.error('[Requirements API] Queue fetch failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/requirements/batch-config
 * Generate a batch generation configuration
 */
router.get('/batch-config', async (req, res) => {
  try {
    const service = getService(req)
    const { priority, limit } = req.query
    
    const batchConfig = await service.createBatchGenerationConfig(
      limit ? parseInt(limit, 10) : 10,
      priority || 'critical'
    )
    
    res.json({
      success: true,
      config: batchConfig,
      count: batchConfig.length
    })
  } catch (error) {
    console.error('[Requirements API] Batch config failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/requirements/all
 * Get all required assets
 */
router.get('/all', async (req, res) => {
  try {
    const service = getService(req)
    const requirements = await service.getAllRequiredAssets()
    
    res.json({
      success: true,
      requirements,
      total: requirements.length
    })
  } catch (error) {
    console.error('[Requirements API] Get all failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/requirements/report
 * Generate and export coverage report
 */
router.post('/report', async (req, res) => {
  try {
    const service = getService(req)
    const report = await service.exportCoverageReport()
    
    res.json({
      success: true,
      report
    })
  } catch (error) {
    console.error('[Requirements API] Report export failed:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router

