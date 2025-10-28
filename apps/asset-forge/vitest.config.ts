import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      'node_modules',
      'dist',
      'build',
      'src/services/__tests__/WebGLRendererPool.test.ts',
      'src/services/__tests__/BufferPool.test.ts',
      'src/services/__tests__/ArmorFittingService.test.ts',
    ],
    environmentOptions: {
      jsdom: {
        resources: 'usable'
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/types/',
        'src/workers/', // Out of scope
        'src/components/ArmorFitting/', // Out of scope (3D)
        'src/components/HandRigging/', // Out of scope (3D)
        'src/components/Equipment/', // Out of scope (3D)
        'src/components/shared/ThreeViewer/', // Out of scope (3D)
        'src/services/fitting/', // Out of scope (3D)
        'src/services/hand-rigging/', // Out of scope (3D)
        'src/services/processing/', // Out of scope (3D)
        'src/services/WebGLRendererPool.ts', // Out of scope (3D)
        'src/services/BufferPool.ts', // Out of scope (3D)
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})

