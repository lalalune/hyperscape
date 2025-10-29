/**
 * Generation API Server (Hono)
 * Provides endpoints for AI-powered 3D asset generation
 * Migrated from Express to Hono for improved performance and multi-runtime support
 */

import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Route imports
import usersRoutes from './routes/users.mjs'
import promptRoutes from './routes/promptRoutes.mjs'
import multiAgentRoutes from './routes/multi-agent.mjs'
import npcCollaborationRoutes from './routes/generate-npc-collaboration.mjs'
import playtesterSwarmRoutes from './routes/generate-playtester-swarm.mjs'
import projectsRoutes from './routes/projects.mjs'
import teamsRoutes from './routes/teams.mjs'
import assetsRoutes from './routes/assets.mjs'
import adminRoutes from './routes/admin.mjs'
import adminLogsRoutes from './routes/admin-logs.mjs'
import modelsRoutes from './routes/models.mjs'
import aiGatewayRoutes from './routes/ai-gateway.mjs'
import apiKeysRoutes from './routes/api-keys.mjs'
import manifestsRoutes from './routes/manifests.mjs'
import previewManifestsRoutes from './routes/preview-manifests.mjs'
import submissionsRoutes from './routes/submissions.mjs'
import adminApprovalsRoutes from './routes/admin-approvals.mjs'
import aiContextRoutes from './routes/ai-context.mjs'
import embeddingsRoutes from './routes/embeddings.mjs'
import voiceAssignmentsRoutes from './routes/voice-assignments.mjs'
import questsRoutes from './routes/quests.mjs'
import contentGenerationRoutes from './routes/content-generation.mjs'
import voiceGenerationRoutes from './routes/voice-generation.mjs'
import soundEffectsRoutes from './routes/sound-effects.mjs'
import musicRoutes from './routes/music.mjs'
import legacyAssetsRoutes from './routes/legacy-assets.mjs'
import materialPresetsRoutes from './routes/material-presets.mjs'
import retexturingRoutes from './routes/retexturing.mjs'
import generationPipelineRoutes from './routes/generation-pipeline.mjs'
import weaponDetectionRoutes from './routes/weapon-detection.mjs'

// Initialize database connection
import './database/db.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Initialize Hono app
const app = new Hono()

// CORS middleware - Allow multiple origins for flexibility
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://forgery-smoky.vercel.app',
  'https://frontend-production-f53f.up.railway.app',
  process.env.FRONTEND_URL
].filter(Boolean).map(url => url.replace(/\/$/, '')) // Remove trailing slashes

const corsOrigin = (origin) => {
  // Allow requests with no origin (like mobile apps or curl)
  if (!origin) return '*'

  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return origin
  }

  // In development, allow all localhost origins
  if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
    return origin
  }

  // Default to first allowed origin
  return allowedOrigins[0] || '*'
}

console.log('[CORS] Allowed origins:', allowedOrigins)

app.use('*', cors({
  origin: corsOrigin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'x-user-id', 'x-wallet-address'],
  credentials: true,
  exposeHeaders: ['Cache-Control', 'Pragma', 'Expires']
}))

// Security headers middleware
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
})

// Request logging middleware
app.use('*', logger())

// Body size limit (25MB for base64 images)
// Hono handles this automatically, but we can add validation if needed
app.use('*', async (c, next) => {
  // Check content-length header
  const contentLength = c.req.header('content-length')
  if (contentLength && parseInt(contentLength) > 25 * 1024 * 1024) {
    return c.json({
      error: 'Payload too large',
      message: 'Request body must be less than 25MB'
    }, 413)
  }
  await next()
})

// Static file serving
// Serve assets from public/assets
app.use('/assets/*', serveStatic({
  root: path.join(ROOT_DIR, 'public'),
  onNotFound: (path, c) => {
    console.log(`[Static] Asset not found: ${path}`)
  }
}))

// Serve 3D models from monorepo assets directory
function getAssetsWorldPath() {
  // Environment variable takes precedence
  if (process.env.ASSETS_WORLD_PATH) {
    return process.env.ASSETS_WORLD_PATH
  }

  // Check if we're in Railway/Docker (assets at /app/assets)
  const railwayPath = '/app/assets/world'
  if (fs.existsSync(railwayPath)) {
    return railwayPath
  }

  // Local development - go up to workspace root, then into assets
  return path.resolve(ROOT_DIR, '../../assets/world')
}

