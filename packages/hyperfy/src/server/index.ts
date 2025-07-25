import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import statics from '@fastify/static'
import ws from '@fastify/websocket'
import dotenv from 'dotenv'
import Fastify from 'fastify'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

import { createServerWorld } from '../core/createServerWorld'
import { hashFile } from '../core/utils-server'
import { getDB } from './db'
import { Storage } from './Storage'

// Wrap server initialization in async function to avoid top-level await
async function startServer() {

  // Prevent duplicate server initialization
  if ((globalThis as any).__HYPERFY_SERVER_STARTING__) {
    console.log('[Server] Server already starting/started, skipping duplicate initialization');
    return; // Exit early instead of skipping the rest
  }
  
  (globalThis as any).__HYPERFY_SERVER_STARTING__ = true;


// Set default values for required environment variables
const WORLD = process.env['WORLD'] || 'world'
const PORT = parseInt(process.env['PORT'] || '3333', 10)

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '../..')
// Use absolute path if WORLD is absolute, otherwise relative to the hyperfy package root (not rootDir)
const worldDir = path.isAbsolute(WORLD) ? WORLD : path.join(__dirname, '../..', WORLD)
const assetsDir = path.join(worldDir, 'assets')
const collectionsDir = path.join(worldDir, 'collections')

// Log configuration
console.log('[Hyperfy] Starting server with configuration:')
console.log(`  WORLD: ${WORLD}`)
console.log(`  PORT: ${PORT}`)
console.log(`  RPG_SYSTEMS_PATH: ${process.env.RPG_SYSTEMS_PATH || 'none'}`)
console.log(`  PLUGIN_PATH: ${process.env.PLUGIN_PATH || 'none'}`)
console.log(`  Root dir: ${rootDir}`)
console.log(`  World dir: ${worldDir}`)

// create world folders if needed
await fs.ensureDir(worldDir)
await fs.ensureDir(assetsDir)
await fs.ensureDir(collectionsDir)

// copy over built-in assets and collections (only if they don't exist)
const hyperfyRoot = path.join(__dirname, '../..')  // From build/server to hyperfy root
const builtInAssetsDir = path.join(hyperfyRoot, 'src/world/assets')

// Only copy built-in assets if assets directory is empty
const assetFiles = await fs.readdir(assetsDir).catch(() => [])
if (assetFiles.length === 0 && await fs.exists(builtInAssetsDir)) {
  console.log('[Server] Assets directory empty, copying built-in assets...')
  await fs.copy(builtInAssetsDir, assetsDir)
} else {
  console.log(`[Server] Assets directory already has ${assetFiles.length} files, skipping copy`)
}

// init db
const db = await getDB(path.join(worldDir, '/db.sqlite'))

// init storage
const storage = new Storage(path.join(worldDir, '/storage.json'))

const world = await createServerWorld()

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

try {
  // ;(world.collections as any).deserialize(collections)
  console.log('[Server] Collections after deserialize:', (world.collections as any).serialize()?.length || 'undefined')
} catch (error) {
  console.error('[Server] Error during collections deserialize:', error)
}
;(world as any).init({ db, storage, assetsDir, collectionsDir })

// Entities spawn automatically from world.json if present
await loadWorldEntities()

// Auto-spawn entities from collections if no world.json
setTimeout(async () => {
  try {
    const worldEntityCount = (world as any).entities.getAll().filter((e: any) => e.data.type === 'app').length
    console.log('[AutoSpawn] Current app entities:', worldEntityCount)
    
    if (worldEntityCount === 0) {
      console.log('[AutoSpawn] No app entities found, auto-spawning from collections...')
      const collectionsData = (world.collections as any).serialize()
      console.log('[AutoSpawn] Processing collections:', collectionsData?.length || 0)
      
      if (collectionsData && collectionsData.length > 0) {
        let spawnedCount = 0
        collectionsData.forEach((collection: any, collectionIndex: number) => {
          if (collection.blueprints) {
            collection.blueprints.forEach((blueprint: any, blueprintIndex: number) => {
              // Spawn each blueprint at different positions  
              const x = (blueprintIndex * 5) - 10 // -10, -5, 0, 5, etc.
              const z = (collectionIndex * 5) - 5
              
              console.log(`[AutoSpawn] Spawning ${blueprint.name} at position [${x}, 0, ${z}]`)
              
              const entityData = {
                type: 'app',
                blueprint: blueprint.id,
                position: [x, 0, z],
                quaternion: [0, 0, 0, 1],
                props: blueprint.props || {}
              }
              
              const entity = (world as any).entities.add(entityData, true)
              console.log(`[AutoSpawn] Created entity: ${entity.data.id} (${blueprint.name})`)
              spawnedCount++
            })
          }
        })
        console.log(`[AutoSpawn] Successfully spawned ${spawnedCount} entities`)
      } else {
        console.log('[AutoSpawn] No collections data found')
      }
    } else {
      console.log('[AutoSpawn] App entities already exist, skipping auto-spawn')
    }
  } catch (error) {
    console.error('[AutoSpawn] Error during auto-spawn:', error)
  }
}, 3000) // Wait 3 seconds for world to fully initialize

