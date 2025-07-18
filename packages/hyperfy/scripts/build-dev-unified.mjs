#!/usr/bin/env node

import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { spawn, fork } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { createServer } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')
const typecheck = !process.argv.includes('--no-typecheck')

// Port configuration
const defaultBackendPort = 4444
const backendPort = parseInt(process.env.BACKEND_PORT || process.env.PORT || defaultBackendPort.toString(), 10)
const frontendPort = parseInt(process.env.FRONTEND_PORT || (backendPort - 1000).toString(), 10)

let serverProcess = null
let tscProcess = null
let viteServer = null

/**
 * Build and run server with ESBuild
 */
async function buildServer() {
  console.log('🔨 Building server with ESBuild...')

  const serverCtx = await esbuild.context({
    entryPoints: ['src/server/index.ts'],
    outfile: 'build/index.js',
    platform: 'node',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: false,
    sourcemap: true,
    packages: 'external',
    target: 'node22',
    define: {
      'process.env.CLIENT': 'false',
      'process.env.SERVER': 'true',
    },
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    plugins: [
      {
        name: 'server-restart',
        setup(build) {
          build.onEnd(async result => {
            if (result.errors.length > 0) {
              return
            }

            // Copy PhysX files
            const physxJsSrc = path.join(rootDir, 'src/core/physx-js-webidl.js')
            const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
            const physxJsDest = path.join(buildDir, 'physx-js-webidl.js')
            const physxWasmDest = path.join(buildDir, 'physx-js-webidl.wasm')

            await fs.copy(physxJsSrc, physxJsDest)
            await fs.copy(physxWasmSrc, physxWasmDest)

            // Restart server
            console.log('🔄 Restarting server...')
            if (serverProcess) {
              serverProcess.kill('SIGTERM')
              await new Promise(resolve => setTimeout(resolve, 500))
            }

            serverProcess = fork(path.join(rootDir, 'build/index.js'), [], {
              env: {
                ...process.env,
                NODE_ENV: 'development',
                PORT: backendPort.toString(),
                // Don't serve client files in dev mode - Vite will handle that
                NO_CLIENT_SERVE: 'true',
              },
            })

            serverProcess.on('error', err => {
              console.error('❌ Server error:', err)
            })

            serverProcess.on('exit', code => {
              if (code !== 0 && code !== null) {
                console.error(`❌ Server exited with code ${code}`)
              }
            })
          })
        },
      },
    ],
  })

  await serverCtx.watch()
  await serverCtx.rebuild()

  console.log('✅ Server build complete, watching for changes...')
  return serverCtx
}

/**
 * Run Vite dev server with proxy to backend
 */
async function runViteDevServer() {
  console.log('🚀 Starting Vite dev server...')

  viteServer = await createServer({
    configFile: path.join(rootDir, 'vite.config.ts'),
    server: {
      port: frontendPort,
      proxy: {
        '/ws': {
          target: `ws://localhost:${backendPort}`,
          ws: true,
        },
        '/api': {
          target: `http://localhost:${backendPort}`,
        },
        '/assets': {
          target: `http://localhost:${backendPort}`,
        },
        '/env.js': {
          target: `http://localhost:${backendPort}`,
        },
        '/health': {
          target: `http://localhost:${backendPort}`,
        },
        '/status': {
          target: `http://localhost:${backendPort}`,
        },
      },
    },
  })

  await viteServer.listen()

  console.log('✅ Vite dev server ready')
}

/**
 * TypeScript type checking in watch mode
 */
async function watchTypeCheck() {
  if (!typecheck) {
    return
  }

  console.log('👀 Starting TypeScript type checking...')
  tscProcess = spawn('npx', ['tsc', '--noEmit', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    cwd: rootDir,
  })
}

/**
 * Main development script
 */
async function main() {
  console.log('🚀 Starting Hyperfy development server...')

  // Ensure directories exist
  await fs.ensureDir(buildDir)

  // Start all processes
  await buildServer()
  await runViteDevServer()
  watchTypeCheck()

  console.log('\n✨ Development server ready!')
  console.log(`   🌐 http://localhost:${frontendPort}`)
  console.log(`   📡 WebSocket: ws://localhost:${frontendPort}/ws`)
  console.log(`   🔧 Backend API: http://localhost:${backendPort}`)
  console.log('\n   Press Ctrl+C to stop\n')
}

// Handle cleanup
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
  }
  if (tscProcess) {
    tscProcess.kill('SIGTERM')
  }
  if (viteServer) {
    await viteServer.close()
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
  }
  if (tscProcess) {
    tscProcess.kill('SIGTERM')
  }
  if (viteServer) {
    await viteServer.close()
  }
  process.exit(0)
})

// Run the dev server
main().catch(error => {
  console.error('❌ Development server failed:', error)
  process.exit(1)
})
