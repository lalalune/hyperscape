// Load environment variables
import 'dotenv/config'

/**
 * @fileoverview AI Creation System for Hyperscape RPG
 * Complete 3D asset generation pipeline with OpenAI and Meshy AI
 */

// Core services
export { AICreationService } from './core/AICreationService'
export { ImageGenerationService } from './services/ImageGenerationService'
export { MeshyService } from './services/MeshyService'
export { ModelAnalysisService } from './services/ModelAnalysisService'

// Generators
export { GDDAssetGenerator } from './generators/GDDAssetGenerator'

// Utilities
export { ProgressTracker } from './utils/ProgressTracker'
export { AssetPrompts } from './config/AssetPrompts'

// Types
export * from './types'

// Default export for convenience
export { AICreationService as default } from './core/AICreationService'

// Default configuration
export const defaultConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'dall-e-3'
  },
  meshy: {
    apiKey: process.env.MESHY_API_KEY || '',
    baseUrl: 'https://api.meshy.ai'
  },
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 500 // 500MB
  },
  output: {
    directory: './gdd-assets',
    format: 'glb' as const
  }
} 