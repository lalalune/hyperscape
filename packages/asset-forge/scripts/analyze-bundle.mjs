#!/usr/bin/env node
/**
 * Bundle Analysis Script
 * Analyzes Vite build output and generates a detailed report
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distDir = path.join(__dirname, '..', 'dist', 'assets')

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function analyzeBundle() {
  if (!fs.existsSync(distDir)) {
    console.error('❌ Dist directory not found. Please run `npm run build` first.')
    process.exit(1)
  }

  const files = fs.readdirSync(distDir)
  const jsFiles = files.filter(f => f.endsWith('.js'))
  const cssFiles = files.filter(f => f.endsWith('.css'))

  console.log('\n📊 Bundle Analysis Report\n')
  console.log('=' .repeat(80))

  // Analyze JS files
  console.log('\n📦 JavaScript Bundles:\n')
  const jsStats = jsFiles.map(file => {
    const filepath = path.join(distDir, file)
    const stat = fs.statSync(filepath)
    return { name: file, size: stat.size }
  }).sort((a, b) => b.size - a.size)

  let totalJsSize = 0
  jsStats.forEach(({ name, size }) => {
    totalJsSize += size
    const barLength = Math.min(Math.floor(size / 10000), 50)
    const bar = '█'.repeat(barLength)
    console.log(`  ${name.padEnd(40)} ${formatBytes(size).padStart(10)} ${bar}`)
  })

  // Analyze CSS files
  console.log('\n🎨 CSS Bundles:\n')
  const cssStats = cssFiles.map(file => {
    const filepath = path.join(distDir, file)
    const stat = fs.statSync(filepath)
    return { name: file, size: stat.size }
  }).sort((a, b) => b.size - a.size)

  let totalCssSize = 0
  cssStats.forEach(({ name, size }) => {
    totalCssSize += size
    const barLength = Math.min(Math.floor(size / 1000), 50)
    const bar = '█'.repeat(barLength)
    console.log(`  ${name.padEnd(40)} ${formatBytes(size).padStart(10)} ${bar}`)
  })

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Summary:\n')
  console.log(`  Total JavaScript: ${formatBytes(totalJsSize)}`)
  console.log(`  Total CSS:        ${formatBytes(totalCssSize)}`)
  console.log(`  Total Bundle:     ${formatBytes(totalJsSize + totalCssSize)}`)
  console.log(`  Number of JS files: ${jsFiles.length}`)
  console.log(`  Number of CSS files: ${cssFiles.length}`)

  // Identify largest bundles
  console.log('\n🎯 Largest Bundles (Top 5):\n')
  const top5 = jsStats.slice(0, 5)
  top5.forEach(({ name, size }, index) => {
    console.log(`  ${index + 1}. ${name} - ${formatBytes(size)}`)
  })

  // Check for optimization opportunities
  console.log('\n💡 Optimization Opportunities:\n')
  const largeChunks = jsStats.filter(({ size }) => size > 500000)
  if (largeChunks.length > 0) {
    console.log(`  ⚠️  Found ${largeChunks.length} chunk(s) larger than 500KB:`)
    largeChunks.forEach(({ name, size }) => {
      console.log(`     - ${name} (${formatBytes(size)}) - Consider code splitting`)
    })
  } else {
    console.log('  ✅ All chunks are under 500KB - Good job!')
  }

  // Check for compressed files
  const gzFiles = files.filter(f => f.endsWith('.gz'))
  const brFiles = files.filter(f => f.endsWith('.br'))
  console.log('\n📦 Compression:\n')
  console.log(`  Gzip files:    ${gzFiles.length}`)
  console.log(`  Brotli files:  ${brFiles.length}`)

  if (gzFiles.length === 0 && brFiles.length === 0) {
    console.log('  ⚠️  No compressed files found - compression may not be enabled')
  } else {
    console.log('  ✅ Compression enabled')
  }

  console.log('\n' + '='.repeat(80) + '\n')

  // Save to JSON
  const report = {
    timestamp: new Date().toISOString(),
    totalSize: totalJsSize + totalCssSize,
    javascript: {
      totalSize: totalJsSize,
      fileCount: jsFiles.length,
      files: jsStats
    },
    css: {
      totalSize: totalCssSize,
      fileCount: cssFiles.length,
      files: cssStats
    },
    compression: {
      gzip: gzFiles.length,
      brotli: brFiles.length
    }
  }

  const reportPath = path.join(__dirname, '..', 'bundle-analysis.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`📄 Detailed report saved to: ${reportPath}\n`)
}

analyzeBundle()
