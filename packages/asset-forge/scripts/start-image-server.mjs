#!/usr/bin/env node

/**
 * Start Image Server
 * Serves images from temp-images directory for Meshy AI to access
 * Also serves 3D models and assets, with blob storage support
 */

import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { blobAssetResolver } from '../server/services/BlobAssetResolver.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')
const SERVER_ASSETS_REPO = path.join(ROOT_DIR, '../server/.assets-repo/models')

const app = express()
const PORT = process.env.IMAGE_SERVER_PORT || 8081
const USE_BLOB_STORAGE = process.env.USE_BLOB_STORAGE === 'true'

// CORS middleware - allow requests from frontend
app.use((req, res, next) => {
  const origin = req.headers.origin || 'http://localhost:3000'
  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})

// Ensure temp-images directory exists
await fs.mkdir(path.join(ROOT_DIR, 'temp-images'), { recursive: true })

// Initialize blob resolver if using blob storage
if (USE_BLOB_STORAGE) {
  try {
    await blobAssetResolver.loadMigrationData()
    console.log('✓ Blob storage initialized - will redirect model requests to Vercel Blob')
  } catch (error) {
    console.error('❌ Failed to initialize blob storage:', error.message)
    console.error('   Falling back to filesystem serving')
  }
}

// Middleware to handle blob storage redirects for models
app.use('/models', async (req, res, next) => {
  if (!USE_BLOB_STORAGE) {
    return next()
  }

  try {
    // Extract model path from request
    // Example: /models/sword-bronze/sword-bronze.glb
    const requestPath = req.path.substring(1) // Remove leading slash

    // Try to resolve from blob storage
    const blobUrl = await blobAssetResolver.resolveAssetUrl(`asset://models/${requestPath}`)

    // Redirect to blob URL
    console.log(`[CDN] Redirecting /models/${requestPath} → ${blobUrl}`)
    return res.redirect(blobUrl)
  } catch (error) {
    // If not found in blob storage, fall through to filesystem
    console.log(`[CDN] Not in blob storage: /models${req.path}, trying filesystem...`)
    next()
  }
})

// Serve gdd-assets directory (for voice files, sprites, etc.)
app.use('/gdd-assets', express.static(path.join(ROOT_DIR, 'gdd-assets')))

// Serve models from filesystem (fallback when blob storage disabled or file not in blob)
// 1. Check gdd-assets first (newly generated assets)
app.use('/models', express.static(path.join(ROOT_DIR, 'gdd-assets')))
// 2. Fall back to server assets repo (pre-existing game assets)
app.use('/models', express.static(SERVER_ASSETS_REPO))

// Serve images from temp-images directory (root level for backwards compat)
app.use(express.static(path.join(ROOT_DIR, 'temp-images')))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Image server is running' })
})

// List available images
app.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(path.join(ROOT_DIR, 'temp-images'))
    const images = files.filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    res.json({ images })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`🖼️  Image server running on http://localhost:${PORT}`)
  console.log(`📁 Serving images from: ${path.join(ROOT_DIR, 'temp-images')}`)
  console.log(`📁 Serving gdd-assets from: ${path.join(ROOT_DIR, 'gdd-assets')}`)
  console.log(`🔍 Health check: http://localhost:${PORT}/health`)
  console.log(`📋 List images: http://localhost:${PORT}/list`)

  if (USE_BLOB_STORAGE) {
    console.log(`☁️  Blob storage ENABLED - /models requests will redirect to Vercel Blob`)
  } else {
    console.log(`💾 Blob storage DISABLED - serving models from filesystem`)
    console.log(`📁 Models: ${path.join(ROOT_DIR, 'gdd-assets')}`)
    console.log(`📁 Server assets: ${SERVER_ASSETS_REPO}`)
  }
}) 