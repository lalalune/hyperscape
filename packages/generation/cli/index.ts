#!/usr/bin/env node

// Load environment variables
import 'dotenv/config'

/**
 * AI Creation CLI
 * Command-line interface for asset generation
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import * as fs from 'fs/promises'
import * as path from 'path'
import { AICreationService, GenerationRequest, defaultConfig } from '../src'
import { parseAssetType } from '../src/utils/helpers'

const program = new Command()

program
  .name('hyperscape-ai')
  .description('AI-powered asset generation for Hyperscape RPG')
  .version('1.0.0')

// Generate command
program
  .command('generate <description>')
  .description('Generate a single asset from description')
  .option('-t, --type <type>', 'Asset type (weapon, armor, character, etc)')
  .option('-s, --style <style>', 'Visual style (realistic, cartoon, low-poly)')
  .option('-n, --name <name>', 'Asset name')
  .option('--skip-image', 'Skip image generation and use existing image')
  .option('--image-url <url>', 'Use existing image URL')
  .action(async (description, options) => {
    const spinner = ora('Initializing AI Creation Service...').start()
    
    try {
      // Load config
      const config = await loadConfig()
      const service = new AICreationService(config)
      
      // Prepare request
      const request: GenerationRequest = {
        id: Date.now().toString(),
        name: options.name || description.slice(0, 30),
        description,
        type: options.type || parseAssetType(description) as any,
        style: options.style
      }
      
      spinner.text = 'Starting generation pipeline...'
      
      // Listen to events
      service.on('stage-start', ({ stage }) => {
        spinner.text = `Processing stage: ${stage}`
      })
      
      service.on('stage-complete', ({ stage }) => {
        spinner.succeed(`Completed stage: ${stage}`)
        spinner.start('Continuing...')
      })
      
      // Generate
      const result = await service.generate(request)
      
      spinner.succeed('Asset generation complete!')
      
      // Display results
      console.log(chalk.green('\n✅ Generation successful!'))
      console.log(chalk.gray('ID:'), result.id)
      console.log(chalk.gray('Name:'), result.request.name)
      console.log(chalk.gray('Type:'), result.request.type)
      
      if (result.finalAsset) {
        console.log(chalk.gray('Output:'), result.finalAsset.modelUrl)
      }
      
      // Display stage summary
      console.log(chalk.blue('\n📊 Stage Summary:'))
      for (const stage of result.stages) {
        const icon = stage.status === 'completed' ? '✅' : '❌'
        console.log(`  ${icon} ${stage.stage}: ${stage.status}`)
      }
      
    } catch (error) {
      spinner.fail('Generation failed!')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Batch command
program
  .command('batch <file>')
  .description('Generate multiple assets from JSON file')
  .option('--parallel <count>', 'Number of parallel generations', '5')
  .action(async (file, options) => {
    const spinner = ora('Loading batch file...').start()
    
    try {
      // Load batch file
      const content = await fs.readFile(file, 'utf-8')
      const items = JSON.parse(content)
      
      if (!Array.isArray(items)) {
        throw new Error('Batch file must contain an array of items')
      }
      
      spinner.succeed(`Loaded ${items.length} items`)
      
      // Load config and create service
      const config = await loadConfig()
      const service = new AICreationService(config)
      
      // Prepare requests
      const requests: GenerationRequest[] = items.map((item, index) => ({
        id: `batch-${Date.now()}-${index}`,
        name: item.name || item.description.slice(0, 30),
        description: item.description,
        type: item.type || parseAssetType(item.description) as any,
        style: item.style,
        metadata: item.metadata
      }))
      
      // Progress tracking
      let completed = 0
      service.on('complete', () => {
        completed++
        spinner.text = `Progress: ${completed}/${items.length}`
      })
      
      spinner.start('Starting batch generation...')
      
      // Generate
      const results = await service.batchGenerate(requests)
      
      spinner.succeed(`Batch generation complete! ${results.length} assets generated`)
      
      // Save summary
      const summary = {
        total: items.length,
        successful: results.filter(r => r.stages.every(s => s.status === 'completed')).length,
        failed: results.filter(r => r.stages.some(s => s.status === 'failed')).length,
        results: results.map(r => ({
          id: r.id,
          name: r.request.name,
          type: r.request.type,
          status: r.stages.every(s => s.status === 'completed') ? 'success' : 'failed',
          output: r.finalAsset?.modelUrl
        }))
      }
      
      const summaryPath = `batch-summary-${Date.now()}.json`
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))
      
      console.log(chalk.green(`\n📄 Summary saved to: ${summaryPath}`))
      
    } catch (error) {
      spinner.fail('Batch generation failed!')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Regenerate command
program
  .command('regenerate <id> <stage>')
  .description('Regenerate a specific stage of an existing generation')
  .action(async (id, stage) => {
    const spinner = ora('Loading generation...').start()
    
    try {
      const config = await loadConfig()
      const service = new AICreationService(config)
      
      // Listen to events
      service.on('stage-start', ({ stage }) => {
        spinner.text = `Processing stage: ${stage}`
      })
      
      service.on('stage-complete', ({ stage }) => {
        spinner.succeed(`Completed stage: ${stage}`)
        spinner.start('Continuing...')
      })
      
      // Regenerate
      const result = await service.regenerateStage(id, stage)
      
      spinner.succeed('Regeneration complete!')
      
      console.log(chalk.green('\n✅ Regeneration successful!'))
      console.log(chalk.gray('Output:'), result.finalAsset?.modelUrl)
      
    } catch (error) {
      spinner.fail('Regeneration failed!')
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Config command
program
  .command('config')
  .description('Show current configuration')
  .action(async () => {
    try {
      const config = await loadConfig()
      console.log(chalk.blue('Current Configuration:'))
      console.log(JSON.stringify(config, null, 2))
    } catch (error) {
      console.error(chalk.red('Error loading config:'), error)
    }
  })

// Viewer command
program
  .command('viewer')
  .description('Start the interactive viewer')
  .option('-p, --port <port>', 'Port to run viewer on', '3000')
  .action(async (options) => {
    console.log(chalk.blue(`Starting viewer on port ${options.port}...`))
    console.log(chalk.gray('Visit http://localhost:' + options.port))
    
    // Import and start viewer
    const { startViewer } = await import('../viewer/server')
    startViewer(parseInt(options.port))
  })

// Helper function to load config
async function loadConfig() {
  // Check for config file
  const configPath = path.join(process.cwd(), 'ai-creation.config.json')
  
  try {
    const configFile = await fs.readFile(configPath, 'utf-8')
    const fileConfig = JSON.parse(configFile)
    
    // Merge with defaults and env vars
    return {
      ...defaultConfig,
      ...fileConfig,
      openai: {
        ...defaultConfig.openai,
        ...fileConfig.openai,
        apiKey: process.env.OPENAI_API_KEY || fileConfig.openai?.apiKey || defaultConfig.openai.apiKey
      },
      meshy: {
        ...defaultConfig.meshy,
        ...fileConfig.meshy,
        apiKey: process.env.MESHY_API_KEY || fileConfig.meshy?.apiKey || defaultConfig.meshy.apiKey
      }
    }
  } catch {
    // Use defaults with env vars
    return {
      ...defaultConfig,
      openai: {
        ...defaultConfig.openai,
        apiKey: process.env.OPENAI_API_KEY || defaultConfig.openai.apiKey
      },
      meshy: {
        ...defaultConfig.meshy,
        apiKey: process.env.MESHY_API_KEY || defaultConfig.meshy.apiKey
      }
    }
  }
}

// Parse and run
program.parse() 