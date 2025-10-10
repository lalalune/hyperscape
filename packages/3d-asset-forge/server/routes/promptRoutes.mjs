import express from 'express'
import { loadPromptFile, savePromptFile } from '../utils/promptLoader.mjs'

const router = express.Router()

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
router.get('/prompts/:type', async (req, res) => {
  const { type } = req.params
  const fileName = promptFileMap[type]
  
  if (!fileName) {
    return res.status(404).json({ error: 'Invalid prompt type' })
  }
  
  try {
    const prompts = await loadPromptFile(fileName)
    if (!prompts) {
      return res.status(404).json({ error: 'Prompt file not found' })
    }
    res.json(prompts)
  } catch (error) {
    console.error(`Error loading prompts for ${type}:`, error)
    res.status(500).json({ error: 'Failed to load prompts' })
  }
})

// POST endpoint for saving prompts (only updates custom section)
router.post('/prompts/:type', async (req, res) => {
  const { type } = req.params
  const fileName = promptFileMap[type]
  
  if (!fileName) {
    return res.status(404).json({ error: 'Invalid prompt type' })
  }
  
  try {
    const updatedPrompts = req.body
    
    // Validate the structure - special handling for asset-types
    if (type === 'asset-types') {
      if (!updatedPrompts.version || !updatedPrompts.avatar || !updatedPrompts.item) {
        return res.status(400).json({ error: 'Invalid asset type prompt structure' })
      }
    } else {
      if (!updatedPrompts.version || !updatedPrompts.default || !updatedPrompts.custom) {
        return res.status(400).json({ error: 'Invalid prompt structure' })
      }
    }
    
    // Save the updated prompts
    const success = await savePromptFile(fileName, updatedPrompts)
    
    if (success) {
      res.json({ success: true, message: 'Prompts updated successfully' })
    } else {
      res.status(500).json({ error: 'Failed to save prompts' })
    }
  } catch (error) {
    console.error(`Error saving prompts for ${type}:`, error)
    res.status(500).json({ error: 'Failed to save prompts' })
  }
})

// DELETE endpoint to remove a custom prompt
router.delete('/prompts/:type/:id', async (req, res) => {
  const { type, id } = req.params
  const fileName = promptFileMap[type]
  
  if (!fileName) {
    return res.status(404).json({ error: 'Invalid prompt type' })
  }
  
  try {
    // Load current prompts
    const currentPrompts = await loadPromptFile(fileName)
    if (!currentPrompts) {
      return res.status(404).json({ error: 'Prompt file not found' })
    }
    
    // Handle deletion based on type
    if (type === 'asset-types') {
      // For asset types, we need the category (avatar or item)
      const { category } = req.query
      if (!category || !['avatar', 'item'].includes(category)) {
        return res.status(400).json({ error: 'Category parameter required (avatar or item)' })
      }
      
      if (currentPrompts[category]?.custom?.[id]) {
        delete currentPrompts[category].custom[id]
      } else {
        return res.status(404).json({ error: 'Custom asset type not found' })
      }
    } else {
      // For other types, delete from custom section
      if (currentPrompts.custom?.[id]) {
        delete currentPrompts.custom[id]
      } else {
        return res.status(404).json({ error: 'Custom prompt not found' })
      }
    }
    
    // Save the updated prompts
    const success = await savePromptFile(fileName, currentPrompts)
    
    if (success) {
      res.json({ success: true, message: 'Prompt deleted successfully' })
    } else {
      res.status(500).json({ error: 'Failed to save prompts after deletion' })
    }
  } catch (error) {
    console.error(`Error deleting prompt ${id} from ${type}:`, error)
    res.status(500).json({ error: 'Failed to delete prompt' })
  }
})

export default router