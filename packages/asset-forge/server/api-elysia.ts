/**
 * Elysia API Server
 * Modern Bun-native backend for AI-powered 3D asset generation
 *
 * Migration from Express to Elysia for:
 * - 22x better performance (2.4M req/s vs 113K req/s)
 * - Native Bun file handling
 * - End-to-end type safety
 * - Built-in file upload support
 */

import 'dotenv/config'
import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { serverTiming } from '@elysiajs/server-timing'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Services
import { AssetService } from './services/AssetService'
import { RetextureService } from './services/RetextureService'
import { GenerationService } from './services/GenerationService'

// Middleware
import { errorHandler } from './middleware/errorHandler'
import { loggingMiddleware } from './middleware/logging'
import { authMiddleware } from './middleware/auth'

// Routes
import { healthRoutes } from './routes/health'
import { createMaterialRoutes } from './routes/materials'
import { createRetextureRoutes } from './routes/retexture'
import { createGenerationRoutes } from './routes/generation'
import { aiVisionRoutes } from './routes/ai-vision'
import { createAssetRoutes } from './routes/assets'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Ensure temp-images directory exists
await fs.promises.mkdir(path.join(ROOT_DIR, 'temp-images'), { recursive: true })

// Initialize services
const API_PORT = process.env.API_PORT || 3004
const assetService = new AssetService(path.join(ROOT_DIR, 'gdd-assets'))
const retextureService = new RetextureService({
  meshyApiKey: process.env.MESHY_API_KEY || '',
  imageServerBaseUrl: process.env.IMAGE_SERVER_URL || `http://localhost:${API_PORT}`
})
const generationService = new GenerationService()

// Create Elysia app
const app = new Elysia()
  // Performance monitoring
  .use(serverTiming())

  // Swagger API documentation
  .use(swagger({
    documentation: {
      info: {
        title: '3D Asset Forge API',
        version: '1.0.0',
        description: 'AI-powered 3D asset generation and management system'
      },
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Assets', description: 'Asset management endpoints' },
        { name: 'Material Presets', description: 'Material preset management' },
        { name: 'Retexturing', description: 'Asset retexturing and regeneration' },
        { name: 'Generation', description: 'AI-powered asset generation pipeline' },
        { name: 'Sprites', description: 'Sprite generation and management' },
        { name: 'VRM', description: 'VRM file upload and processing' },
        { name: 'AI Vision', description: 'GPT-4 Vision-powered weapon detection' }
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Privy access token (optional - some endpoints work without auth)'
          }
        }
      }
    }
  }))

  // CORS configuration
  .use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || '*'
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
  }))

  // Middleware
  .use(errorHandler)
  .use(loggingMiddleware)
  .use(authMiddleware)

  // Static file serving - generated assets
  .use(staticPlugin({
    assets: path.join(ROOT_DIR, 'gdd-assets'),
    prefix: '/gdd-assets'
  }))

  // Static file serving - temp images for Meshy AI
  .use(staticPlugin({
    assets: path.join(ROOT_DIR, 'temp-images'),
    prefix: '/temp-images'
  }))

  // Routes
  .use(healthRoutes)
  .use(aiVisionRoutes)
  .use(createAssetRoutes(ROOT_DIR, assetService))
  .use(createMaterialRoutes(ROOT_DIR))
  .use(createRetextureRoutes(ROOT_DIR, retextureService))
  .use(createGenerationRoutes(generationService))

  // Start server
  .listen(API_PORT)

console.log(`🚀 Elysia API Server running on http://localhost:${API_PORT}`)
console.log(`📊 Health check: http://localhost:${API_PORT}/api/health`)
console.log(`🖼️  Temp images: http://localhost:${API_PORT}/temp-images/`)
console.log(`✨ Performance: 22x faster than Express!`)

if (!process.env.MESHY_API_KEY) {
  console.warn('⚠️  MESHY_API_KEY not found - retexturing will fail')
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not found - base regeneration will fail')
}

export type App = typeof app
