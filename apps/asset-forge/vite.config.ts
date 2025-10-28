import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // Default API URL based on environment
  const apiUrl = env.VITE_API_URL || 'http://localhost:3004'

  console.log('='.repeat(60))
  console.log('[Vite Config] Environment:', mode)
  console.log('[Vite Config] API Proxy Target:', apiUrl)
  console.log('='.repeat(60))

  return {
  publicDir: 'public',
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    // Production compression only (gzip + brotli)
    ...(process.env.NODE_ENV === 'production' ? [
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240,  // Only compress files > 10KB
        deleteOriginFile: false
      }),
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false
      })
    ] : [])
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'three'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'buffer': 'buffer/'
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@react-three/fiber', '@react-three/drei', '@xyflow/react'],
    exclude: ['.eslintrc.cjs', 'tailwind.config.cjs', 'postcss.config.cjs'],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx']
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,  // Keep console for production debugging
        drop_debugger: true,  // Remove debugger statements
        pure_funcs: ['console.debug', 'console.log'], // Only drop debug/log, keep error/warn
        passes: 2
      },
      format: {
        comments: false
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000,
    strictPort: false,  // Allow next available port if 3000 is taken
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy] Error:', err.message)
            console.log('[Vite Proxy] Target was:', apiUrl)
          })
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('[Vite Proxy]', req.method, req.url, '→', apiUrl)
          })
        }
      }
    }
  }
  }
})
