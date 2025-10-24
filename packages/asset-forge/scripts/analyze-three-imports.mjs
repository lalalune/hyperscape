#!/usr/bin/env node

/**
 * Three.js Import Analyzer
 * Scans all files using namespace imports and extracts used THREE.* classes
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.join(__dirname, '../src')

// Find all files with THREE imports
const filesWithThreeImports = []

function findThreeImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      findThreeImports(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      if (content.includes('import * as THREE from')) {
        filesWithThreeImports.push(fullPath)
      }
    }
  }
}

findThreeImports(SRC_DIR)

console.log(`Found ${filesWithThreeImports.length} files with THREE namespace imports\n`)

// Extract THREE.* usage patterns
const threeUsageMap = new Map()

for (const filePath of filesWithThreeImports) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = path.relative(path.join(__dirname, '..'), filePath)

  // Find all THREE.ClassName patterns
  const threePattern = /THREE\.([A-Z][a-zA-Z0-9_]*)/g
  const matches = [...content.matchAll(threePattern)]

  const usedClasses = new Set(matches.map(m => m[1]))

  if (usedClasses.size > 0) {
    threeUsageMap.set(relativePath, Array.from(usedClasses).sort())
  }
}

// Generate report
console.log('='.repeat(80))
console.log('THREE.JS IMPORT OPTIMIZATION ANALYSIS')
console.log('='.repeat(80))
console.log()

// Count total unique classes used
const allClasses = new Set()
for (const classes of threeUsageMap.values()) {
  classes.forEach(c => allClasses.add(c))
}

console.log(`Total files analyzed: ${threeUsageMap.size}`)
console.log(`Total unique THREE classes used: ${allClasses.size}`)
console.log()

// Most commonly used classes
const classFrequency = new Map()
for (const classes of threeUsageMap.values()) {
  classes.forEach(c => {
    classFrequency.set(c, (classFrequency.get(c) || 0) + 1)
  })
}

const sortedByFrequency = Array.from(classFrequency.entries())
  .sort((a, b) => b[1] - a[1])

console.log('Most commonly used THREE classes:')
console.log('-'.repeat(50))
sortedByFrequency.slice(0, 20).forEach(([className, count]) => {
  console.log(`  ${className.padEnd(30)} ${count} files`)
})
console.log()

// Generate JSON report for programmatic use
const report = {
  totalFiles: threeUsageMap.size,
  totalClasses: allClasses.size,
  classFrequency: Object.fromEntries(sortedByFrequency),
  fileUsage: Object.fromEntries(threeUsageMap),
  allClasses: Array.from(allClasses).sort()
}

const reportPath = path.join(__dirname, '../data/three-import-analysis.json')
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log(`Full report saved to: ${reportPath}`)
console.log()

// Sample conversion for top 5 files
console.log('Sample files for conversion (by class count):')
console.log('-'.repeat(50))
const sortedFiles = Array.from(threeUsageMap.entries())
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 5)

sortedFiles.forEach(([file, classes]) => {
  console.log(`\n${file}`)
  console.log(`  Classes used (${classes.length}): ${classes.join(', ')}`)
})
