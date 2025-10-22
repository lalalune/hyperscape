/**
 * Minimal test server for voice manifest endpoints
 */

import 'dotenv/config'
import express from 'express'
import { ManifestVoiceService } from './server/services/ManifestVoiceService.mjs'
import {
  POST_assign,
  GET_assignment,
  GET_bulk,
  DELETE_assignment,
  POST_bulkAssign,
  POST_generateSample
} from './server/routes/voice-manifest.mjs'

const app = express()
const PORT = 3005

// Middleware
app.use(express.json({ limit: '25mb' }))

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/voice/manifest/assign',
      'GET /api/voice/manifest/:manifestType/:entityId',
      'GET /api/voice/manifest/bulk',
      'DELETE /api/voice/manifest/:manifestType/:entityId',
      'POST /api/voice/manifest/bulk-assign',
      'POST /api/voice/manifest/generate-sample'
    ]
  })
})

// Voice manifest routes
app.post('/api/voice/manifest/assign', (req, res) => {
  POST_assign(req, res)
})

app.get('/api/voice/manifest/bulk', (req, res) => {
  GET_bulk(req, res)
})

app.get('/api/voice/manifest/:manifestType/:entityId', (req, res) => {
  GET_assignment(req, res)
})

app.delete('/api/voice/manifest/:manifestType/:entityId', (req, res) => {
  DELETE_assignment(req, res)
})

app.post('/api/voice/manifest/bulk-assign', (req, res) => {
  POST_bulkAssign(req, res)
})

app.post('/api/voice/manifest/generate-sample', (req, res) => {
  POST_generateSample(req, res)
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    error: err.message || 'Internal server error'
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Test Server running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
  console.log(`\nVoice Manifest Endpoints:`)
  console.log(`  POST   /api/voice/manifest/assign`)
  console.log(`  GET    /api/voice/manifest/:manifestType/:entityId`)
  console.log(`  GET    /api/voice/manifest/bulk?manifestType=npcs`)
  console.log(`  DELETE /api/voice/manifest/:manifestType/:entityId`)
  console.log(`  POST   /api/voice/manifest/bulk-assign`)
  console.log(`  POST   /api/voice/manifest/generate-sample`)
  console.log(`\nRun tests with: API_URL=http://localhost:${PORT} node test-voice-manifest-api.mjs\n`)
})
