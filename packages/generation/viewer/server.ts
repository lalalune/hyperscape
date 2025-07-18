/**
 * Interactive Viewer Server
 * Web-based interface for viewing and managing generations
 */

import express from 'express'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import * as path from 'path'
import * as fs from 'fs/promises'
import { AICreationService, defaultConfig } from '../src'
import { AssetValidator, ValidationTestRunner, HumanReviewGenerator } from '../src/utils/validation'

export function startViewer(port: number = 3000) {
  const app = express()
  const server = app.listen(port)
  
  // Create WebSocket server for real-time updates
  const wss = new WebSocketServer({ server })
  
  // Initialize AI service and validation
  const service = new AICreationService(defaultConfig)
  const validator = new AssetValidator()
  const testRunner = new ValidationTestRunner()
  const reviewGenerator = new HumanReviewGenerator()
  
  // Static files
  app.use(express.static(path.join(__dirname, 'public')))
  app.use(express.json())
  
  // API endpoints
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'active',
      activeGenerations: service.getActiveGenerations()
    })
  })
  
  app.post('/api/generate', async (req, res) => {
    try {
      const request = req.body
      
      // Send updates via WebSocket
      service.on('stage-start', (data) => {
        broadcast({ type: 'stage-start', data })
      })
      
      service.on('stage-complete', (data) => {
        broadcast({ type: 'stage-complete', data })
      })
      
      service.on('error', (data) => {
        broadcast({ type: 'error', data })
      })
      
      const result = await service.generate(request)
      res.json(result)
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  app.get('/api/generation/:id', async (req, res) => {
    try {
      const result = await service.getGeneration(req.params.id)
      if (!result) {
        res.status(404).json({ error: 'Generation not found' })
      } else {
        res.json(result)
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  app.post('/api/regenerate/:id/:stage', async (req, res) => {
    try {
      const result = await service.regenerateStage(
        req.params.id,
        req.params.stage as any
      )
      res.json(result)
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  // Validation endpoints
  app.post('/api/validate/:id', async (req, res) => {
    try {
      const result = await service.getGeneration(req.params.id)
      if (!result) {
        res.status(404).json({ error: 'Generation not found' })
        return
      }
      
      const validation = await validator.validateGeneration(result)
      res.json(validation)
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  app.get('/api/review/:id', async (req, res) => {
    try {
      const result = await service.getGeneration(req.params.id)
      if (!result) {
        res.status(404).json({ error: 'Generation not found' })
        return
      }
      
      const checklist = reviewGenerator.generateChecklist(result)
      const questions = reviewGenerator.generateReviewQuestions(result)
      
      res.json({
        checklist,
        questions,
        assetType: result.request.type,
        assetName: result.request.name
      })
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  app.post('/api/batch/rpg', async (req, res) => {
    try {
      const batchType = req.body.type || 'complete'
      const batchPath = path.join(__dirname, `../demo-batches/rpg-${batchType}-batch.json`)
      
      // Load batch file
      const batchContent = await fs.readFile(batchPath, 'utf-8')
      const items = JSON.parse(batchContent)
      
      // Convert to generation requests
      const requests = items.map((item: any, index: number) => ({
        id: `rpg-${batchType}-${index}`,
        name: item.name,
        description: item.description,
        type: item.type,
        subtype: item.subtype,
        style: item.style || 'realistic',
        metadata: item.metadata
      }))
      
      // Start batch generation
      const results = await service.batchGenerate(requests)
      res.json({ total: items.length, results })
      
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  app.post('/api/test/validation', async (req, res) => {
    try {
      const testResults = await testRunner.runAllTests(
        (request) => service.generate(request)
      )
      res.json(testResults)
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  app.get('/api/batches', async (req, res) => {
    try {
      const batchesDir = path.join(__dirname, '../demo-batches')
      const files = await fs.readdir(batchesDir)
      const rpgBatches = files
        .filter(f => f.startsWith('rpg-') && f.endsWith('.json'))
        .map(f => ({
          name: f.replace('rpg-', '').replace('-batch.json', ''),
          file: f,
          description: `RPG ${f.replace('rpg-', '').replace('-batch.json', '')} generation batch`
        }))
      
      res.json(rpgBatches)
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  })
  
  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection')
    
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString())
        console.log('Received:', data)
      } catch (error) {
        console.error('Invalid WebSocket message:', error)
      }
    })
  })
  
  // Broadcast to all connected clients
  function broadcast(data: any) {
    const message = JSON.stringify(data)
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message)
      }
    })
  }
  
  console.log(`Viewer server running on http://localhost:${port}`)
} 