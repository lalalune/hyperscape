#!/usr/bin/env node

/**
 * Three.js Import Converter
 * Automatically converts namespace imports to named imports
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load analysis report
const reportPath = path.join(__dirname, '../data/three-import-analysis.json')
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))

const convertedFiles = []
const errors = []

console.log('Starting Three.js import conversion...\n')

for (const [relativePath, classes] of Object.entries(report.fileUsage)) {
  const filePath = path.join(__dirname, '..', relativePath)

  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    const originalContent = content

    // Skip documentation files
    if (relativePath.includes('dev-book/')) {
      console.log(`⏭️  Skipping documentation: ${relativePath}`)
      continue
    }

    // Step 1: Replace the import statement
    const oldImport = /import \* as THREE from ['"]three['"]/
    const sortedClasses = classes.sort()

    // Split into multiple lines if too many imports
    let newImport
    if (sortedClasses.length > 8) {
      const lines = []
      for (let i = 0; i < sortedClasses.length; i += 8) {
        const chunk = sortedClasses.slice(i, i + 8)
        lines.push(chunk.join(', '))
      }
      newImport = `import {\n  ${lines.join(',\n  ')}\n} from 'three'`
    } else {
      newImport = `import { ${sortedClasses.join(', ')} } from 'three'`
    }

    content = content.replace(oldImport, newImport)

    // Step 2: Replace all THREE.ClassName with ClassName
    sortedClasses.forEach(className => {
      // Match THREE.ClassName but not in comments or strings
      const regex = new RegExp(`THREE\\.${className}\\b`, 'g')
      content = content.replace(regex, className)
    })

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8')
      convertedFiles.push({
        path: relativePath,
        classes: classes.length
      })
      console.log(`✅ Converted: ${relativePath} (${classes.length} classes)`)
    } else {
      console.log(`⏭️  No changes: ${relativePath}`)
    }

  } catch (error) {
    errors.push({
      path: relativePath,
      error: error.message
    })
    console.error(`❌ Error converting ${relativePath}: ${error.message}`)
  }
}

console.log('\n' + '='.repeat(80))
console.log('CONVERSION COMPLETE')
console.log('='.repeat(80))
console.log(`\nSuccessfully converted: ${convertedFiles.length} files`)
console.log(`Errors: ${errors.length} files`)

if (errors.length > 0) {
  console.log('\nErrors:')
  errors.forEach(({ path, error }) => {
    console.log(`  - ${path}: ${error}`)
  })
}

// Save conversion report
const conversionReport = {
  timestamp: new Date().toISOString(),
  filesConverted: convertedFiles.length,
  errors: errors.length,
  convertedFiles,
  errors
}

const conversionReportPath = path.join(__dirname, '../data/three-import-conversion-report.json')
fs.writeFileSync(conversionReportPath, JSON.stringify(conversionReport, null, 2))

console.log(`\nConversion report saved to: ${conversionReportPath}`)