async function loadWorldEntities() {
  const worldConfigPath = path.join(worldDir, 'world.json')
  
  try {
    if (await fs.exists(worldConfigPath)) {
      console.log('[Server] Loading entities from world.json...')
      const worldConfig = await fs.readJson(worldConfigPath)
      
      if (worldConfig.entities && Array.isArray(worldConfig.entities)) {
        console.log(`[Server] Found ${worldConfig.entities.length} entities to spawn`)
        
        for (const entityData of worldConfig.entities) {
          try {
            // Create complete entity data structure
            const entityToAdd = {
              id: entityData.id,
              type: entityData.type || 'app',
              position: entityData.position || [0, 0, 0],
              quaternion: entityData.quaternion || [0, 0, 0, 1], // Convert rotation to quaternion
              scale: entityData.scale || [1, 1, 1],
              ...entityData,
              state: {} // Initialize empty state
            }
            
            // Handle rotation field if present (convert to quaternion)
            if (entityData.rotation && !entityData.quaternion) {
              // For now, assume rotation is Euler angles in radians and convert to quaternion
              // This is a simplified conversion - for a more accurate conversion, use Three.js Euler.setFromVector3
              const [x, y, z] = entityData.rotation;
              // Create a basic quaternion from Y rotation (most common case)
              const halfY = y * 0.5;
              entityToAdd.quaternion = [0, Math.sin(halfY), 0, Math.cos(halfY)];
            }
            
            // Map appId to blueprint for App entities
            if (entityToAdd.type === 'app' && entityData.appId && !entityToAdd.blueprint) {
              entityToAdd.blueprint = entityData.appId
              console.log(`[Server] Mapped appId ${entityData.appId} to blueprint field`)
            }
            
            console.log(`[Server] Spawning entity: ${entityData.id} (${entityData.appId || entityData.type}) with blueprint: ${entityToAdd.blueprint || 'none'}`)
            ;(world as any).entities.add(entityToAdd, true)
          } catch (entityError) {
            console.error(`[Server] Failed to spawn entity ${entityData.id}:`, entityError)
          }
        }
        
        console.log('[Server] ✅ All world.json entities spawned successfully')
      } else {
        console.log('[Server] No entities array found in world.json')
      }
    } else {
      console.log('[Server] No world.json found, skipping entity spawning')
    }
  } catch (error) {
    console.error('[Server] Error loading world.json entities:', error)
  }
}


const fastify = Fastify({ logger: { level: 'error' } })

console.log('[Server] Created Fastify instance')

try {
  await fastify.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:7777',
      /^https?:\/\/localhost:\d+$/,
      true // Allow all origins in development
    ],
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS']
  })
  console.log('[Server] Registered CORS')
} catch (error) {
  console.error('[Server] Error registering CORS:', error)
  throw error
}

