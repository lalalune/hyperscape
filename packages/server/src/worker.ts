/**
 * Cloudflare Worker - Routes requests to game server container
 * 
 * This edge layer handles:
 * - WebSocket → Game server container (auto-scaled 1-5 instances)
 * - API routes → Game server container
 * - Assets → R2 CDN (bypasses container completely!)
 * - Load balancing across container instances
 */

import { Container, getRandom } from '@cloudflare/containers'

// Cloudflare Worker types
type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

type DurableObjectId = {
  toString(): string
  equals(other: DurableObjectId): boolean
}

type DurableObjectStub = {
  fetch(request: Request): Promise<Response>
}

type R2Bucket = {
  get(key: string): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | string): Promise<void>
  delete(key: string): Promise<void>
}

type R2Object = {
  body: ReadableStream
  size: number
  httpMetadata?: Record<string, string>
}

type D1Database = {
  prepare(query: string): D1PreparedStatement
}

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement
  all(): Promise<{ results: unknown[] }>
  first(): Promise<unknown>
  run(): Promise<void>
}

type KVNamespace = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

interface Env {
  GAME_SERVER: DurableObjectNamespace
  ASSETS: R2Bucket
  UPLOADS: R2Bucket
  DB?: D1Database
  SESSIONS?: KVNamespace
  LIVEKIT_API_KEY: string
  LIVEKIT_API_SECRET: string
  PRIVY_APP_SECRET: string
  DATABASE_URL: string
  PUBLIC_CDN_URL: string
}

// GameServer container class
// This tells Cloudflare how to run your Docker container
class GameServer extends Container {
  defaultPort = 8080  // Your server listens on 8080 inside the container
  sleepAfter = '30m'  // Sleep container after 30 minutes of inactivity (saves money!)
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    
    // ===== HEALTH CHECK (Edge level) =====
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        layer: 'cloudflare-edge',
        timestamp: new Date().toISOString(),
        region: request.cf?.colo || 'unknown'
      })
    }
    
    // ===== WEBSOCKET → Game Server Container =====
    if (url.pathname === '/ws') {
      // Get a container instance (Cloudflare auto-balances load)
      // Using getRandom for now - Cloudflare will add smarter routing soon
      const MAX_INSTANCES = 5
      const container = await getRandom(env.GAME_SERVER, MAX_INSTANCES)
      
      // Forward WebSocket upgrade to container
      return container.fetch(request)
    }
    
    // ===== API ROUTES → Game Server Container =====
    if (url.pathname.startsWith('/api/')) {
      const container = await getRandom(env.GAME_SERVER, 5)
      return container.fetch(request)
    }
    
    // ===== STATIC ASSETS → R2 CDN (Bypass container!) =====
    if (url.pathname.startsWith('/world-assets/')) {
      const assetPath = url.pathname.replace('/world-assets/', '')
      
      // Fetch from R2
      const object = await env.ASSETS.get(assetPath)
      
      if (!object) {
        return Response.json(
          { error: 'Asset not found', path: assetPath },
          { status: 404 }
        )
      }
      
      // Determine content type from extension
      let contentType = 'application/octet-stream'
      const ext = assetPath.split('.').pop()?.toLowerCase()
      
      switch (ext) {
        case 'mp3': contentType = 'audio/mpeg'; break
        case 'ogg': contentType = 'audio/ogg'; break
        case 'wav': contentType = 'audio/wav'; break
        case 'glb': contentType = 'model/gltf-binary'; break
        case 'gltf': contentType = 'model/gltf+json'; break
        case 'json': contentType = 'application/json'; break
        case 'png': contentType = 'image/png'; break
        case 'jpg':
        case 'jpeg': contentType = 'image/jpeg'; break
        case 'webp': contentType = 'image/webp'; break
        case 'vrm': contentType = 'model/vrm'; break
        default: contentType = 'application/octet-stream'
      }
      
      const headers = new Headers()
      headers.set('Content-Type', contentType)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      headers.set('Accept-Ranges', 'bytes')
      
      // Handle range requests for audio/video streaming
      const range = request.headers.get('Range')
      if (range) {
        const size = object.size
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0]!, 10)
        const end = parts[1] ? parseInt(parts[1], 10) : size - 1
        
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
        headers.set('Content-Length', String(end - start + 1))
        
        return new Response(object.body, {
          status: 206,
          headers
        })
      }
      
      headers.set('Content-Length', String(object.size))
      
      return new Response(object.body, { headers })
    }
    
    // ===== CORS Preflight =====
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      })
    }
    
    // ===== EVERYTHING ELSE → Container =====
    // This includes: /, /env.js, /upload, etc.
    const container = await getRandom(env.GAME_SERVER, 5)
    return container.fetch(request)
  }
}

// Export the container class
export { GameServer }
