import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cache for loaded prompts
const promptCache = new Map()

export async function loadPromptFile(promptType) {
  // Check cache first
  if (promptCache.has(promptType)) {
    return promptCache.get(promptType)
  }

  const filePath = path.join(__dirname, '../../public/prompts', `${promptType}.json`)
  
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    promptCache.set(promptType, data)
    return data
  } catch (error) {
    console.error(`Failed to load prompt file ${promptType}:`, error)
    return null
  }
}

export async function savePromptFile(promptType, data) {
  const filePath = path.join(__dirname, '../../public/prompts', `${promptType}.json`)
  
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    // Update cache
    promptCache.set(promptType, data)
    return true
  } catch (error) {
    console.error(`Failed to save prompt file ${promptType}:`, error)
    return false
  }
}

export async function loadAllPrompts() {
  const promptTypes = [
    'game-style-prompts',
    'asset-type-prompts',
    'material-prompts',
    'generation-prompts',
    'gpt4-enhancement-prompts',
    'weapon-detection-prompts'
  ]

  const prompts = {}
  
  for (const type of promptTypes) {
    const data = await loadPromptFile(type)
    if (data) {
      // Convert kebab-case to camelCase for easier access
      const key = type.replace(/-prompts$/, '').replace(/-(.)/g, (_, char) => char.toUpperCase())
      prompts[key] = data
    }
  }
  
  return prompts
}

// Helper functions to get specific prompts with fallbacks
export async function getGameStylePrompt(style = 'generic') {
  const prompts = await loadPromptFile('game-style-prompts')
  if (!prompts) return 'low-poly 3D game asset style' // Fallback
  
  // Check custom first, then default
  const customPrompt = prompts.custom?.[style]
  if (customPrompt) return customPrompt.base || customPrompt
  
  const defaultPrompt = prompts.default?.[style]
  if (defaultPrompt) return defaultPrompt.base || defaultPrompt
  
  // Ultimate fallback
  return prompts.default?.generic?.base || 'low-poly 3D game asset style'
}

export async function getAssetTypePrompt(assetType) {
  const prompts = await loadPromptFile('asset-type-prompts')
  if (!prompts) return '' // Fallback
  
  // Check custom first, then default
  const customPrompt = prompts.custom?.[assetType]
  if (customPrompt) return customPrompt.prompt || ''
  
  const defaultPrompt = prompts.default?.[assetType]
  if (defaultPrompt) return defaultPrompt.prompt || ''
  
  return ''
}

export async function getMaterialPromptTemplate(gameStyle = 'generic') {
  const prompts = await loadPromptFile('material-prompts')
  if (!prompts) {
    // Fallback templates
    return gameStyle === 'runescape' 
      ? '${materialId} texture, low-poly RuneScape style'
      : '${materialId} texture'
  }
  
  return prompts.templates?.[gameStyle] || prompts.templates?.generic || '${materialId} texture'
}

export async function getGenerationPrompts() {
  const prompts = await loadPromptFile('generation-prompts')
  if (!prompts) {
    // Fallback prompts
    return {
      imageGeneration: {
        base: '${description}. ${style || "Low-poly game asset"} style, ${assetType}, clean geometry suitable for 3D conversion.',
        fallbackEnhancement: '${config.description}. ${config.style || "Low-poly RuneScape 2007"} style, clean geometry, game-ready 3D asset.'
      },
      posePrompts: {
        avatar: {
          tpose: 'standing in T-pose with arms stretched out horizontally'
        },
        armor: {
          chest: 'floating chest armor SHAPED FOR T-POSE BODY...',
          generic: 'floating armor piece shaped for T-pose body fitting...'
        }
      }
    }
  }
  
  return prompts
}

export async function getGPT4EnhancementPrompts() {
  const prompts = await loadPromptFile('gpt4-enhancement-prompts')
  return prompts || {} // Return empty object if not found
}

export async function getWeaponDetectionPrompts() {
  const prompts = await loadPromptFile('weapon-detection-prompts')
  return prompts || {} // Return empty object if not found
}

// Clear cache function for development
export function clearPromptCache() {
  promptCache.clear()
}