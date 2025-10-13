import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Define which env variables are exposed to client
  envPrefix: 'PUBLIC_', // Only expose env vars starting with PUBLIC_
  
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
      onwarn(warning, warn) {
        // Suppress warnings about PURE annotations in ox library
        if (warning.code === 'SOURCEMAP_ERROR' || 
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
    'process.env': '{}', // Replace process.env with empty object (Privy reads env vars)
    global: 'globalThis', // Needed for some node polyfills in browser
    // Ensure Privy and Farcaster env vars are exposed
    'import.meta.env.PUBLIC_PRIVY_APP_ID': JSON.stringify(process.env.PUBLIC_PRIVY_APP_ID || ''),
    'import.meta.env.PUBLIC_ENABLE_FARCASTER': JSON.stringify(process.env.PUBLIC_ENABLE_FARCASTER || 'false'),
    'import.meta.env.PUBLIC_APP_URL': JSON.stringify(process.env.PUBLIC_APP_URL || ''),
    // API URL for backend endpoints (proxied through Vite in dev)
    'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL || ''),
    // CDN URL for static assets (separate from game server)
    'import.meta.env.PUBLIC_CDN_URL': JSON.stringify(process.env.PUBLIC_CDN_URL || 'http://localhost:8080'),
    'import.meta.env.PUBLIC_ASSETS_URL': JSON.stringify(process.env.PUBLIC_CDN_URL || 'http://localhost:8080'),
  },
  server: {
    port: Number(process.env.VITE_PORT) || 3333,
    open: false,
    host: true,
    // Silence noisy missing source map warnings for vendored libs
    sourcemapIgnoreList(relativeSourcePath, _sourcemapPath) {
      return /src\/libs\/(stats-gl|three-custom-shader-material)\//.test(relativeSourcePath)
    },
    proxy: {
      // Forward asset requests to CDN (Docker nginx in dev, S3/R2 in prod)
      '/world-assets': {
        target: process.env.PUBLIC_CDN_URL || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/world-assets/, ''),
      },
      // Expose server-provided public envs in dev
      '/env.js': {
        target: process.env.SERVER_ORIGIN || `http://localhost:${process.env.PORT || 5555}`,
        changeOrigin: true,
      },
      // Forward API endpoints to game server
      '/api': {
        target: process.env.SERVER_ORIGIN || `http://localhost:${process.env.PORT || 5555}`,
        changeOrigin: true,
      },
      // Forward WebSocket to game server
      '/ws': {
        target: (process.env.SERVER_ORIGIN?.replace('http', 'ws') || `ws://localhost:${process.env.PORT || 5555}`),
        ws: true,
        changeOrigin: true,
      },
    }
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
    include: ['three', 'react', 'react-dom', '@hyperscape/shared'],
    exclude: ['@playwright/test'], // Exclude Playwright from optimization
    esbuildOptions: {
      target: 'esnext', // Support top-level await
      define: {
        global: 'globalThis'
      }
    }
  },
  ssr: {
    noExternal: ['@hyperscape/shared']
  }
}) 