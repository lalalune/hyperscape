import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'

// Create app-dist directory
if (!existsSync('app-dist')) {
  mkdirSync('app-dist')
}

// Create manifest.json
const manifest = {
  id: "hyperscape-rpg",
  name: "Hyperscape RPG",
  version: "1.0.0",
  description: "A modular RPG world for Hyperfy",
  main: "./bundle.js",
  type: "world",
  metadata: {
    author: "Hyperscape Team",
    tags: ["rpg", "game", "modular"],
    minHyperfyVersion: "1.0.0"
  }
}

// Build the app
async function build() {
  try {
    console.log('🏗️  Building Hyperfy RPG app...')
    
    // First, ensure TypeScript is compiled
    console.log('📦 Compiling TypeScript...')
    const { execSync } = await import('child_process')
    execSync('npm run build', { stdio: 'inherit' })
    
    // Build with Bun from the compiled JavaScript
    console.log('🔨 Building app bundle...')
    const result = await Bun.build({
      entrypoints: ['./dist/app.js'],
      outdir: './app-dist',
      target: 'browser',
      format: 'esm',
      minify: true,
      sourcemap: 'external',
      external: ['@hyperscape/hyperfy'],
      naming: {
        entry: 'bundle.js'
      }
    })
    
    if (!result.success) {
      throw new Error('Build failed')
    }
    
    // Write manifest
    writeFileSync(
      'app-dist/manifest.json',
      JSON.stringify(manifest, null, 2)
    )
    
    // Create bundle metadata
    const bundleMeta = {
      version: manifest.version,
      buildTime: new Date().toISOString(),
      size: statSync('app-dist/bundle.js').size
    }
    
    writeFileSync(
      'app-dist/bundle.meta.json',
      JSON.stringify(bundleMeta, null, 2)
    )
    
    console.log('✅ App build complete!')
    console.log(`   Bundle size: ${(bundleMeta.size / 1024).toFixed(2)} KB`)
    console.log(`   Output: app-dist/`)
    
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

build() 