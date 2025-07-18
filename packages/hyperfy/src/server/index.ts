import 'ses';
import '../core/lockdown';
import './bootstrap';

import dotenv from 'dotenv';

dotenv.config();
import fs from 'fs-extra';
import { ENV } from '../core/env';
import path from 'path';
// import { pipeline } from 'stream/promises';
import Fastify from 'fastify';
import ws from '@fastify/websocket';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import statics from '@fastify/static';
import multipart from '@fastify/multipart';

import { createServerWorld } from '../core/createServerWorld';
import { hashFile } from '../core/utils-server';
import { ENV_SERVER } from '../core/env-server';
import { getDB } from './db';
import { Storage } from './Storage';
import { initCollections } from './collections';
import { WorldManager } from '../core/ugc/WorldManager';

// Resolve paths correctly whether in build/ or src/
// When running from build/index.js, we need to go up one level to reach project root
// When running from src/server/index.ts (during dev), we need to go up two levels
const isBuild = __dirname.endsWith('build');
const rootDir = path.resolve(__dirname, isBuild ? '..' : '../..');
const worldDir = path.join(rootDir, process.env.WORLD || 'world');
const assetsDir = path.join(worldDir, '/assets');
const collectionsDir = path.join(worldDir, '/collections');
const port = parseInt(process.env.PORT || '8787', 10);

// Debug logging for path resolution
console.log('Path resolution debug:');
console.log('  __dirname:', __dirname);
console.log('  isBuild:', isBuild);
console.log('  rootDir:', rootDir);
console.log('  worldDir:', worldDir);
console.log('  assetsDir:', assetsDir);

// create world folders if needed
await fs.ensureDir(worldDir);
await fs.ensureDir(assetsDir);
await fs.ensureDir(collectionsDir);

// copy over built-in assets and collections
const srcWorldAssets = path.join(rootDir, 'src/world/assets');
const srcWorldCollections = path.join(rootDir, 'src/world/collections');

// Only copy if source directories exist
if (await fs.pathExists(srcWorldAssets)) {
  await fs.copy(srcWorldAssets, assetsDir);
}
if (await fs.pathExists(srcWorldCollections)) {
  await fs.copy(srcWorldCollections, collectionsDir);
}

// init collections
const collections = await initCollections({ collectionsDir, assetsDir });

// init db
const db = await getDB(path.join(worldDir, '/db.sqlite'));

// init storage
const storage = new Storage(path.join(worldDir, '/storage.json'));

// Initialize WorldManager and create worlds
const worldManager = new WorldManager();
await worldManager.initializeDefaultWorlds();

// Set up worlds with collections, DB, and storage
for (const [worldId, world] of worldManager.getAllWorlds()) {
  world.assetsUrl = ENV.PUBLIC_ASSETS_URL || '/assets/';

  // Ensure assetsUrl ends with slash for proper URL resolution
  if (!world.assetsUrl.endsWith('/')) {
    world.assetsUrl += '/';
  }

  // Set up default environment if no settings exist
  if (!(world.settings as any).model) {
    // Set default environment model in settings for ServerEnvironment system
    ;(world.settings as any).model = {
      url: 'asset://base-environment.glb',
    };
  }

  // Also configure for client preloading
  if (!(world as any).environment?.base) {
    ;(world as any).environment = {
      base: {
        model: 'asset://base-environment.glb',
      },
    };
  }

  ;(world.collections as any).deserialize(collections)
  ;(world as any).init({ db, storage, assetsDir });
}

const fastify = Fastify({ logger: { level: 'error' } });

fastify.register(cors);
fastify.register(compress);

// Determine client directory based on environment
const clientDir =
  ENV.CLIENT_BUILD_DIR ||
  (ENV.NODE_ENV === 'production' ? path.join(rootDir, 'dist/client') : path.join(rootDir, 'dist/client'));

// Serve client files
fastify.register(statics, {
  root: clientDir,
  prefix: '/',
  decorateReply: false,
  setHeaders: (res, path) => {
    // In development, disable caching
    if (ENV.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // In production, use moderate caching for HTML and aggressive for assets
      if (path.endsWith('.html') || path === '/index.html') {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
      }
    }
  },
});
fastify.register(statics, {
  root: assetsDir,
  prefix: '/assets/',
  decorateReply: false,
  setHeaders: res => {
    // all assets are hashed & immutable so we can use aggressive caching
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString()); // older browsers
  },
});
fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});
fastify.register(ws);
fastify.register(worldNetwork);

