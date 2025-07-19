#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { config } from 'dotenv'
import { join } from 'path'
import { AICreationService } from '../core/AICreationService'
import { GDDAssetGenerator } from '../generators/GDDAssetGenerator'
import { ProgressTracker } from '../utils/ProgressTracker'
import { createAssetIntegrator } from '../integration/AssetIntegrator'

// Load environment variables
config({ path: join(__dirname, '../../../../../.env') })

const program = new Command()

program
  .name('hyperscape-generate')
  .description('AI-powered 3D asset generation for Hyperscape RPG')
  .version('1.0.0')

// Generate GDD assets command
program
  .command('generate-gdd')
  .description('Generate all assets from the Game Design Document')
  .option('-l, --limit <number>', 'Maximum number of assets to generate', '10')
  .option('-c, --continue', 'Continue from where last generation left off')
  .action(async (options) => {
    console.log(chalk.blue('🎮 Hyperscape RPG Asset Generation'))
    console.log(chalk.blue('=' .repeat(50)))
    
    try {
      const generator = new GDDAssetGenerator()
      const limit = parseInt(options.limit)
      
      if (options.continue) {
        console.log(chalk.yellow('🔄 Continuing from previous generation...'))
        await generator.continueGeneration(limit)
      } else {
        console.log(chalk.yellow('🆕 Starting fresh generation...'))
        await generator.generateAll(limit)
      }
      
      console.log(chalk.green('\n✅ Generation completed successfully!'))
      console.log(chalk.cyan('📊 Run "npm run progress" to see detailed progress'))
      
    } catch (error) {
      console.error(chalk.red('❌ Generation failed:'), error)
      process.exit(1)
    }
  })

