#!/usr/bin/env node

import 'dotenv-flow/config'
import fs from 'fs-extra'
import path from 'path'
import { spawn, fork } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { createServer, build } from 'vite'
import chokidar from 'chokidar'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')
const clientBuildDir = path.join(rootDir, 'dist/client')
const typecheck = !process.argv.includes('--no-typecheck')

let serverProcess = null
let tscProcess = null

/**
 * Build client with Vite in watch mode
 */
async function buildClient() {
  console.log('🔨 Building client with Vite...')

  // Build once first
  await build({
    configFile: path.join(rootDir, 'vite.config.ts'),
    mode: 'development',
  })

  // Copy PhysX files to client build (in client-assets directory)
  const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
  const physxWasmDest = path.join(clientBuildDir, 'client-assets', 'physx-js-webidl.wasm')
  await fs.ensureDir(path.join(clientBuildDir, 'client-assets'))
  await fs.copy(physxWasmSrc, physxWasmDest)

  // Then watch
  const watcher = chokidar.watch(['src/client/**/*', 'src/core/**/*', 'src/types/**/*'], {
    ignored: ['**/node_modules/**', '**/.git/**'],
    persistent: true,
  })

  let building = false
  watcher.on('change', async () => {
    if (building) {
      return
    }
    building = true
    console.log('🔄 Client files changed, rebuilding...')
    try {
      await build({
        configFile: path.join(rootDir, 'vite.config.ts'),
        mode: 'development',
      })
      // Copy PhysX files again
      const physxWasmSrc = path.join(rootDir, 'src/core/physx-js-webidl.wasm')
      const physxWasmDest = path.join(clientBuildDir, 'client-assets', 'physx-js-webidl.wasm')
      await fs.ensureDir(path.join(clientBuildDir, 'client-assets'))
      await fs.copy(physxWasmSrc, physxWasmDest)
      console.log('✅ Client rebuild complete')
    } catch (error) {
      console.error('❌ Client build failed:', error)
    }
    building = false
  })

  console.log('✅ Client build complete, watching for changes...')
}

/**
 * Build server with ESBuild
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
            }

            // Wait a bit for the process to fully terminate
            await new Promise(resolve => setTimeout(resolve, 500))

            serverProcess = fork(path.join(rootDir, 'build/index.js'), [], {
              env: {
                ...process.env,
                CLIENT_BUILD_DIR: clientBuildDir,
                NODE_ENV: 'development',
                PORT: process.env.PORT || '3000',
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
  await fs.ensureDir(clientBuildDir)

  // Build client first, then server, then start watch mode
  console.log('📦 Initial build...')
  await buildClient()
  await buildServer()

  // Start watch mode
  watchTypeCheck()

  console.log('\n✨ Development server ready!')
  console.log(`   🌐 http://localhost:${process.env.PORT || 3000}`)
  console.log(`   📡 WebSocket: ws://localhost:${process.env.PORT || 3000}/ws`)
  console.log('\n   Press Ctrl+C to stop\n')
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...')
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
  }
  if (tscProcess) {
    tscProcess.kill('SIGTERM')
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
  }
  if (tscProcess) {
    tscProcess.kill('SIGTERM')
  }
  process.exit(0)
})

// Run the dev server
main().catch(error => {
  console.error('❌ Development server failed:', error)
  process.exit(1)
})
