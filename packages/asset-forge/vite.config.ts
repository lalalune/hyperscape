import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'three', '@react-three/fiber', '@react-three/drei'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'three', 'three-stdlib', '@react-three/fiber', '@react-three/drei'],
    exclude: ['three/examples'],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.jsx', '.json', '.ts', '.tsx']
    }
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress fs externalization warning (only used server-side via dynamic import)
        if (warning.message && warning.message.includes('Module "fs" has been externalized')) {
          return
        }
        // Suppress mixed static/dynamic import warnings (intentional for code-splitting)
        if (warning.message && warning.message.includes('dynamically imported') && warning.message.includes('statically imported')) {
          return
        }
        warn(warning)
      }
    }
  },
  server: {
    port: 5006,
    proxy: {
      '/api': {
        target: 'http://localhost:5004',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:5004',
        changeOrigin: true,
      }
    }
  }
})
