import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.mjs'],
    include: [
      'server/**/__tests__/**/*.test.mjs',
      'src/**/__tests__/**/*.test.ts',
      'tests/unit/**/*.test.{ts,mjs}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'tests/e2e/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/utils/**/*.ts',
        'src/services/**/*.ts',
        'src/hooks/**/*.ts',
        'src/lib/**/*.ts',
        'server/services/**/*.mjs',
        'server/routes/**/*.mjs',
        'server/utils/**/*.mjs'
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.example.*',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/types/**',
        '**/constants/**',
        '**/config/**'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './server'),
      'three': path.resolve(__dirname, './node_modules/three')
    }
  }
})
