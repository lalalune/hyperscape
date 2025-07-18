import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
// Remove the problematic plugin
// import { nodePolyfills } from 'vite-plugin-node-polyfills'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Custom plugin to inject process polyfill
const processPolyfillPlugin = () => ({
  name: 'process-polyfill',
  transform(code: string, id: string) {
    if (id.includes('node_modules') || !id.includes('/src/') || id.includes('.html')) {
      return null
    }
    // Only inject into TypeScript/JavaScript files, not HTML
    if (!id.endsWith('.ts') && !id.endsWith('.tsx') && !id.endsWith('.js') && !id.endsWith('.jsx')) {
      return null
    }
    // Inject process polyfill at the top of each module
    return {
      code: `
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: { NODE_ENV: 'development' },
    platform: '',
    versions: {},
    version: ''
  };
}
${code}`,
      map: null,
    }
  },
})

// Custom plugin to handle particles path injection
const particlesPathPlugin = () => ({
  name: 'particles-path',
  writeBundle(options: any, bundle: any) {
    // Find the particles entry file
    const particlesFile = Object.keys(bundle).find(key => key.includes('particles') && key.endsWith('.js'))

    if (particlesFile) {
      // Update the HTML file to use the correct particles path
      const htmlPath = path.join(options.dir, 'index.html')

      if (fs.existsSync(htmlPath)) {
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8')
        htmlContent = htmlContent.replace(
          "window.PARTICLES_PATH = '/client-assets/particles.js';",
          `window.PARTICLES_PATH = '/${particlesFile}';`
        )
        fs.writeFileSync(htmlPath, htmlContent)
      }
    }
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    // Remove nodePolyfills plugin that's causing issues
    processPolyfillPlugin(), 
    particlesPathPlugin()
  ],

  // Define which env variables are exposed to client
  envPrefix: 'PUBLIC_', // Only expose env vars starting with PUBLIC_

  root: path.resolve(__dirname, 'src/client'),
  publicDir: 'public',

  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    target: 'esnext', // Support top-level await
    assetsDir: 'client-assets', // Use a different directory to avoid conflicts with world assets
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/client/index.html'),
        particles: path.resolve(__dirname, 'src/client/particles.ts'),
      },
      output: {
        entryFileNames: chunkInfo => {
          if (chunkInfo.name === 'particles') {
            return 'client-assets/particles-[hash].js'
          }
          return 'client-assets/[name]-[hash].js'
        },
      },
    },
  },

  esbuild: {
    target: 'esnext', // Support top-level await
  },

  define: {
    // Provide global process object for libraries that check for it
    'global.process': JSON.stringify({
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
      platform: '',
      versions: {},
      version: '',
    }),
    // Also define individual properties for direct access
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // Define process globally
    'process.env': JSON.stringify({ NODE_ENV: process.env.NODE_ENV || 'development' }),
    'process.platform': JSON.stringify(''),
    'process.versions': JSON.stringify({}),
    'process.version': JSON.stringify(''),
    // Define global if needed
    'global': 'globalThis',
  },

  server: {
    port: Number(process.env.VITE_PORT) || 4445,
    open: false,
    host: true,
    // These will be configured in the dev script
  },

  worker: {
    format: 'es',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@client': path.resolve('./src/client'),
      '@core': path.resolve('./src/core'),
      '@types': path.resolve('./src/types'),
    },
    dedupe: ['three', 'react', 'react-dom'],
  },

  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['three'],
    esbuildOptions: {
      target: 'esnext', // Support top-level await
    },
  },
})
