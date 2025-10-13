import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from both workspace root and client directory
  const workspaceRoot = path.resolve(__dirname, '../..')
  const clientDir = __dirname
  
  // Load from both locations - client dir takes precedence
  const workspaceEnv = loadEnv(mode, workspaceRoot, ['PUBLIC_', 'VITE_'])
  const clientEnv = loadEnv(mode, clientDir, ['PUBLIC_', 'VITE_'])
  const env = { ...workspaceEnv, ...clientEnv }
  
  console.log('[Vite Config] Loaded env from workspace:', workspaceRoot)
  console.log('[Vite Config] Loaded env from client:', clientDir)
  console.log('[Vite Config] PUBLIC_PRIVY_APP_ID:', env.PUBLIC_PRIVY_APP_ID ? `${env.PUBLIC_PRIVY_APP_ID.substring(0, 10)}...` : 'NOT SET')
  
  return {
  plugins: [
    react(),
    // Watch shared package for changes and trigger full reload
    {
      name: 'watch-shared-package',
      configureServer(server) {
        const sharedBuildPath = path.resolve(__dirname, '../shared/build')
        server.watcher.add(path.join(sharedBuildPath, '*.js'))
        server.watcher.on('change', (file) => {
          if (file.includes('packages/shared/build/')) {
            console.log('\n[Vite] Shared package updated, reloading...\n')
            server.ws.send({
              type: 'full-reload',
              path: '*'
            })
          }
        })
      }
    },
    // Plugin to handle Node.js modules in browser
    {
      name: 'node-modules-polyfill',
      resolveId(id) {
        // Return false for Node.js built-in modules to prevent them from being resolved
        const nodeModules = ['fs', 'fs-extra', 'path', 'node:fs', 'node:path', 'graceful-fs']
        if (nodeModules.includes(id) || id.startsWith('node:')) {
          return { id: `virtual:${id}`, external: false }
        }
      },
      load(id) {
        // Provide empty implementations for Node.js modules
        if (id.startsWith('virtual:')) {
          return 'export default {}; export const readFile = () => {}; export const writeFile = () => {};'
        }
      }
    }
  ],
  
  // Tell Vite to look for .env files in the client directory
  envDir: clientDir,
  
  // Vite automatically exposes PUBLIC_ prefixed variables via import.meta.env
  envPrefix: 'PUBLIC_',
  
  root: path.resolve(__dirname, 'src'),
  publicDir: 'public',
  
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext', // Support top-level await
    minify: false, // Disable minification for debugging
    sourcemap: true, // Enable source maps for better debugging
    rollupOptions: {
      input: path.resolve(__dirname, 'src/index.html'),
      external: ['fs', 'fs-extra', 'path', 'node:fs', 'node:path'],
      output: {
        // Provide empty stubs for Node.js modules
        globals: {
          'fs': '{}',
          'fs-extra': '{}',
          'path': '{}',
          'node:fs': '{}',
          'node:path': '{}'
        }
      },
      onwarn(warning, warn) {
        // Suppress warnings about PURE annotations in ox library and external modules
        if (warning.code === 'SOURCEMAP_ERROR' || 
            warning.code === 'UNRESOLVED_IMPORT' ||
            (warning.message && warning.message.includes('contains an annotation that Rollup cannot interpret'))) {
          return
        }
        warn(warning)
      }
    },
    // Mobile optimization
    chunkSizeWarningLimit: 2000, // Increase for large 3D assets
    cssCodeSplit: true, // Split CSS for better caching
  },
  
  esbuild: {
    target: 'esnext' // Support top-level await
  },
  
  define: {
    global: 'globalThis', // Needed for some node polyfills in browser
    
    // ============================================================================
    // SECURITY: process.env Polyfill for Browser
    // ============================================================================
    // Replace process.env with an empty object to prevent accidental secret exposure
    // This makes shared code's `process.env.X` references return undefined in browser
    // 
    // ⚠️  NEVER ADD SECRET VARIABLES HERE ⚠️
    // Secret variables that must NEVER be exposed to client:
    //   - PRIVY_APP_SECRET
    //   - JWT_SECRET  
    //   - DATABASE_URL
    //   - POSTGRES_PASSWORD
    //   - LIVEKIT_API_SECRET
    //   - ADMIN_CODE (reveals admin password)
    // 
    // Only add PUBLIC_ prefixed variables or safe config values below.
    // ============================================================================
    'process.env': '{}',
    
    // Safe environment variables (no secrets, only config)
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.DEBUG_RPG': JSON.stringify(env.DEBUG_RPG || ''),
    'process.env.PUBLIC_CDN_URL': JSON.stringify(env.PUBLIC_CDN_URL || 'http://localhost:8080'),
    'process.env.PUBLIC_STARTER_ITEMS': JSON.stringify(env.PUBLIC_STARTER_ITEMS || ''),
    'process.env.TERRAIN_SEED': JSON.stringify(env.TERRAIN_SEED || '0'),
    'process.env.VITEST': 'undefined', // Not in browser
    
    // Note: import.meta.env.PUBLIC_* variables are auto-exposed by Vite (via envPrefix above)
    // We don't need to manually define them here - Vite handles it automatically
  },
  server: {
    port: Number(env.VITE_PORT) || 3333,
    open: false,
    host: true,
    // Silence noisy missing source map warnings for vendored libs
    sourcemapIgnoreList(relativeSourcePath, _sourcemapPath) {
      return /src\/libs\/(stats-gl|three-custom-shader-material)\//.test(relativeSourcePath)
    },
    fs: {
      // Allow serving files from the shared package
      allow: ['..'],
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Use client-only build of shared package to avoid Node.js module leakage
      '@hyperscape/shared': path.resolve(__dirname, '../shared/build/framework.client.js'),
    },
    dedupe: ['three']
  },
  
  optimizeDeps: {
    include: [
      'three', 
      'react', 
      'react-dom',
      '@hyperscape/shared' // Ensure this gets optimized with the correct alias
    ],
    exclude: [
      '@playwright/test', // Exclude Playwright from optimization
      'fs-extra',         // Exclude Node.js modules
      'fs',
      'path',
      'node:fs',
      'node:path',
      'graceful-fs'
    ],
    esbuildOptions: {
      target: 'esnext', // Support top-level await
      define: {
        global: 'globalThis'
      }
    }
  },
  ssr: {
    noExternal: []
  }
}}) 