// Generate single asset command
program
  .command('generate-single')
  .description('Generate the next single asset')
  .action(async () => {
    console.log(chalk.blue('🎯 Single Asset Generation'))
    console.log(chalk.blue('=' .repeat(30)))
    
    try {
      const generator = new GDDAssetGenerator()
      const result = await generator.generateNext()
      
      if (result.success) {
        console.log(chalk.green(`✅ Successfully generated: ${result.assetName}`))
        console.log(chalk.cyan(`📄 Size: ${result.fileSize}`))
        console.log(chalk.cyan(`🔄 Run again to generate the next asset`))
      } else {
        console.log(chalk.yellow('ℹ️  All assets already generated!'))
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Generation failed:'), error)
      process.exit(1)
    }
  })

// Continue generation command
program
  .command('generate-continue')
  .description('Continue generating remaining assets')
  .option('-b, --batch <number>', 'Batch size for generation', '5')
  .action(async (options) => {
    console.log(chalk.blue('🔄 Continue Asset Generation'))
    console.log(chalk.blue('=' .repeat(35)))
    
    try {
      const generator = new GDDAssetGenerator()
      const batchSize = parseInt(options.batch)
      
      await generator.continueGeneration(batchSize)
      
      console.log(chalk.green('\n✅ Batch generation completed!'))
      console.log(chalk.cyan('📊 Run "npm run progress" to see detailed progress'))
      
    } catch (error) {
      console.error(chalk.red('❌ Generation failed:'), error)
      process.exit(1)
    }
  })

// Progress command
program
  .command('progress')
  .description('Show generation progress and statistics')
  .action(async () => {
    console.log(chalk.blue('📊 Asset Generation Progress'))
    console.log(chalk.blue('=' .repeat(40)))
    
    try {
      const tracker = new ProgressTracker()
      const report = await tracker.generateReport()
      
      console.log(chalk.cyan('\n📈 Statistics:'))
      console.log(`  Total Assets: ${report.totalAssets}`)
      console.log(`  ${chalk.green('✅ Generated:')} ${report.generatedCount}`)
      console.log(`  ${chalk.red('❌ Failed:')} ${report.failedCount}`)
      console.log(`  ${chalk.yellow('⏳ Remaining:')} ${report.remainingCount}`)
      console.log(`  ${chalk.blue('📊 Success Rate:')} ${report.successRate}%`)
      
      console.log(chalk.cyan('\n💾 Storage:'))
      console.log(`  Total Size: ${report.totalSize}`)
      console.log(`  Average Size: ${report.averageSize}`)
      
      console.log(chalk.cyan('\n💰 Cost Estimate:'))
      console.log(`  Generated: $${report.generatedCost}`)
      console.log(`  Remaining: $${report.remainingCost}`)
      
      if (report.remainingAssets.length > 0) {
        console.log(chalk.cyan('\n⏳ Next Assets to Generate:'))
        report.remainingAssets.slice(0, 5).forEach(asset => {
          console.log(`  • ${asset.name} (${asset.type})`)
        })
        
        if (report.remainingAssets.length > 5) {
          console.log(`  ... and ${report.remainingAssets.length - 5} more`)
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to generate progress report:'), error)
      process.exit(1)
    }
  })

// Test command
program
  .command('test')
  .description('Run asset generation tests')
  .action(async () => {
    console.log(chalk.blue('🧪 Running Asset Generation Tests'))
    console.log(chalk.blue('=' .repeat(40)))
    
    try {
      // Import test runner
      const { runTests } = await import('../tests/test-runner')
      await runTests()
      
      console.log(chalk.green('\n✅ All tests passed!'))
      
    } catch (error) {
      console.error(chalk.red('❌ Tests failed:'), error)
      process.exit(1)
    }
  })

// Asset integration command
program
  .command('integrate')
  .description('Integrate generated assets into the RPG and Hyperfy packages')
  .option('-t, --test-mode', 'Enable test mode with cube proxies')
  .option('-p, --preserve', 'Preserve existing assets and .hyp files')
  .option('--no-cubes', 'Disable cube proxy generation')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (options) => {
    console.log(chalk.blue('🔧 Asset Integration Pipeline'))
    console.log(chalk.blue('=' .repeat(40)))
    
    try {
      const integrator = createAssetIntegrator({
        enableTestMode: options.testMode || false,
        createCubeProxies: options.cubes !== false,
        preserveExistingAssets: options.preserve || false
      })
      
      if (options.dryRun) {
        console.log(chalk.yellow('🏃 DRY RUN MODE - No changes will be made'))
        console.log(chalk.cyan('\nWould integrate the following assets:'))
        
        // Load and display asset mappings without executing
        const mappings = integrator.getAssetMappings()
        mappings.forEach(mapping => {
          console.log(`  • ${mapping.assetName} (${mapping.gameId})`)
        })
        
        console.log(chalk.cyan(`\nTotal assets to integrate: ${mappings.length}`))
        return
      }
      
      const result = await integrator.integrate()
      
      if (result.success) {
        console.log(chalk.green('\n🎉 Integration completed successfully!'))
        console.log(chalk.cyan('Assets are now ready for use in the RPG!'))
      } else {
        console.log(chalk.red('\n❌ Integration failed'))
        console.log(chalk.yellow('Check the logs above for details'))
        process.exit(1)
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Integration failed:'), error)
      process.exit(1)
    }
  })

// Asset manifest command
program
  .command('manifest')
  .description('Generate asset manifest without full integration')
  .action(async () => {
    console.log(chalk.blue('📜 Asset Manifest Generation'))
    console.log(chalk.blue('=' .repeat(40)))
    
    try {
      const integrator = createAssetIntegrator()
      const mappings = integrator.getAssetMappings()
      
      console.log(chalk.cyan(`\n📊 Asset Summary:`))
      console.log(`  Total Assets: ${mappings.length}`)
      
      // Group by type
      const byType = mappings.reduce((acc, mapping) => {
        acc[mapping.type] = (acc[mapping.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      console.log(chalk.cyan('\n📈 Assets by Type:'))
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`)
      })
      
      // Group by tier
      const byTier = mappings.reduce((acc, mapping) => {
        acc[mapping.tier] = (acc[mapping.tier] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      console.log(chalk.cyan('\n⚡ Assets by Tier:'))
      Object.entries(byTier).forEach(([tier, count]) => {
        console.log(`  ${tier}: ${count}`)
      })
      
      console.log(chalk.green('\n✅ Manifest generated successfully!'))
      
    } catch (error) {
      console.error(chalk.red('❌ Manifest generation failed:'), error)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}