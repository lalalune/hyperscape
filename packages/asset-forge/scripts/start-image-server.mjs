#!/usr/bin/env node

/**
 * Start Image Server
 * Serves images from temp-images directory for Meshy AI to access
 */

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

const app = express()
const PORT = process.env.IMAGE_SERVER_PORT || 8088

// Ensure temp-images directory exists
await fs.mkdir(path.join(ROOT_DIR, 'temp-images'), { recursive: true })

// Serve images from temp-images directory
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

const server = app.listen(PORT, () => {
  console.log(`🖼️  Image server running on http://localhost:${PORT}`)
  console.log(`📁 Serving images from: ${path.join(ROOT_DIR, 'temp-images')}`)
  console.log(`🔍 Health check: http://localhost:${PORT}/health`)
  console.log(`📋 List images: http://localhost:${PORT}/list`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`✅ Image server already running on port ${PORT}`)
    process.exit(0)
  }
  console.error('❌ Failed to start image server:', err)
  process.exit(1)
}) 