const assetsWorldPath = getAssetsWorldPath()
const modelsPath = path.join(assetsWorldPath, 'models')
console.log(`[Models] Serving 3D models from: ${modelsPath}`)

app.use('/models/*', serveStatic({
  root: assetsWorldPath,
  onNotFound: (path, c) => {
    console.log(`[Models] Model not found: ${path}`)
  }
}))

// Serve temp images for Meshy.ai concept art
await fs.promises.mkdir(path.join(ROOT_DIR, 'temp-images'), { recursive: true })
app.use('/temp-images/*', serveStatic({
  root: ROOT_DIR,
  onNotFound: (path, c) => {
    console.log(`[Temp Images] Image not found: ${path}`)
  }
}))

// Server configuration
const apiPort = process.env.API_PORT || process.env.PORT || 3004

// Mount route modules
app.route('/api/users', usersRoutes)
app.route('/api', promptRoutes)
app.route('/api', multiAgentRoutes)
app.route('/api/generate-npc-collaboration', npcCollaborationRoutes)
app.route('/api/generate-playtester-swarm', playtesterSwarmRoutes)
app.route('/api/projects', projectsRoutes)
app.route('/api/teams', teamsRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/admin/logs', adminLogsRoutes)
app.route('/api/models', modelsRoutes)
app.route('/api/ai-gateway', aiGatewayRoutes)
app.route('/api/api-keys', apiKeysRoutes)
app.route('/api/manifests', manifestsRoutes)
app.route('/api/preview-manifests', previewManifestsRoutes)
app.route('/api/submissions', submissionsRoutes)
app.route('/api/admin/submissions', adminApprovalsRoutes)
app.route('/api/ai-context', aiContextRoutes)
app.route('/api/embeddings', embeddingsRoutes)
app.route('/api/voice-assignments', voiceAssignmentsRoutes)
app.route('/api/quests', questsRoutes)
app.route('/api', contentGenerationRoutes)
app.route('/api/voice', voiceGenerationRoutes)
app.route('/api/sfx', soundEffectsRoutes)
app.route('/api/music', musicRoutes)
app.route('/api/v2/assets', assetsRoutes)

// Legacy inline routes (migrated from Express backup)
app.route('/api/assets', legacyAssetsRoutes)
app.route('/api/material-presets', materialPresetsRoutes)
app.route('/api', retexturingRoutes)
app.route('/api/generation', generationPipelineRoutes)
app.route('/api', weaponDetectionRoutes)

console.log('[Server] ✓ All routes successfully mounted')
console.log('[Server] ✓ 33 route modules migrated to Hono (28 original + 5 legacy inline routes)')
console.log('[Server] Routes: users, prompts, multi-agent, npc-collaboration, playtester-swarm,')
console.log('[Server]         projects, teams, admin, models, ai-gateway, api-keys, manifests,')
console.log('[Server]         preview-manifests, submissions, admin-approvals, ai-context,')
console.log('[Server]         embeddings, voice-assignments, quests, content-generation,')
console.log('[Server]         voice-generation, sound-effects, music, assets, legacy-assets,')
console.log('[Server]         material-presets, retexturing, generation-pipeline, weapon-detection')

// Basic routes (health check and error logging)
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  })
})

app.post('/api/errors/frontend', async (c) => {
  try {
    const body = await c.req.json()
    const { error, stackTrace, userAgent, url, timestamp } = body

    console.error('[Frontend Error]', {
      error,
      stackTrace,
      userAgent,
      url,
      timestamp
    })

    return c.json({ success: true, message: 'Error logged' })
  } catch (error) {
    console.error('[Frontend Error Logging] Failed to log error:', error)
    return c.json({
      error: 'Failed to log error',
      message: error.message
    }, 500)
  }
})

// Error handler
app.onError((err, c) => {
  console.error('[Error Handler]', err)

  const isDevelopment = process.env.NODE_ENV !== 'production'

  return c.json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString()
  }, err.status || 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: `Route ${c.req.method} ${c.req.path} not found`,
    timestamp: new Date().toISOString()
  }, 404)
})

// Start server
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
console.log(`[Server] Starting Hono server on ${hostname}:${apiPort}...`)

serve({
  fetch: app.fetch,
  port: parseInt(apiPort),
  hostname: hostname
}, (info) => {
  console.log(`[Server] Hono server listening on http://${info.address}:${info.port}`)
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`[Server] Allowed origins:`, allowedOrigins)
})

export default app
