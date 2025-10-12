import 'dotenv/config'
import fs from 'fs-extra'
import path from 'path'
import { fork, execSync, spawn } from 'child_process'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
import { build as viteBuild, createServer as createViteServer } from 'vite'

const dev = process.argv.includes('--dev')
const typecheck = !process.argv.includes('--no-typecheck')
const serverOnly = process.argv.includes('--server-only')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, '../')
const buildDir = path.join(rootDir, 'build')

// Ensure build directories exist
await fs.ensureDir(buildDir)
if (!serverOnly) {
  await fs.ensureDir(path.join(buildDir, 'public'))
}

/**
 * TypeScript Plugin for ESBuild
 */
const typescriptPlugin = {
  name: 'typescript',
  setup(build) {
    // Handle .ts and .tsx files
    build.onResolve({ filter: /\.tsx?$/ }, args => {
      return {
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'file',
      }
    })
  },
}

/**
 * Plugin to exclude test files
 */
const excludeTestsPlugin = {
  name: 'exclude-tests',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      // Exclude test files and test directories
      if (args.path.includes('__tests__') || 
          args.path.includes('/tests/') ||
          args.path.includes('.test.') ||
          args.path.includes('.spec.') ||
          args.path.includes('mockWorld') ||
          args.path.includes('test-utils') ||
          args.path === 'vitest' ||
          args.path.includes('vitest/')) {
        return { path: args.path, external: true }
      }
    })
    
    build.onLoad({ filter: /\.tsx?$/ }, async (args) => {
      const fs = await import('fs')
      let contents = await fs.promises.readFile(args.path, 'utf8')
      
      // Remove any vitest imports
      contents = contents.replace(/import\s+.*?\s+from\s+['"]vitest['"]/g, '')
      contents = contents.replace(/from\s+['"]vitest['"]/g, 'from "node:test"')
      
      return {
        contents,
        loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts'
      }
    })
  }
}



/**
 * Run TypeScript Type Checking
 */
async function runTypeCheck() {
  if (!typecheck) return
  
  console.log('Running TypeScript type checking...')
  try {
    execSync('bunx --yes tsc --noEmit -p tsconfig.build.json', { 
      stdio: 'inherit',
      cwd: rootDir 
    })
    console.log('Type checking passed ✓')
  } catch (error) {
    console.error('Type checking failed!')
    // if (!dev) {
    //   process.exit(1)
    // }
  }
}

/**
 * Build Client with Vite
 */
const clientPublicDir = path.join(rootDir, 'src/client/public')
const clientBuildDir = path.join(rootDir, 'build/public')

async function buildClient() {
  console.log('Building client with Vite...')
  
  if (dev) {
    // In dev mode, create a Vite dev server
    const viteServer = await createViteServer({
      configFile: path.join(rootDir, 'vite.config.ts'),
      server: {
        port: process.env.VITE_PORT,
        hmr: {
          port: process.env.VITE_PORT
        }
      }
    })
    
    await viteServer.listen()
    console.log(`✓ Vite dev server running on port ${process.env.VITE_PORT}`)
    
    // Ensure PhysX assets are available to Vite dev server under / in public dir
    try {
      const devPublicDir = path.join(rootDir, 'src/client/public')
      await fs.ensureDir(devPublicDir)

      let physxWasmSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
      let physxJsSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')

      if (!await fs.pathExists(physxWasmSrc)) {
        physxWasmSrc = path.join(rootDir, '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
        physxJsSrc = path.join(rootDir, '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')
      }

      // Fallback to checked-in prebuilt files if npm package isn't available
      if (!await fs.pathExists(physxWasmSrc)) {
        const fallbackWasm = path.join(rootDir, 'src/server/public/physx-js-webidl.wasm')
        const fallbackJs = path.join(rootDir, 'src/server/public/physx-js-webidl.js')
        if (await fs.pathExists(fallbackWasm)) {
          physxWasmSrc = fallbackWasm
        }
        if (await fs.pathExists(fallbackJs)) {
          physxJsSrc = fallbackJs
        }
      }

      const physxWasmDest = path.join(devPublicDir, 'physx-js-webidl.wasm')
      const physxJsDest = path.join(devPublicDir, 'physx-js-webidl.js')

      if (await fs.pathExists(physxWasmSrc) && !await fs.pathExists(physxWasmDest)) {
        await fs.copy(physxWasmSrc, physxWasmDest)
        console.log('✓ Dev: Copied PhysX WASM to src/client/public')
      }
      if (await fs.pathExists(physxJsSrc) && !await fs.pathExists(physxJsDest)) {
        await fs.copy(physxJsSrc, physxJsDest)
        console.log('✓ Dev: Copied PhysX JS to src/client/public')
      }
    } catch (e) {
      console.warn('⚠️  Dev: Failed to ensure PhysX assets in Vite public dir', e)
    }
    
    return viteServer
  } else {
    // Production build with Vite
    await viteBuild({
      configFile: path.join(rootDir, 'vite.config.ts'),
      mode: 'production'
    })
    
    console.log('✓ Client built successfully with Vite')
    
    // Copy PhysX WASM and JS from node_modules if needed
    let physxWasmSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
    let physxJsSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')
    if (!await fs.pathExists(physxWasmSrc)) {
      physxWasmSrc = path.join(rootDir, '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
      physxJsSrc = path.join(rootDir, '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')
    }
    // Fallback to src/server/public if npm package not found
    if (!await fs.pathExists(physxWasmSrc)) {
      physxWasmSrc = path.join(rootDir, 'src/server/public/physx-js-webidl.wasm')
      physxJsSrc = path.join(rootDir, 'src/server/public/physx-js-webidl.js')
    }
    const physxWasmDest = path.join(clientBuildDir, 'physx-js-webidl.wasm')
    const physxJsDest = path.join(clientBuildDir, 'physx-js-webidl.js')
    
    if (await fs.pathExists(physxWasmSrc)) {
      await fs.copy(physxWasmSrc, physxWasmDest)
      console.log('✓ Copied PhysX WASM file to client build')
    } else {
      console.error('✗ PhysX WASM file not found!')
    }
    
    if (await fs.pathExists(physxJsSrc)) {
      await fs.copy(physxJsSrc, physxJsDest)
      console.log('✓ Copied PhysX JS file to client build')
    } else {
      console.error('✗ PhysX JS file not found!')
    }
    
    // Create env.js file for runtime configuration
    const envJs = `window.env = {
  PUBLIC_WS_URL: '${process.env.PUBLIC_WS_URL || ''}',
  PUBLIC_ASSETS_URL: '${process.env.PUBLIC_ASSETS_URL || '/world-assets/'}',
  LIVEKIT_URL: '${process.env.LIVEKIT_URL || ''}'
};`
    await fs.writeFile(path.join(clientBuildDir, 'env.js'), envJs)
    
    return null
  }
}

/**
 * Build Framework Library
 */
async function buildFramework() {
  const frameworkCtx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    outfile: 'build/framework.js',
    platform: 'neutral',
    format: 'esm',
    bundle: true,
    treeShaking: true,
    minify: !dev,
    sourcemap: true,
    packages: 'external',
    target: 'esnext',
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    plugins: [typescriptPlugin],
  })
  
  await frameworkCtx.rebuild()
  return frameworkCtx
}

/**
 * Build Server
 */
let serverProcess

async function buildServer() {
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
    external: ['vitest'],
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
      typescriptPlugin,
      excludeTestsPlugin,
      {
        name: 'server-finalize-plugin',
        setup(build) {
          build.onEnd(async result => {
            if (result.errors.length > 0) return
            
            // Copy PhysX files from npm package for browser loading
            
            // Copy WASM and JS from physx-js-webidl npm package
            // Try local node_modules first, then fallback to root workspace
            // In production with full client build, the client builder handles copying.
            // To avoid race conditions with Vite's emptyOutDir, only copy here in dev or server-only mode.
            if (dev || serverOnly) {
              let physxWasmSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
              let physxJsSrc = path.join(rootDir, 'node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')
              if (!await fs.pathExists(physxWasmSrc)) {
                physxWasmSrc = path.join(rootDir, '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.wasm')
                physxJsSrc = path.join(rootDir, '../../node_modules/@hyperscape/physx-js-webidl/dist/physx-js-webidl.js')
              }
              // Fallback to checked-in prebuilt files if npm package isn't available
              if (!await fs.pathExists(physxWasmSrc)) {
                const fallbackWasm = path.join(rootDir, 'src/server/public/physx-js-webidl.wasm')
                const fallbackJs = path.join(rootDir, 'src/server/public/physx-js-webidl.js')
                if (await fs.pathExists(fallbackWasm)) {
                  physxWasmSrc = fallbackWasm
                }
                if (await fs.pathExists(fallbackJs)) {
                  physxJsSrc = fallbackJs
                }
              }

              const physxWasmDest = path.join(rootDir, 'build/public/physx-js-webidl.wasm')
              const physxJsDest = path.join(rootDir, 'build/public/physx-js-webidl.js')

              await fs.ensureDir(path.join(rootDir, 'build/public'))

              if (await fs.pathExists(physxWasmSrc)) {
                await fs.copy(physxWasmSrc, physxWasmDest)
                console.log('✓ Copied PhysX WASM file to build/public/')
              } else {
                console.error('✗ PhysX WASM file not found (node_modules or fallback)')
              }

              if (await fs.pathExists(physxJsSrc)) {
                await fs.copy(physxJsSrc, physxJsDest)
                console.log('✓ Copied PhysX JS file to build/public/')
              } else {
                console.error('✗ PhysX JS file not found (node_modules or fallback)')
              }
            }
            
            // Restart server in dev mode using Bun runtime
            if (dev) {
              try {
                serverProcess?.kill('SIGTERM')
              } catch {}
              serverProcess = spawn('bun', [path.join(rootDir, 'build/index.js')], {
                stdio: 'inherit',
                cwd: rootDir,
              })
            }
          })
        },
      },
    ],
  })
  
  if (dev) {
    await serverCtx.watch()
  } else {
    await serverCtx.rebuild()
  }
  
  return serverCtx
}

