/**
 * Interactive Viewer Server
 * Web-based interface for viewing and managing generations
 */

import express from 'express'
import { WebSocketServer } from 'ws'
import * as path from 'path'
import { AICreationService, defaultConfig } from '../src'

export function startViewer(port: number = 3000) {
  const app = express()
  const server = app.listen(port)
  
  // Create WebSocket server for real-time updates
  const wss = new WebSocketServer({ server })
  
  // Initialize AI service
  const service = new AICreationService(defaultConfig)
  
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
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection')
    
    ws.on('message', (message) => {
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
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message)
      }
    })
  }
  
  console.log(`Viewer server running on http://localhost:${port}`)
} 