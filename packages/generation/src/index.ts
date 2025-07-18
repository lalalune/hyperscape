/**
 * AI Creation System
 * Complete asset generation pipeline for Hyperscape RPG
 */

// Export core service
export { AICreationService } from './core/AICreationService'

// Export types
export * from './types'

// Export individual services for advanced usage
export { ImageGenerationService } from './services/ImageGenerationService'
export { MeshyService } from './services/MeshyService'
export { ModelAnalysisService } from './services/ModelAnalysisService'
export { CacheService } from './services/CacheService'

// Export utilities
export * from './utils/helpers'

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
    directory: './output',
    format: 'glb' as const
  }
} 