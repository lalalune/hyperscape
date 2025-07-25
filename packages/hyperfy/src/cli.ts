#!/usr/bin/env node

import { program } from 'commander'
import { resolve, join, dirname } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

program
  .name('hyperfy')
  .description('Hyperfy 3D multiplayer world engine')
  .version('1.0.0')

program
  .command('start')
  .description('Start a Hyperfy world server')
  .option('-w, --world <path>', 'Path to world directory', '.')
  .option('-p, --port <port>', 'Server port', '3333')
  .option('--dev', 'Run in development mode with file watching')
  .action(async (options) => {
    const worldPath = resolve(options.world)
    const port = parseInt(options.port, 10)
    
    // Validate world directory
    if (!existsSync(worldPath)) {
      console.error(`❌ World directory does not exist: ${worldPath}`)
      process.exit(1)
    }
    
    // Check for world.json or collections
    const worldJsonPath = join(worldPath, 'world.json')
    const collectionsPath = join(worldPath, 'collections')
    
    if (!existsSync(worldJsonPath) && !existsSync(collectionsPath)) {
      console.error(`❌ Invalid world directory: ${worldPath}`)
      console.error('World directory must contain either world.json or collections/ directory')
      process.exit(1)
    }
    
    console.log(`🚀 Starting Hyperfy server...`)
    console.log(`📁 World: ${worldPath}`)
    console.log(`🌐 Port: ${port}`)
    
    // Set environment variables
    process.env.WORLD = worldPath
    process.env.PORT = port.toString()
    
    if (options.dev) {
      console.log(`🔄 Development mode enabled`)
      process.env.NODE_ENV = 'development'
    }
    
    // Import and start the server
    try {
      await import('./server/index.js')
    } catch (error) {
      console.error('❌ Failed to start server:', error)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build Hyperfy for production')
  .option('-w, --world <path>', 'Path to world directory', '.')
  .action(async (options) => {
    const worldPath = resolve(options.world)
    
    console.log(`🔨 Building Hyperfy...`)
    console.log(`📁 World: ${worldPath}`)
    
    process.env.WORLD = worldPath
    
    try {
      const { execSync } = await import('child_process')
      const packageDir = resolve(__dirname, '..')
      execSync('npm run build', { stdio: 'inherit', cwd: packageDir })
    } catch (error) {
      console.error('❌ Build failed:', error)
      process.exit(1)
    }
  })

program
  .command('init <worldName>')
  .description('Initialize a new Hyperfy world')
  .action(async (worldName) => {
    const worldPath = resolve(worldName)
    
    if (existsSync(worldPath)) {
      console.error(`❌ Directory already exists: ${worldPath}`)
      process.exit(1)
    }
    
    console.log(`🆕 Creating new world: ${worldName}`)
    
    try {
      const { mkdirSync, writeFileSync, cpSync } = await import('fs')
      
      // Create directory structure
      mkdirSync(worldPath, { recursive: true })
      mkdirSync(join(worldPath, 'assets'), { recursive: true })
      mkdirSync(join(worldPath, 'collections', 'default'), { recursive: true })
      
      // Create world.json
      const worldConfig = {
        spawn: {
          position: [0, 2, 0],
          rotation: [0, 0, 0]
        }
      }
      writeFileSync(join(worldPath, 'world.json'), JSON.stringify(worldConfig, null, 2))
      
      // Create manifest.json
      const manifest = {
        name: worldName,
        description: `${worldName} world`,
        apps: []
      }
      writeFileSync(
        join(worldPath, 'collections', 'default', 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      )
      
      console.log(`✅ World created successfully: ${worldPath}`)
      console.log(`📁 Structure:`)
      console.log(`   ${worldName}/`)
      console.log(`   ├── world.json`)
      console.log(`   ├── assets/`)
      console.log(`   └── collections/`)
      console.log(`       └── default/`)
      console.log(`           └── manifest.json`)
      console.log(``)
      console.log(`🚀 Start your world with: hyperfy start --world ${worldName}`)
      
    } catch (error) {
      console.error('❌ Failed to create world:', error)
      process.exit(1)
    }
  })

program.parse()