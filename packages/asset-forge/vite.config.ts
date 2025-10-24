import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  publicDir: 'public', // Ensure service worker is copied
  plugins: [
    react(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10KB
      deleteOriginFile: false
    }),
    // Brotli compression (better compression ratio)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false
    })
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@react-three/fiber', '@react-three/drei', 'lucide-react'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Force all Three.js imports to use the same instance
      'three': path.resolve(__dirname, 'node_modules/three')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@react-three/fiber', '@react-three/drei', 'lucide-react'],
    exclude: ['.eslintrc.cjs', 'tailwind.config.cjs', 'postcss.config.cjs'],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx']
    },
    // Force optimizeDeps to rebuild and use single Three.js instance
    force: false
  },
  build: {
    modulePreload: {
      polyfill: true,
      resolveDependencies: (filename, deps) => {
        // Ensure vendor-react loads before vendor-icons to prevent undefined React errors
        // This only affects build-time dependency ordering, not runtime performance
        if (filename.includes('vendor-icons')) {
          const reactDeps: string[] = []
          const otherDeps: string[] = []
          
          for (const dep of deps) {
            if (dep.includes('vendor-react')) {
              reactDeps.push(dep)
            } else {
              otherDeps.push(dep)
            }
          }
          
          // Return other deps first, then React deps (ensures React loads first)
          return [...otherDeps, ...reactDeps]
        }
        return deps
      }
    },
    rollupOptions: {
      output: {
        // Preserve module execution order to avoid circular dependency issues
        preserveModules: false,
        hoistTransitiveImports: false,
        manualChunks: (id) => {
          // Core React and UI (MUST load first - keep together for optimal caching)
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler') ||
              id.includes('node_modules/react-is')) {
            return 'vendor-react'
          }

          // Lucide icons (DEPENDS ON REACT - must come after react in load order)
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }

          // Three.js core
          if (id.includes('node_modules/three') && !id.includes('examples/jsm')) {
            return 'vendor-three'
          }

          // Three.js loaders (LAZY LOADED - separate chunks for better code splitting)
          if (id.includes('three/examples/jsm/loaders/GLTFLoader')) {
            return 'vendor-three-gltf'
          }
          if (id.includes('three/examples/jsm/loaders/FBXLoader')) {
            return 'vendor-three-fbx'
          }
          if (id.includes('three/examples/jsm/loaders')) {
            return 'vendor-three-loaders'
          }

          // Three.js exporters (LAZY LOADED)
          if (id.includes('three/examples/jsm/exporters')) {
            return 'vendor-three-exporters'
          }

          // Three.js controls (LAZY LOADED)
          if (id.includes('three/examples/jsm/controls')) {
            return 'vendor-three-controls'
          }

          // Three.js post-processing (LAZY LOADED)
          if (id.includes('three/examples/jsm/postprocessing')) {
            return 'vendor-three-postprocessing'
          }

          // React Three Fiber and Drei (lazy loaded with 3D components)
          if (id.includes('@react-three/fiber') || id.includes('@react-three/drei')) {
            return 'vendor-three-react'
          }

          // AI/ML Libraries - Split by framework for better lazy loading
          // TensorFlow core (LAZY LOADED - only for hand rigging)
          if (id.includes('@tensorflow/tfjs-core') || id.includes('node_modules/@tensorflow/tfjs/')) {
            return 'vendor-tensorflow-core'
          }
          // TensorFlow WebGL backend (LAZY LOADED)
          if (id.includes('@tensorflow/tfjs-backend-webgl')) {
            return 'vendor-tensorflow-webgl'
          }
          // TensorFlow models (LAZY LOADED)
          if (id.includes('@tensorflow-models')) {
            return 'vendor-tensorflow-models'
          }
          // Generic TensorFlow
          if (id.includes('@tensorflow') || id.includes('tfjs')) {
            return 'vendor-tensorflow'
          }
          // MediaPipe (LAZY LOADED - only for hand rigging)
          if (id.includes('@mediapipe')) {
            return 'vendor-mediapipe'
          }

          // Authentication (Privy) - Keep WITH OTHER VENDORS to avoid circular dependency
          // Privy may depend on zustand/immer which MUST be in same chunk
          // COMMENTING OUT: if (id.includes('@privy-io')) { return 'vendor-auth' }

          // State management - DON'T split zustand/immer to avoid circular dependencies
          // Let them be bundled in vendor-other or with components that use them
          // ALSO: Keep Privy in vendor-other since it may depend on these

          // AI SDK and LLM providers (used in content generation)
          if (id.includes('@ai-sdk') || id.includes('node_modules/ai/') || id.match(/node_modules\/ai$/)) {
            return 'vendor-ai-sdk'
          }

          // ElevenLabs voice (lazy loaded with voice components)
          if (id.includes('elevenlabs') || id.includes('@elevenlabs')) {
            return 'vendor-voice'
          }

          // Database and ORM (server-side focused)
          if (id.includes('drizzle-orm') || id.includes('better-sqlite3')) {
            return 'vendor-db'
          }

          // Vercel services (analytics, blob storage)
          if (id.includes('@vercel')) {
            return 'vendor-vercel'
          }

          // Express and server utilities
          if (id.includes('express') || id.includes('cors') || id.includes('express-jwt') || id.includes('express-rate-limit')) {
            return 'vendor-server'
          }

          // Utilities - Split into smaller chunks
          if (id.includes('fuse.js')) {
            return 'vendor-search'
          }
          if (id.includes('jszip')) {
            return 'vendor-zip'
          }
          if (id.includes('eventemitter3')) {
            return 'vendor-events'
          }
          if (id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'vendor-css-utils'
          }
          if (id.includes('jsonwebtoken') || id.includes('buffer') || id.includes('dotenv')) {
            return 'vendor-crypto-utils'
          }

          // Three.js mesh utilities (lazy loaded with 3D)
          if (id.includes('three-mesh-bvh')) {
            return 'vendor-three-utils'
          }

          // All other node_modules (should be much smaller now)
          if (id.includes('node_modules')) {
            // Log what's going into vendor-other to help debugging
            const match = id.match(/node_modules\/([^\/]+)/)
            if (match && process.env.VITE_DEBUG_CHUNKS) {
              console.log('[vendor-other]', match[1])
            }
            return 'vendor-other'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Advanced minification with Terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging in production
        drop_debugger: true, // Remove debugger statements
        pure_funcs: ['console.log', 'console.debug'], // Only remove log/debug, keep warn/error
        passes: 2 // Run compression multiple times for better results
      },
      mangle: {
        safari10: true // Fix Safari 10 issues
      },
      format: {
        comments: false // Remove all comments
      }
    },
    // Increase chunk size warning limit for better splitting
    reportCompressedSize: true,
    // Enable source maps for production debugging (optional)
    sourcemap: false
  },
  worker: {
    format: 'es',
    plugins: () => []
  },
  server: {
    port: 3000,
    strictPort: false, // Allow Vite to use next available port if 3000 is taken
    hmr: {
      clientPort: undefined // Let HMR auto-detect the correct port
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      }
    }
  }
})
