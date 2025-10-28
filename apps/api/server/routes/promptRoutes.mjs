import { Hono } from 'hono'
import { loadPromptFile, savePromptFile } from '../utils/promptLoader.mjs'

const router = new Hono()

// Map of URL paths to file names
const promptFileMap = {
  'game-styles': 'game-style-prompts',
  'asset-types': 'asset-type-prompts',
  'materials': 'material-prompts',
  'generation': 'generation-prompts',
  'gpt4-enhancement': 'gpt4-enhancement-prompts',
  'weapon-detection': 'weapon-detection-prompts'
}

// GET endpoint for loading prompts
router.get('/prompts/:type', async (c) => {
  const { type } = c.req.param()

  const fileName = promptFileMap[type]

  if (!fileName) {
    return c.json({ error: 'Invalid prompt type' }, 404)
  }

  try {
    const prompts = await loadPromptFile(fileName)
    if (!prompts) {
      return c.json({ error: 'Prompt file not found' }, 404)
    }
    return c.json(prompts)
  } catch (error) {
    console.error(`Error loading prompts for ${type}:`, error)
    return c.json({ error: 'Failed to load prompts' }, 500)
  }
})

// POST endpoint for saving prompts (only updates custom section)
router.post('/prompts/:type', async (c) => {
  const { type } = c.req.param()
  const fileName = promptFileMap[type]

  if (!fileName) {
    return c.json({ error: 'Invalid prompt type' }, 404)
  }

  try {
    const updatedPrompts = await c.req.json()

    // Validate the structure - special handling for asset-types
    if (type === 'asset-types') {
      if (!updatedPrompts.version || !updatedPrompts.avatar || !updatedPrompts.item) {
        return c.json({ error: 'Invalid asset type prompt structure' }, 400)
      }
    } else {
      if (!updatedPrompts.version || !updatedPrompts.default || !updatedPrompts.custom) {
        return c.json({ error: 'Invalid prompt structure' }, 400)
      }
    }

    // Save the updated prompts
    const success = await savePromptFile(fileName, updatedPrompts)

    if (success) {
      return c.json({ success: true, message: 'Prompts updated successfully' })
    } else {
      return c.json({ error: 'Failed to save prompts' }, 500)
    }
  } catch (error) {
    console.error(`Error saving prompts for ${type}:`, error)
    return c.json({ error: 'Failed to save prompts' }, 500)
  }
})

// DELETE endpoint to remove a custom prompt
router.delete('/prompts/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const fileName = promptFileMap[type]

  if (!fileName) {
    return c.json({ error: 'Invalid prompt type' }, 404)
  }

  try {
    // Load current prompts
    const currentPrompts = await loadPromptFile(fileName)
    if (!currentPrompts) {
      return c.json({ error: 'Prompt file not found' }, 404)
    }

    // Handle deletion based on type
    if (type === 'asset-types') {
      // For asset types, we need the category (avatar or item)
      const category = c.req.query('category')
      if (!category || !['avatar', 'item'].includes(category)) {
        return c.json({ error: 'Category parameter required (avatar or item)' }, 400)
      }

      if (currentPrompts[category]?.custom?.[id]) {
        delete currentPrompts[category].custom[id]
      } else {
        return c.json({ error: 'Custom asset type not found' }, 404)
      }
    } else {
      // For other types, delete from custom section
      if (currentPrompts.custom?.[id]) {
        delete currentPrompts.custom[id]
      } else {
        return c.json({ error: 'Custom prompt not found' }, 404)
      }
    }

    // Save the updated prompts
    const success = await savePromptFile(fileName, currentPrompts)

    if (success) {
      return c.json({ success: true, message: 'Prompt deleted successfully' })
    } else {
      return c.json({ error: 'Failed to save prompts after deletion' }, 500)
    }
  } catch (error) {
    console.error(`Error deleting prompt ${id} from ${type}:`, error)
    return c.json({ error: 'Failed to delete prompt' }, 500)
  }
})

export default router
