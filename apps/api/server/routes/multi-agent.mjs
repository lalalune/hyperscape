/**
 * Multi-Agent API Routes
 * Collaborative AI content generation with multiple agents
 */

import { Hono } from 'hono'

const router = new Hono()

/**
 * GET /api/playtester-personas
 * Get predefined playtester personas
 */
router.get('/playtester-personas', async (c) => {
  try {
    // Import personas from playtester-prompts
    const { PLAYTESTER_PERSONAS } = await import('../utils/playtester-prompts.mjs')

    return c.json({
      personas: PLAYTESTER_PERSONAS,
      count: PLAYTESTER_PERSONAS.length,
      description: 'Predefined AI playtester personas based on common player archetypes'
    })
  } catch (error) {
    console.error('[Multi-Agent] Playtester Personas error:', error)
    return c.json({
      error: 'Failed to fetch playtester personas',
      code: 'MULTIAGENT_5020',
      details: error.message
    }, 500)
  }
})

export default router