// TEMPORARILY DISABLE COMPRESSION FOR DEBUGGING
// try {
//   await fastify.register(compress)
//   console.log('[Server] Registered compress')
// } catch (error) {
//   console.error('[Server] Error registering compress:', error)
//   throw error
// }
fastify.get('/', async (_req: any, reply: any) => {
  try {
    const title = (world.settings as any).title || 'Hyperfy'
    const desc = (world.settings as any).desc || 'A virtual world platform'  
    const image = world.resolveURL((world.settings as any).image?.url) || ''
    const url = process.env['PUBLIC_ASSETS_URL']
    
    // In built version, __dirname points to build/, so public is at build/public
    const filePath = path.join(__dirname, 'public', 'index.html')
    const publicDir = path.join(__dirname, 'public')
    
    // Find the actual compiled JS and particles files
    const files = await fs.readdir(publicDir)
    const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'))
    const particlesFile = files.find(f => f.startsWith('particles-') && f.endsWith('.js'))
    
    if (!jsFile) {
      throw new Error('Client JS bundle not found')
    }
    if (!particlesFile) {
      throw new Error('Particles JS bundle not found')
    }
    
    let html = fs.readFileSync(filePath, 'utf-8')
    html = html.replaceAll('{url}', url || '')
    html = html.replaceAll('{title}', title)
    html = html.replaceAll('{desc}', desc)
    html = html.replaceAll('{image}', image)
    html = html.replaceAll('{jsPath}', `/${jsFile}`)
    html = html.replaceAll('{particlesPath}', `/${particlesFile}`)
    
    // Set proper headers and send response
    reply.header('Content-Type', 'text/html; charset=utf-8')
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    reply.header('Pragma', 'no-cache')
    reply.header('Expires', '0')
    reply.send(html)
  } catch (error) {
    console.error('[Server] Error serving HTML:', error)
    reply.status(500).send('Internal Server Error')
  }
})
try {
  console.log('[Server] Registering static - public files')
  await fastify.register(statics, {
    root: path.join(__dirname, 'public'),
    prefix: '/',
    decorateReply: false,
    setHeaders: res => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    },
  })
  console.log('[Server] Registered static - public files')
} catch (error) {
  console.error('[Server] Error registering static public:', error)
  throw error
}

try {
  console.log('[Server] Registering static - assets')
  await fastify.register(statics, {
    root: assetsDir,
    prefix: '/assets/',
    decorateReply: false,
    setHeaders: res => {
      // all assets are hashed & immutable so we can use aggressive caching
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') // 1 year
      res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()) // older browsers
    },
  })
  console.log('[Server] Registered static - assets')
} catch (error) {
  console.error('[Server] Error registering static assets:', error)
  throw error
}

// Register RPG systems static serving if available
if (process.env.RPG_SYSTEMS_PATH) {
  try {
    console.log('[Server] Registering static - RPG systems')
    await fastify.register(statics, {
      root: process.env.RPG_SYSTEMS_PATH,
      prefix: '/rpg/dist/',
      decorateReply: false,
      setHeaders: res => {
        // Allow client to load JS modules
        res.setHeader('Cache-Control', 'public, max-age=300') // 5 minutes
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET')
      },
    })
    console.log('[Server] Registered static - RPG systems')
  } catch (error) {
    console.error('[Server] Error registering static RPG systems:', error)
    // Don't throw - RPG systems are optional
  }
}

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

// Expose plugin paths to client for systems loading
if (process.env.RPG_SYSTEMS_PATH) {
  publicEnvs['PLUGIN_PATH'] = process.env.RPG_SYSTEMS_PATH
}
if (process.env.PLUGIN_PATH) {
  publicEnvs['PLUGIN_PATH'] = process.env.PLUGIN_PATH
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

// Frontend error reporting endpoint
fastify.post('/api/errors/frontend', async (request, reply) => {
  try {
    const errorData = request.body as any;
    
    // Log the frontend error with full context
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      source: 'frontend',
      ...errorData
    };
    
    // Log the frontend error
    console.error(`[Frontend Error] ${timestamp}`);
    console.error('Error:', errorData.message);
    console.error('Stack:', errorData.stack);
    console.error('URL:', errorData.url);
    console.error('User Agent:', errorData.userAgent);
    if (errorData.context) {
      console.error('Additional Context:', errorData.context);
    }
    
    // Store error in database if needed (optional)
    try {
      const errorLog = {
        timestamp: Date.now(),
        source: 'frontend',
        level: 'error',
        data: JSON.stringify(logEntry)
      };
      
      // You can uncomment this to store errors in the database
      // db.prepare('INSERT INTO error_logs (timestamp, source, level, data) VALUES (?, ?, ?, ?)').run(
      //   errorLog.timestamp, errorLog.source, errorLog.level, errorLog.data
      // );
    } catch (dbError) {
      console.error('[Database] Failed to store frontend error:', dbError);
    }
    
    return reply.send({ success: true, logged: true });
  } catch (error) {
    console.error('[API] Failed to process frontend error:', error);
    return reply.code(500).send({ 
      success: false, 
      error: 'Failed to log frontend error' 
    });
  }
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

} // End of startServer function

// Start the server
startServer().catch(error => {
  console.error('[Server] Failed to start server:', error);
  process.exit(1);
});