/**
 * Generate TypeScript Declaration Files
 */
async function generateDeclarations() {
  if (!typecheck) return
  
  console.log('Generating TypeScript declarations...')
  try {
    // First, ensure build directory exists
    await fs.ensureDir(path.join(rootDir, 'build'))
    
    // Generate declaration files using tsc
    console.log('Creating type definitions...')
    execSync('bunx --yes tsc -p tsconfig.build.json', {
      stdio: 'inherit',
      cwd: rootDir
    })
    
    // Sanitize generated three.d.ts to avoid API Extractor pulling in all of three's exports
    try {
      const threeDtsPath = path.join(rootDir, 'build/extras/three.d.ts')
      if (await fs.pathExists(threeDtsPath)) {
        let dts = await fs.readFile(threeDtsPath, 'utf8')
        const original = dts
        // Remove any star re-exports of three types which trigger unsupported exports like LightShadow
        dts = dts.replace(/\n?export\s+\*\s+from\s+['\"]three['\"];?\s*\n?/g, '\n')
        // Remove sourceMappingURL comments which can make API Extractor try to follow .ts sources
        dts = dts.replace(/\n?\/\/#[^\n]*sourceMappingURL[^\n]*\n?/g, '\n')
        if (dts !== original) {
          await fs.writeFile(threeDtsPath, dts)
          console.log('Sanitized build/extras/three.d.ts (removed export * from "three")')
        }
      }
    } catch (stripErr) {
      console.warn('Warning: failed to sanitize build/extras/three.d.ts', stripErr)
    }

    // Remove sourceMappingURL comments from all .d.ts to ensure API Extractor does not try to analyze .ts files
    try {
      const stripSourceMapComments = async (dir) => {
        const entries = await fs.readdir(dir)
        for (const entry of entries) {
          const full = path.join(dir, entry)
          const stat = await fs.lstat(full)
          if (stat.isDirectory()) {
            await stripSourceMapComments(full)
          } else if (entry.endsWith('.d.ts')) {
            const content = await fs.readFile(full, 'utf8')
            const cleaned = content.replace(/\n?\/\/#[^\n]*sourceMappingURL[^\n]*\n?/g, '\n')
            if (cleaned !== content) {
              await fs.writeFile(full, cleaned)
            }
          }
        }
      }
      await stripSourceMapComments(path.join(rootDir, 'build'))
    } catch (e) {
      console.warn('Warning: failed to strip sourceMappingURL comments from declarations', e)
    }
    
    // Copy physx.d.ts file since tsc doesn't copy .d.ts files
    const physxSourcePath = path.join(rootDir, 'src/types/physics.d.ts')
    const physxDestPath = path.join(rootDir, 'build/types/physics.d.ts')
    if (await fs.pathExists(physxSourcePath)) {
      await fs.ensureDir(path.join(rootDir, 'build/types'))
      await fs.copy(physxSourcePath, physxDestPath)
      console.log('Copied physx.d.ts to build directory')
    }
    
    // Bundle type definitions using API Extractor
    console.log('Bundling type definitions with API Extractor...')
    try {
      execSync('bunx --yes api-extractor run --local --verbose', {
        stdio: 'inherit',
        cwd: rootDir
      })
      console.log('Created bundled type file: build/hyperscape.d.ts')
    } catch (bundleError) {
      console.log('Type bundling with API Extractor failed, trying Rollup...')
      try {
        const rollupConfigPath = path.join(rootDir, 'rollup.dts.config.mjs')
        if (await fs.pathExists(rollupConfigPath)) {
          execSync('bunx --yes rollup -c rollup.dts.config.mjs', {
            stdio: 'pipe',
            cwd: rootDir
          })
          console.log('Created bundled type files with Rollup')
        } else {
          console.log('Rollup DTS config not found, skipping Rollup bundling')
        }
      } catch (rollupError) {
        console.log('Type bundling failed, using regular .d.ts files')
      }
    }
    
    // Create framework.d.ts as an alias for backward compatibility
    const frameworkDeclaration = `// TypeScript declarations for Hyperscape Framework
// Re-export everything from the main index module
export * from './index';
`
    await fs.writeFile(path.join(rootDir, 'build/framework.d.ts'), frameworkDeclaration)
    
    // Create server-index.d.ts for backward compatibility
    const serverIndexDeclaration = `// TypeScript declarations for Hyperscape Server
// Re-exports CLI types
export * from './cli';
`
    await fs.writeFile(path.join(rootDir, 'build/server-index.d.ts'), serverIndexDeclaration)
    
    console.log('Declaration files generated ✓')
  } catch (error) {
    console.error('Declaration generation failed!', error)
    if (!dev) {
      process.exit(1)
    }
  }
}

/**
 * Watch TypeScript files for changes
 */
async function watchTypeScript() {
  if (!dev || !typecheck) return
  
  const { spawn } = await import('child_process')
  const tscWatch = spawn('bunx', ['--yes', 'tsc', '--noEmit', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    cwd: rootDir
  })
  
  process.on('exit', () => {
    tscWatch.kill()
  })
}

/**
 * Main Build Process
 */
async function main() {
  console.log(`Building Hyperscape in ${dev ? 'development' : 'production'} mode...`)
 
  if (!dev) {
    if (typecheck) {
      if (!serverOnly) {
        await generateDeclarations()
      } else {
        console.log('Skipping declaration generation for server-only build')
      }
    } else {
      console.log('Skipping declaration generation (no-typecheck)')
    }
  } else {
    await runTypeCheck()
  }
  
  // Build framework, client and server
  let frameworkCtx, clientCtx, serverCtx
  if (serverOnly) {
    [frameworkCtx, serverCtx] = await Promise.all([
      buildFramework(),
      buildServer()
    ])
  } else {
    [frameworkCtx, clientCtx, serverCtx] = await Promise.all([
      buildFramework(),
      buildClient(),
      buildServer()
    ])
  }
  
  // Start type checking watcher in dev mode
  if (dev) {
    watchTypeScript()
    console.log('Watching for changes...')
  } else {
    console.log('Build completed successfully!')
    process.exit(0)
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  serverProcess?.kill('SIGTERM')
  process.exit(0)
})

process.on('SIGTERM', () => {
  serverProcess?.kill('SIGTERM')
  process.exit(0)
})

// Run the build
main().catch(error => {
  console.error('Build failed:', error)
  process.exit(1)
}) 