import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()] as PluginOption[],
  
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
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
