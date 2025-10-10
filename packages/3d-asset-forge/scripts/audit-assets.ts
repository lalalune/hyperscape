#!/usr/bin/env ts-node

/**
 * Asset Audit Script
 * Scans all assets in gdd-assets/ and reports on metadata consistency
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import { AssetMetadata, isBaseAsset, isVariantAsset, validateBaseAsset } from '../src/types/AssetMetadata'

interface AuditReport {
  totalAssets: number
  baseModels: {
    total: number
    withMeshyTaskId: number
    withoutMeshyTaskId: string[]
    withVariants: number
  }
  variants: {
    total: number
    orphaned: string[]
    missingParent: string[]
  }
  issues: {
    missingMetadata: string[]
    invalidMetadata: string[]
    missingFiles: string[]
    inconsistentData: string[]
  }
  recommendations: string[]
}

async function auditAssets(): Promise<AuditReport> {
  const assetsDir = join(process.cwd(), 'gdd-assets')
  const report: AuditReport = {
    totalAssets: 0,
    baseModels: {
      total: 0,
      withMeshyTaskId: 0,
      withoutMeshyTaskId: [],
      withVariants: 0
    },
    variants: {
      total: 0,
      orphaned: [],
      missingParent: []
    },
    issues: {
      missingMetadata: [],
      invalidMetadata: [],
      missingFiles: [],
      inconsistentData: []
    },
    recommendations: []
  }

  console.log(chalk.cyan('🔍 Starting Asset Audit'))
  console.log(chalk.cyan('=' .repeat(50)))

  // Get all asset directories
  const assetDirs = await fs.readdir(assetsDir)
  const allMetadata: Map<string, AssetMetadata> = new Map()

  // First pass: collect all metadata
  for (const assetId of assetDirs) {
    const assetPath = join(assetsDir, assetId)
    const stat = await fs.stat(assetPath)
    
    if (!stat.isDirectory()) continue
    
    report.totalAssets++
    
    // Check for metadata.json
    const metadataPath = join(assetPath, 'metadata.json')
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent) as AssetMetadata
      
      allMetadata.set(assetId, metadata)
      
      // Analyze base models
      if (isBaseAsset(metadata)) {
        report.baseModels.total++
        
        if (metadata.meshyTaskId) {
          report.baseModels.withMeshyTaskId++
        } else {
          report.baseModels.withoutMeshyTaskId.push(assetId)
        }
        
        if (metadata.variants && metadata.variants.length > 0) {
          report.baseModels.withVariants++
        }
      }
      
      // Analyze variants
      if (isVariantAsset(metadata)) {
        report.variants.total++
      }
      
      // Check files
      const modelFile = metadata.modelPath || `${assetId}.glb`
      const modelPath = join(assetPath, modelFile)
      try {
        await fs.access(modelPath)
      } catch {
        report.issues.missingFiles.push(`${assetId}: Missing model file ${modelFile}`)
      }
      
    } catch (error) {
      const isNodeError = error instanceof Error && 'code' in error
      if (isNodeError && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        report.issues.missingMetadata.push(assetId)
      } else {
        report.issues.invalidMetadata.push(`${assetId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // Second pass: validate relationships
  for (const [assetId, metadata] of allMetadata.entries()) {
    if (isVariantAsset(metadata)) {
      // Check if parent exists
      if (!allMetadata.has(metadata.parentBaseModel)) {
        report.variants.missingParent.push(`${assetId} -> ${metadata.parentBaseModel}`)
      }
    }
    
    if (isBaseAsset(metadata)) {
      // Check if listed variants exist
      for (const variantId of metadata.variants || []) {
        if (!allMetadata.has(variantId)) {
          report.variants.orphaned.push(`${assetId} lists non-existent variant: ${variantId}`)
        }
      }
    }
    
    // Check for inconsistencies
    if (metadata.isBaseModel && metadata.isVariant) {
      report.issues.inconsistentData.push(`${assetId}: Both isBaseModel and isVariant are true`)
    }
    
    if (!metadata.id || metadata.id !== assetId) {
      report.issues.inconsistentData.push(`${assetId}: ID mismatch (${metadata.id})`)
    }
  }

  // Generate recommendations
  if (report.baseModels.withoutMeshyTaskId.length > 0) {
    report.recommendations.push(
      `${report.baseModels.withoutMeshyTaskId.length} base models need meshyTaskId for retexturing capability`
    )
  }
  
  if (report.issues.missingMetadata.length > 0) {
    report.recommendations.push(
      `${report.issues.missingMetadata.length} assets are missing metadata.json files`
    )
  }
  
  if (report.variants.missingParent.length > 0) {
    report.recommendations.push(
      `${report.variants.missingParent.length} variants reference non-existent parent models`
    )
  }

  return report
}

async function printReport(report: AuditReport) {
  console.log('\n' + chalk.blue('📊 Audit Summary'))
  console.log(chalk.gray('-'.repeat(50)))
  
  console.log(chalk.white(`Total Assets: ${report.totalAssets}`))
  console.log(chalk.white(`Base Models: ${report.baseModels.total}`))
  console.log(chalk.green(`  ✓ With meshyTaskId: ${report.baseModels.withMeshyTaskId}`))
  console.log(chalk.red(`  ✗ Without meshyTaskId: ${report.baseModels.withoutMeshyTaskId.length}`))
  console.log(chalk.white(`  With variants: ${report.baseModels.withVariants}`))
  console.log(chalk.white(`Variants: ${report.variants.total}`))
  
  if (report.baseModels.withoutMeshyTaskId.length > 0) {
    console.log('\n' + chalk.yellow('⚠️  Base Models Without meshyTaskId:'))
    report.baseModels.withoutMeshyTaskId.forEach(id => {
      console.log(chalk.yellow(`  - ${id}`))
    })
  }
  
  if (report.issues.missingMetadata.length > 0) {
    console.log('\n' + chalk.red('❌ Missing Metadata:'))
    report.issues.missingMetadata.forEach(id => {
      console.log(chalk.red(`  - ${id}`))
    })
  }
  
  if (report.issues.invalidMetadata.length > 0) {
    console.log('\n' + chalk.red('❌ Invalid Metadata:'))
    report.issues.invalidMetadata.forEach(msg => {
      console.log(chalk.red(`  - ${msg}`))
    })
  }
  
  if (report.issues.missingFiles.length > 0) {
    console.log('\n' + chalk.red('❌ Missing Files:'))
    report.issues.missingFiles.forEach(msg => {
      console.log(chalk.red(`  - ${msg}`))
    })
  }
  
  if (report.variants.missingParent.length > 0) {
    console.log('\n' + chalk.red('❌ Variants with Missing Parents:'))
    report.variants.missingParent.forEach(msg => {
      console.log(chalk.red(`  - ${msg}`))
    })
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n' + chalk.cyan('💡 Recommendations:'))
    report.recommendations.forEach(rec => {
      console.log(chalk.cyan(`  • ${rec}`))
    })
  }
  
  // Save report as JSON
  const reportPath = join(process.cwd(), 'asset-audit-report.json')
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log('\n' + chalk.green(`✅ Full report saved to: ${reportPath}`))
}

// Run the audit
async function main() {
  try {
    const report = await auditAssets()
    await printReport(report)
  } catch (error) {
    console.error(chalk.red('❌ Audit failed:'), error)
    process.exit(1)
  }
}

main() 