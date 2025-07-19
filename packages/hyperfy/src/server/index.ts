import 'ses'
import '../core/lockdown'
import './bootstrap'

import compress from '@fastify/compress'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import statics from '@fastify/static'
import ws from '@fastify/websocket'
import dotenv from 'dotenv'
import Fastify from 'fastify'
import fs from 'fs-extra'
import path from 'path'

dotenv.config()

import { createServerWorld } from '../core/createServerWorld'
import { hashFile } from '../core/utils-server'
import { initCollections } from './collections'
import { getDB } from './db'
import { Storage } from './Storage'

// Set default values for required environment variables
const WORLD = process.env['WORLD'] || 'world'
const PORT = parseInt(process.env['PORT'] || '3000', 10)

const rootDir = path.join(__dirname, '../')
const worldDir = path.join(rootDir, WORLD)
const assetsDir = path.join(worldDir, '/assets')
const collectionsDir = path.join(worldDir, '/collections')

// Log configuration
console.log('[Hyperfy] Starting server with configuration:')
console.log(`  WORLD: ${WORLD}`)
console.log(`  PORT: ${PORT}`)
console.log(`  Root dir: ${rootDir}`)
console.log(`  World dir: ${worldDir}`)

// create world folders if needed
await fs.ensureDir(worldDir)
await fs.ensureDir(assetsDir)
await fs.ensureDir(collectionsDir)

// copy over built-in assets and collections
await fs.copy(path.join(rootDir, 'src/world/assets'), path.join(assetsDir))
await fs.copy(path.join(rootDir, 'src/world/collections'), path.join(collectionsDir))

// init collections
const collections = await initCollections({ collectionsDir, assetsDir })
console.log('[Server] Collections returned from initCollections:', collections?.length || 'undefined')

// init db
const db = await getDB(path.join(worldDir, '/db.sqlite'))

// init storage
const storage = new Storage(path.join(worldDir, '/storage.json'))

const world = createServerWorld()
console.log('[Server] Created server world, collections still:', collections?.length || 'undefined')
world.assetsUrl = process.env['PUBLIC_ASSETS_URL'] || '/assets/'
  
// Ensure assetsUrl ends with slash for proper URL resolution
if (!world.assetsUrl.endsWith('/')) {
  world.assetsUrl += '/'
}
  
// Set up default environment if no settings exist
if (!(world.settings as any).model) {
  // Set default environment model in settings for ServerEnvironment system
  ;(world.settings as any).model = {
    url: 'asset://base-environment.glb'
  }
}

// Also configure for client preloading
if (!(world as any).environment?.base) {
  (world as any).environment = {
    base: {
      model: 'asset://base-environment.glb'
    }
  }
}

console.log('[Server] About to deserialize collections:', collections?.length || 'undefined', typeof collections)
try {
  ;(world.collections as any).deserialize(collections)
  console.log('[Server] Collections after deserialize:', (world.collections as any).serialize()?.length || 'undefined')
} catch (error) {
  console.error('[Server] Error during collections deserialize:', error)
}
;(world as any).init({ db, storage, assetsDir, collectionsDir })

const fastify = Fastify({ logger: { level: 'error' } })

fastify.register(cors)
fastify.register(compress)
fastify.get('/', async (_req: any, reply: any) => {
  const title = (world.settings as any).title || 'World'
  const desc = (world.settings as any).desc || ''
  const image = world.resolveURL((world.settings as any).image?.url) || ''
  const url = process.env['PUBLIC_ASSETS_URL']
  const filePath = path.join(__dirname, 'public', 'index.html')
  let html = fs.readFileSync(filePath, 'utf-8')
  html = html.replace(/\{url\}/g, url || '')
  html = html.replace(/\{title\}/g, title)
  html = html.replace(/\{desc\}/g, desc)
  html = html.replace(/\{image\}/g, image)
  reply.type('text/html').send(html)
})
fastify.register(statics, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
  decorateReply: false,
  setHeaders: res => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  },
})
fastify.register(statics, {
  root: assetsDir,
  prefix: '/assets/',
  decorateReply: false,
  setHeaders: res => {
    // all assets are hashed & immutable so we can use aggressive caching
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // older browsers
  },
})
fastify.register(statics, {
  root: collectionsDir,
  prefix: '/collections/',
  decorateReply: false,
  setHeaders: res => {
    // collections scripts can be cached but not as aggressively as assets
    res.setHeader('Cache-Control', 'public, max-age=300') // 5 minutes
    res.setHeader('Pragma', 'no-cache')
  },
})
fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
})
fastify.register(ws)

