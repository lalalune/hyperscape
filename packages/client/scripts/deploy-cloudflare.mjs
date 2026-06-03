#!/usr/bin/env node
/**
 * Deploy Hyperia Client to Cloudflare Pages
 *
 * NOTE: Production deployments normally run via the GitHub Actions workflow.
 * This script is for manual/preview deployments or emergency production deploys.
 *
 * Production domains: https://hyperia.club, https://hyperia.gg
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// Project name matches Cloudflare Pages project
const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'hyperia'
const PRODUCTION = process.argv.includes('--production')

async function main() {
  console.log('🚀 Deploying Hyperia to Cloudflare Pages')
  console.log(`   Project: ${PROJECT_NAME}`)
  console.log(`   Environment: ${PRODUCTION ? 'Production' : 'Preview'}`)
  console.log('   Domains: https://hyperia.club, https://hyperia.gg')
  
  if (PRODUCTION) {
    console.log('\n⚠️  Note: Production deploys normally run from GitHub Actions.')
    console.log('   This will create a manual production deployment.\n')
  }
  
  // 1. Build client
  console.log('\n📦 Building client...')
  execSync('bun run build', { cwd: rootDir, stdio: 'inherit' })
  
  // 2. Verify build output
  const distDir = path.join(rootDir, 'dist')
  if (!await fs.pathExists(distDir)) {
    console.error('❌ Build failed - dist directory not found')
    process.exit(1)
  }
  
  const indexPath = path.join(distDir, 'index.html')
  if (!await fs.pathExists(indexPath)) {
    console.error('❌ Build failed - index.html not found')
    process.exit(1)
  }
  
  console.log('✅ Build complete')
  
  // 3. Deploy to Cloudflare Pages
  console.log('\n🌐 Deploying to Cloudflare Pages...')
  
  const deployCmd = PRODUCTION
    ? `wrangler pages deploy dist --project-name=${PROJECT_NAME} --branch=main`
    : `wrangler pages deploy dist --project-name=${PROJECT_NAME}`
  
  try {
    execSync(deployCmd, { cwd: rootDir, stdio: 'inherit' })
    console.log('\n✅ Deployment successful!')
    
    if (PRODUCTION) {
      console.log('\n📡 Production URLs: https://hyperia.club, https://hyperia.gg')
    } else {
      console.log(`\n📡 Preview URL: Check output above`)
    }
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message)
    console.log('\n💡 Make sure you have:')
    console.log('   1. Installed Wrangler: npm install -g wrangler')
    console.log('   2. Logged in: wrangler login')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Deploy script failed:', error)
  process.exit(1)
})
