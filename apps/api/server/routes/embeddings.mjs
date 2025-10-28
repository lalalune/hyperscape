/**
 * Embeddings API Routes
 * Search and manage vector embeddings for game content
 */

import express from 'express'
import db from '../database/db.mjs'
import ContentEmbedder from '../services/ContentEmbedder.mjs'

const router = express.Router()

/**
 * GET /api/embeddings/search
 * Search for similar content using semantic search
 */
router.get('/search', async (req, res) => {
  const startTime = Date.now()

  try {
    const {
      q: query,
      type: contentType,
      limit = 10,
      threshold = 0.7
    } = req.query

    if (typeof query !== 'string' || !query) {
      return res.status(400).json({
        error: 'Invalid query parameter',
        code: 'EMBED_3000'
      })
    }

    console.log(`[Embeddings API] Searching for: "${query}" (type: ${contentType || 'all'}, limit: ${limit})`)

    const embedder = new ContentEmbedder(db)
    const results = await embedder.findSimilar(query, {
      contentType: contentType || null,
      limit: parseInt(limit),
      threshold: parseFloat(threshold)
    })

    const duration = Date.now() - startTime

    console.log(`[Embeddings API] Found ${results.length} results (${duration}ms)`)

    res.json({
      query,
      contentType: contentType || 'all',
      results,
      count: results.length,
      duration
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Embeddings API] Search failed (${duration}ms):`, error.message)

    res.status(500).json({
      error: 'Search failed',
      code: 'EMBED_3001',
      message: error.message
    })
  }
})

/**
 * POST /api/embeddings/build-context
 * Build AI context from similar content
 */
router.post('/build-context', async (req, res) => {
  const startTime = Date.now()

  try {
    const {
      query,
      contentType,
      limit = 5,
      threshold = 0.7
    } = req.body

    if (!query) {
      return res.status(400).json({
        error: 'Missing query in request body',
        code: 'EMBED_3000'
      })
    }

    console.log(`[Embeddings API] Building context for: "${query}"`)

    const embedder = new ContentEmbedder(db)
    const context = await embedder.buildContext(query, {
      contentType,
      limit: parseInt(limit),
      threshold: parseFloat(threshold)
    })

    const duration = Date.now() - startTime

    console.log(`[Embeddings API] Built context with ${context.sources.length} sources (${duration}ms)`)

    res.json({
      query,
      hasContext: context.hasContext,
      context: context.context,
      sources: context.sources,
      duration
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Embeddings API] Context building failed (${duration}ms):`, error.message)

    res.status(500).json({
      error: 'Failed to build context',
      code: 'EMBED_3002',
      message: error.message
    })
  }
})

/**
 * GET /api/embeddings/stats
 * Get embedding statistics
 */
router.get('/stats', async (req, res) => {
  const startTime = Date.now()

  try {
    console.log('[Embeddings API] Fetching stats')

    const embedder = new ContentEmbedder(db)
    const stats = await embedder.getStats()

    const duration = Date.now() - startTime

    console.log(`[Embeddings API] Retrieved stats for ${stats.length} content types (${duration}ms)`)

    res.json({
      stats,
      duration
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Embeddings API] Stats fetch failed (${duration}ms):`, error.message)

    res.status(500).json({
      error: 'Failed to fetch stats',
      code: 'EMBED_3003',
      message: error.message
    })
  }
})

/**
 * POST /api/embeddings/embed
 * Manually embed content
 */
router.post('/embed', async (req, res) => {
  const startTime = Date.now()

  try {
    const {
      contentType,
      contentId,
      data
    } = req.body

    if (!contentType || !contentId || !data) {
      return res.status(400).json({
        error: 'Missing required fields: contentType, contentId, data',
        code: 'EMBED_3000'
      })
    }

    const validTypes = ['lore', 'quest', 'item', 'character', 'npc', 'manifest']
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({
        error: `Invalid content type. Must be one of: ${validTypes.join(', ')}`,
        code: 'EMBED_3004'
      })
    }

    console.log(`[Embeddings API] Embedding ${contentType}:${contentId}`)

    const embedder = new ContentEmbedder(db)

    let result
    switch (contentType) {
      case 'lore':
        result = await embedder.embedLore(contentId, data)
        break
      case 'quest':
        result = await embedder.embedQuest(contentId, data)
        break
      case 'item':
        result = await embedder.embedItem(contentId, data)
        break
      case 'character':
        result = await embedder.embedCharacter(contentId, data)
        break
      case 'npc':
        result = await embedder.embedNPC(contentId, data)
        break
      case 'manifest':
        result = await embedder.embedManifest(contentId, data)
        break
    }

    const duration = Date.now() - startTime

    console.log(`[Embeddings API] Embedded ${contentType}:${contentId} (id=${result.id}, ${duration}ms)`)

    res.json({
      success: true,
      contentType,
      contentId,
      embeddingId: result.id,
      duration
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Embeddings API] Embedding failed (${duration}ms):`, error.message)

    res.status(500).json({
      error: 'Failed to embed content',
      code: 'EMBED_3005',
      message: error.message
    })
  }
})

/**
 * POST /api/embeddings/batch
 * Batch embed multiple items
 */
router.post('/batch', async (req, res) => {
  const startTime = Date.now()

  try {
    const { contentType, items } = req.body

    if (!contentType || !items || !Array.isArray(items)) {
      return res.status(400).json({
        error: 'Missing required fields: contentType, items (array)',
        code: 'EMBED_3000'
      })
    }

    console.log(`[Embeddings API] Batch embedding ${items.length} ${contentType} items`)

    const embedder = new ContentEmbedder(db)
    const results = await embedder.embedBatch(contentType, items)

    const duration = Date.now() - startTime

    console.log(`[Embeddings API] Batch embedded ${results.length} items (${duration}ms)`)

    res.json({
      success: true,
      contentType,
      count: results.length,
      duration
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Embeddings API] Batch embedding failed (${duration}ms):`, error.message)

    res.status(500).json({
      error: 'Failed to batch embed content',
      code: 'EMBED_3006',
      message: error.message
    })
  }
})

/**
 * DELETE /api/embeddings/:contentType/:contentId
 * Delete embedding for content
 */
router.delete('/:contentType/:contentId', async (req, res) => {
  const startTime = Date.now()

  try {
    const { contentType, contentId } = req.params

    console.log(`[Embeddings API] Deleting embedding for ${contentType}:${contentId}`)

    const embedder = new ContentEmbedder(db)
    const deleted = await embedder.deleteEmbedding(contentType, contentId)

    const duration = Date.now() - startTime

    if (deleted) {
      console.log(`[Embeddings API] Deleted embedding for ${contentType}:${contentId} (${duration}ms)`)
      res.json({
        success: true,
        contentType,
        contentId,
        duration
      })
    } else {
      console.log(`[Embeddings API] Embedding not found for ${contentType}:${contentId} (${duration}ms)`)
      res.status(404).json({
        error: 'Embedding not found',
        code: 'EMBED_3007',
        contentType,
        contentId
      })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Embeddings API] Delete failed (${duration}ms):`, error.message)

    res.status(500).json({
      error: 'Failed to delete embedding',
      code: 'EMBED_3008',
      message: error.message
    })
  }
})

export default router