// Define worldNetwork function BEFORE registration
async function worldNetwork(fastify: any) {
  fastify.get('/ws', { websocket: true }, (ws: any, req: any) => {
    ;(world as any).network.onConnection(ws, req.query)
  })
}

fastify.register(worldNetwork)

const publicEnvs: Record<string, string> = {}
for (const key in process.env) {
  if (key.startsWith('PUBLIC_')) {
    const value = process.env[key]
    if (value) {
      publicEnvs[key] = value
    }
  }
}
const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`
fastify.get('/env.js', async (_req, reply) => {
  reply.type('application/javascript').send(envsCode)
})

fastify.post('/api/upload', async (req, _reply) => {
  // console.log('DEBUG: slow uploads')
  // await new Promise(resolve => setTimeout(resolve, 2000))
  const file = await req.file()
  if (!file) {
    throw new Error('No file uploaded')
  }
  const ext = file.filename.split('.').pop()?.toLowerCase()
  if (!ext) {
    throw new Error('Invalid filename')
  }
  // create temp buffer to store contents
  const chunks: Buffer[] = []
  for await (const chunk of file.file) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  // hash from buffer
  const hash = await hashFile(buffer)
  const filename = `${hash}.${ext}`
  // save to fs
  const filePath = path.join(assetsDir, filename)
  const exists = await fs.exists(filePath)
  if (!exists) {
    await fs.writeFile(filePath, buffer)
  }
})

fastify.get('/api/upload-check', async (req: any, _reply) => {
  const filename = req.query.filename as string
  const filePath = path.join(assetsDir, filename)
  const exists = await fs.exists(filePath)
  return { exists }
})

fastify.get('/health', async (_request, reply) => {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }

    return reply.code(200).send(health)
  } catch (error) {
    console.error('Health check failed:', error)
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

fastify.get('/status', async (_request, reply) => {
  try {
    const status = {
      uptime: Math.round(world.time),
      protected: process.env['ADMIN_CODE'] !== undefined ? true : false,
      connectedUsers: [] as Array<{
        id: any;
        position: any;
        name: any;
      }>,
      commitHash: process.env['COMMIT_HASH'],
    }
    for (const socket of (world as any).network.sockets.values()) {
      status.connectedUsers.push({
        id: socket.player.data.userId,
        position: socket.player.position.current.toArray(),
        name: socket.player.data.name,
      })
    }

    return reply.code(200).send(status)
  } catch (error) {
    console.error('Status failed:', error)
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

// Action API endpoints
fastify.get('/api/actions', async (request, reply) => {
  try {
    const actions = (world as any).actionRegistry.getAll();
    return reply.send({
      success: true,
      actions: actions.map((action: any) => ({
        name: action.name,
        description: action.description,
        parameters: action.parameters
      }))
    });
  } catch (error) {
    return reply.code(500).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

fastify.get('/api/actions/available', async (request, reply) => {
  try {
    const query = request.query as any;
    const context = {
      world,
      playerId: query?.playerId,
      ...query
    };
    const actions = (world as any).actionRegistry.getAvailable(context);
    return reply.send({
      success: true,
      actions: actions.map((action: any) => action.name)
    });
  } catch (error) {
    return reply.code(500).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

fastify.post('/api/actions/:name', async (request, reply) => {
  try {
    const actionName = (request.params as any).name;
    const params = request.body || {};
    const query = request.query as any;
    const context = {
      world,
      playerId: query?.playerId,
      ...query
    };
    
    const result = await (world as any).actionRegistry.execute(actionName, context, params);
    return reply.send({
      success: true,
      result
    });
  } catch (error) {
    return reply.code(400).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Action execution failed' 
    });
  }
});

// State query endpoints
fastify.get('/api/state/:query', async (request, reply) => {
  try {
    const queryName = (request.params as any).query;
    const query = request.query as any;
    const context = {
      world,
      playerId: query?.playerId,
      ...query
    };
    
    const result = world.queryState(queryName, context);
    return reply.send({
      success: true,
      result
    });
  } catch (error) {
    return reply.code(404).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Query not found' 
    });
  }
});

fastify.get('/api/state', async (request, reply) => {
  try {
    const queries = world.getAllStateQueries();
    return reply.send({
      success: true,
      queries: queries.map((q: any) => ({
        name: q.name,
        description: q.description
      }))
    });
  } catch (error) {
    return reply.code(500).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Plugin management endpoints
fastify.get('/api/plugins', async (request, reply) => {
  try {
    const plugins = world.getLoadedPlugins();
    return reply.send({
      success: true,
      plugins: plugins.map((p: any) => ({
        name: p.name,
        version: p.version
      }))
    });
  } catch (error) {
    return reply.code(500).send({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Visual testing endpoints
fastify.get('/test-empty', async (_req, reply) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Empty World Test</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(to bottom, #87CEEB, #98FB98);
      overflow: hidden;
    }
  </style>
</head>
<body>
  <!-- Empty world with gradient background -->
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

fastify.get('/test-single-entity', async (_req, reply) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Single Entity Test</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: #87CEEB;
      overflow: hidden;
      position: relative;
    }
    .entity {
      position: absolute;
      width: 50px;
      height: 50px;
      border-radius: 4px;
    }
    .player {
      background-color: #0000FF;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  </style>
</head>
<body>
  <div class="entity player" data-type="PLAYER"></div>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

fastify.get('/test-multi-entity', async (_req, reply) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Multi Entity Test</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: #87CEEB;
      overflow: hidden;
      position: relative;
    }
    .entity {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 4px;
    }
    .player {
      background-color: #0000FF;
    }
    .goblin {
      background-color: #00FF00;
    }
    .tree {
      background-color: #228B22;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="entity player" data-type="PLAYER" style="top: 45%; left: 45%;"></div>
  <div class="entity goblin" data-type="GOBLIN" style="top: 30%; left: 60%;"></div>
  <div class="entity goblin" data-type="GOBLIN" style="top: 70%; left: 30%;"></div>
  <div class="entity tree" data-type="TREE" style="top: 20%; left: 20%;"></div>
  <div class="entity tree" data-type="TREE" style="top: 80%; left: 80%;"></div>
  <div class="entity tree" data-type="TREE" style="top: 60%; left: 15%;"></div>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

fastify.get('/test-melee-combat', async (_req, reply) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Melee Combat Test</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: #87CEEB;
      overflow: hidden;
      position: relative;
    }
    .entity {
      position: absolute;
      width: 45px;
      height: 45px;
      border-radius: 4px;
    }
    .player {
      background-color: #0000FF;
    }
    .goblin {
      background-color: #00FF00;
    }
    .combat-effect {
      position: absolute;
      width: 20px;
      height: 20px;
      background-color: #FF6B6B;
      border-radius: 50%;
      animation: flash 0.5s ease-in-out infinite alternate;
    }
    @keyframes flash {
      from { opacity: 0.3; }
      to { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="entity player" data-type="PLAYER" style="top: 50%; left: 45%;"></div>
  <div class="entity goblin" data-type="GOBLIN" style="top: 50%; left: 55%;"></div>
  <div class="combat-effect" style="top: 50%; left: 50%;"></div>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

fastify.get('/test-ranged-combat', async (_req, reply) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Ranged Combat Test</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: #87CEEB;
      overflow: hidden;
      position: relative;
    }
    .entity {
      position: absolute;
      width: 45px;
      height: 45px;
      border-radius: 4px;
    }
    .player {
      background-color: #0000FF;
    }
    .goblin {
      background-color: #00FF00;
    }
    .arrow {
      position: absolute;
      width: 8px;
      height: 20px;
      background-color: #8B4513;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="entity player" data-type="PLAYER" style="top: 50%; left: 20%;"></div>
  <div class="entity goblin" data-type="GOBLIN" style="top: 50%; left: 75%;"></div>
  <div class="arrow" style="top: 50%; left: 50%; transform: rotate(90deg);"></div>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

fastify.get('/test-woodcutting', async (_req, reply) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Woodcutting Test</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: #87CEEB;
      overflow: hidden;
      position: relative;
    }
    .entity {
      position: absolute;
      border-radius: 4px;
    }
    .player {
      width: 45px;
      height: 45px;
      background-color: #0000FF;
    }
    .tree {
      width: 50px;
      height: 50px;
      background-color: #228B22;
      border-radius: 50%;
    }
    .tool {
      width: 25px;
      height: 25px;
      background-color: #8B4513;
    }
  </style>
</head>
<body>
  <div class="entity player" data-type="PLAYER" style="top: 50%; left: 40%;"></div>
  <div class="entity tree" data-type="TREE" style="top: 30%; left: 60%;"></div>
  <div class="entity tree" data-type="TREE" style="top: 70%; left: 65%;"></div>
  <div class="entity tree" data-type="TREE" style="top: 50%; left: 75%;"></div>
  <div class="entity tool" data-type="TOOL" style="top: 50%; left: 35%;"></div>
</body>
</html>
  `;
  reply.type('text/html').send(html);
});

fastify.setErrorHandler((err, _req, reply) => {
  console.error(err)
  reply.status(500).send()
})

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  console.error(err)
  console.error(`failed to launch on port ${PORT}`)
  process.exit(1)
}

console.log(`running on port ${PORT}`)

// Graceful shutdown
process.on('SIGINT', async () => {
  await fastify.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await fastify.close()
  process.exit(0)
})