const publicEnvs = ENV.getPublicVars();
const envsCode = `
  if (!globalThis.env) globalThis.env = {}
  globalThis.env = ${JSON.stringify(publicEnvs)}
`;
fastify.get('/env.js', async (_req, reply) => {
  reply.type('application/javascript').send(envsCode);
});

// API endpoint to list available worlds
fastify.get('/api/worlds', async (_req, reply) => {
  const worlds = worldManager.getAllWorldConfigs().map(config => ({
    id: config.id,
    name: config.name,
    route: config.route,
    type: config.type
  }));
  reply.send({ worlds });
});

// API endpoint to get world capabilities
fastify.get('/api/worlds/:worldId/capabilities', async (req: any, reply) => {
  const { worldId } = req.params;
  const capabilities = worldManager.getWorldCapabilities(worldId);
  if (!capabilities) {
    reply.status(404).send({ error: 'World not found' });
    return;
  }
  reply.send({ capabilities });
});

fastify.post('/api/upload', async (req, _reply) => {
  // console.log('DEBUG: slow uploads')
  // await new Promise(resolve => setTimeout(resolve, 2000))
  const file = await req.file();
  if (!file) {
    throw new Error('No file uploaded');
  }
  const ext = file.filename.split('.').pop()?.toLowerCase();
  if (!ext) {
    throw new Error('Invalid filename');
  }
  // create temp buffer to store contents
  const chunks: Buffer[] = [];
  for await (const chunk of file.file) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  // hash from buffer
  const hash = await hashFile(buffer);
  const filename = `${hash}.${ext}`;
  // save to fs
  const filePath = path.join(assetsDir, filename);
  const exists = await fs.exists(filePath);
  if (!exists) {
    await fs.writeFile(filePath, buffer);
  }
});

fastify.get('/api/upload-check', async (req: any, _reply) => {
  const filename = req.query.filename as string;
  const filePath = path.join(assetsDir, filename);
  const exists = await fs.exists(filePath);
  return { exists };
});

fastify.get('/health', async (_request, reply) => {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    return reply.code(200).send(health);
  } catch (error) {
    console.error('Health check failed:', error);
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

fastify.get('/status', async (_request, reply) => {
  try {
    // Get status for all worlds
    const worldStatuses: any[] = [];

    for (const [worldId, world] of worldManager.getAllWorlds()) {
      const status = {
        worldId,
        uptime: Math.round(world.time),
        protected: ENV_SERVER.ADMIN_CODE !== undefined,
        connectedUsers: [] as Array<{
          id: any
          position: any
          name: any
        }>,
        commitHash: ENV.COMMIT_HASH,
      };

      if ((world as any).network?.sockets) {
        for (const socket of (world as any).network.sockets.values()) {
          status.connectedUsers.push({
            id: socket.player.data.userId,
            position: socket.player.position.current.toArray(),
            name: socket.player.data.name,
          });
        }
      }

      worldStatuses.push(status);
    }

    return reply.code(200).send({ worlds: worldStatuses });
  } catch (error) {
    console.error('Status failed:', error);
    return reply.code(503).send({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

fastify.setErrorHandler((err, _req, reply) => {
  console.error(err);
  reply.status(500).send();
});

try {
  await fastify.listen({ port, host: '0.0.0.0' });
} catch (err) {
  console.error(err);
  console.error(`failed to launch on port ${port}`);
  process.exit(1);
}

async function worldNetwork(fastify: any) {
  // Create WebSocket routes for each world
  for (const [worldId, world] of worldManager.getAllWorlds()) {
    const config = worldManager.getWorldConfig(worldId);
    if (!config) continue;
    
    // Create WebSocket route
    const wsRoute = `${config.route}/ws`;
    fastify.get(wsRoute, { websocket: true }, (ws: any, req: any) => {
      const targetWorld = worldManager.getWorld(config.id);
      if (!targetWorld) {
        ws.close(1000, 'World not found');
        return;
      }
      ;(targetWorld as any).network.onConnection(ws, req.query);
    });
  }
}

console.log(`running on port ${port}`);

// Graceful shutdown
process.on('SIGINT', async () => {
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await fastify.close();
  process.exit(0);
});
