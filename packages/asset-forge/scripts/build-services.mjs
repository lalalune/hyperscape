#!/usr/bin/env node

/**
 * Build script to compile TypeScript services for server-side use
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

console.log('🔨 Building TypeScript services...')

// Ensure dist directory exists
const distDir = join(process.cwd(), 'dist')
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

// Create a temporary tsconfig for building services
const buildConfig = {
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "es2022",
    "moduleResolution": "node",
    "target": "es2022",
    "outDir": "./dist",
    "rootDir": "./src",
    "allowJs": true,
    "checkJs": false,
    "isolatedModules": false,
    "skipLibCheck": true
  },
  "include": [
    "src/core/**/*",
    "src/services/**/*",
    "src/types/**/*",
    "src/utils/**/*",
    "src/config/**/*"
  ],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}

const configPath = join(process.cwd(), 'tsconfig.services.json')

try {
  // Write temporary config
  writeFileSync(configPath, JSON.stringify(buildConfig, null, 2))
  
  // Compile using the specific config
  execSync(`npx tsc -p ${configPath}`, {
    stdio: 'inherit'
  })
  
  console.log('✅ TypeScript services built successfully!')
} catch (error) {
  console.error('❌ Build failed:', error)
  process.exit(1)
} finally {
  // Clean up temporary config
  try {
    const { unlinkSync } = await import('fs')
    unlinkSync(configPath)
  } catch (e) {
    // Ignore cleanup errors
  }
} 