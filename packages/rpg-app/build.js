import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'

// Create dist directory
if (!existsSync('dist')) {
  mkdirSync('dist')
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
    
    // Build with Bun
    const result = await Bun.build({
      entrypoints: ['./src/index.js'],
      outdir: './dist',
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
      'dist/manifest.json',
      JSON.stringify(manifest, null, 2)
    )
    
    // Create bundle metadata
    const bundleMeta = {
      version: manifest.version,
      buildTime: new Date().toISOString(),
      size: statSync('dist/bundle.js').size
    }
    
    writeFileSync(
      'dist/bundle.meta.json',
      JSON.stringify(bundleMeta, null, 2)
    )
    
    console.log('✅ Build complete!')
    console.log(`   Bundle size: ${(bundleMeta.size / 1024).toFixed(2)} KB`)
    console.log(`   Output: dist/`)
    
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

build() 