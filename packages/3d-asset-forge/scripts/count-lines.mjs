#!/usr/bin/env node

/**
 * Script to count lines of code in the project
 * Counts all JavaScript and TypeScript files, excluding dependencies and generated files
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

// File extensions to count
const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.cursor',
  'temp-images',
  'gdd-assets', // These are asset files, not code
]

// Files to exclude
const EXCLUDE_FILES = [
  'vite.config.ts', // Config files often have minimal custom code
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  '.env',
  '.env.local',
  '.env.example',
]

// Track statistics
const stats = {
  totalFiles: 0,
  totalLines: 0,
  totalBlankLines: 0,
  totalCommentLines: 0,
  totalCodeLines: 0,
  byExtension: {},
  byDirectory: {},
  largestFiles: []
}

/**
 * Check if a path should be excluded
 */
function shouldExclude(filePath) {
  const relativePath = path.relative(projectRoot, filePath)
  
  // Check if it's in an excluded directory
  for (const dir of EXCLUDE_DIRS) {
    if (relativePath.startsWith(dir) || relativePath.includes(`/${dir}/`)) {
      return true
    }
  }
  
  // Check if it's an excluded file
  const filename = path.basename(filePath)
  if (EXCLUDE_FILES.includes(filename)) {
    return true
  }
  
  return false
}

/**
 * Count lines in a file
 */
async function countFileLines(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    
    let blankLines = 0
    let commentLines = 0
    let codeLines = 0
    let inBlockComment = false
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Check for block comments
      if (trimmed.includes('/*')) {
        inBlockComment = true
      }
      
      if (inBlockComment) {
        commentLines++
        if (trimmed.includes('*/')) {
          inBlockComment = false
        }
      } else if (trimmed === '') {
        blankLines++
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        commentLines++
      } else {
        codeLines++
      }
    }
    
    return {
      total: lines.length,
      blank: blankLines,
      comment: commentLines,
      code: codeLines
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message)
    return { total: 0, blank: 0, comment: 0, code: 0 }
  }
}

/**
 * Process a directory recursively
 */
async function processDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      if (shouldExclude(fullPath)) {
        continue
      }
      
      if (entry.isDirectory()) {
        await processDirectory(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (CODE_EXTENSIONS.includes(ext)) {
          stats.totalFiles++
          
          const counts = await countFileLines(fullPath)
          stats.totalLines += counts.total
          stats.totalBlankLines += counts.blank
          stats.totalCommentLines += counts.comment
          stats.totalCodeLines += counts.code
          
          // Track by extension
          if (!stats.byExtension[ext]) {
            stats.byExtension[ext] = { files: 0, lines: 0, code: 0 }
          }
          stats.byExtension[ext].files++
          stats.byExtension[ext].lines += counts.total
          stats.byExtension[ext].code += counts.code
          
          // Track by directory
          const dir = path.relative(projectRoot, path.dirname(fullPath))
          const topDir = dir.split(path.sep)[0] || 'root'
          if (!stats.byDirectory[topDir]) {
            stats.byDirectory[topDir] = { files: 0, lines: 0, code: 0 }
          }
          stats.byDirectory[topDir].files++
          stats.byDirectory[topDir].lines += counts.total
          stats.byDirectory[topDir].code += counts.code
          
          // Track largest files
          stats.largestFiles.push({
            path: path.relative(projectRoot, fullPath),
            lines: counts.total,
            code: counts.code
          })
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error.message)
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Counting lines of code in the project...\n')
  
  const startTime = Date.now()
  await processDirectory(projectRoot)
  const endTime = Date.now()
  
  // Sort largest files
  stats.largestFiles.sort((a, b) => b.lines - a.lines)
  
  // Display results
  console.log('📊 PROJECT STATISTICS')
  console.log('=' .repeat(50))
  console.log(`Total files analyzed: ${formatNumber(stats.totalFiles)}`)
  console.log(`Total lines: ${formatNumber(stats.totalLines)}`)
  console.log(`  - Code lines: ${formatNumber(stats.totalCodeLines)} (${((stats.totalCodeLines / stats.totalLines) * 100).toFixed(1)}%)`)
  console.log(`  - Comment lines: ${formatNumber(stats.totalCommentLines)} (${((stats.totalCommentLines / stats.totalLines) * 100).toFixed(1)}%)`)
  console.log(`  - Blank lines: ${formatNumber(stats.totalBlankLines)} (${((stats.totalBlankLines / stats.totalLines) * 100).toFixed(1)}%)`)
  
  console.log('\n📁 BY FILE TYPE')
  console.log('=' .repeat(50))
  console.log('Extension  Files     Total Lines   Code Lines')
  console.log('-'.repeat(50))
  for (const [ext, data] of Object.entries(stats.byExtension)) {
    console.log(
      `${ext.padEnd(10)} ${data.files.toString().padEnd(9)} ${formatNumber(data.lines).padEnd(13)} ${formatNumber(data.code)}`
    )
  }
  
  console.log('\n📂 BY DIRECTORY')
  console.log('=' .repeat(50))
  console.log('Directory'.padEnd(20) + 'Files     Total Lines   Code Lines')
  console.log('-'.repeat(50))
  const sortedDirs = Object.entries(stats.byDirectory)
    .sort((a, b) => b[1].lines - a[1].lines)
  for (const [dir, data] of sortedDirs) {
    console.log(
      `${dir.padEnd(20)} ${data.files.toString().padEnd(9)} ${formatNumber(data.lines).padEnd(13)} ${formatNumber(data.code)}`
    )
  }
  
  console.log('\n📄 LARGEST FILES (Top 10)')
  console.log('=' .repeat(50))
  console.log('File'.padEnd(50) + 'Total   Code')
  console.log('-'.repeat(50))
  for (let i = 0; i < Math.min(10, stats.largestFiles.length); i++) {
    const file = stats.largestFiles[i]
    const displayPath = file.path.length > 48 ? '...' + file.path.slice(-45) : file.path
    console.log(
      `${displayPath.padEnd(50)} ${file.lines.toString().padEnd(7)} ${file.code}`
    )
  }
  
  console.log(`\n⏱️  Analysis completed in ${endTime - startTime}ms`)
  
  // Summary for quick reference
  console.log('\n✨ SUMMARY')
  console.log('=' .repeat(50))
  console.log(`This project contains ${formatNumber(stats.totalCodeLines)} lines of actual code`)
  console.log(`across ${formatNumber(stats.totalFiles)} files.`)
  
  const avgLinesPerFile = Math.round(stats.totalCodeLines / stats.totalFiles)
  console.log(`Average: ${avgLinesPerFile} lines of code per file`)
}

// Run the script
main().catch(console.error)