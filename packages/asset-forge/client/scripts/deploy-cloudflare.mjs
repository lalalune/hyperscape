#!/usr/bin/env node
/**
 * Deploy Hyperscape Client to Cloudflare Pages
 * Builds the client and deploys to global edge network
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const PROJECT_NAME = process.env.CLOUDFLARE_PROJECT_NAME || 'hyperscape-client'
const PRODUCTION = process.argv.includes('--production')

async function main() {
  console.log('🚀 Deploying Hyperscape Client to Cloudflare Pages')
  console.log(`   Project: ${PROJECT_NAME}`)
  console.log(`   Environment: ${PRODUCTION ? 'Production' : 'Preview'}`)
  
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
      console.log(`\n📡 Production URL: https://${PROJECT_NAME}.pages.dev`)
      console.log('   Configure custom domain in Cloudflare dashboard')
    } else {
      console.log(`\n📡 Preview URL: Check output above`)
    }
    
    console.log('\n📝 Next steps:')
    console.log('   1. Go to Cloudflare Pages dashboard')
    console.log('   2. Settings → Environment variables')
    console.log('   3. Add:')
    console.log('      PUBLIC_WS_URL=wss://game.yourgame.com/ws')
    console.log('      PUBLIC_CDN_URL=https://pub-your-id.r2.dev')
    console.log('      PUBLIC_PRIVY_APP_ID=your-privy-app-id')
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message)
    console.log('\n💡 Make sure you have:')
    console.log('   1. Installed Wrangler: npm install -g wrangler')
    console.log('   2. Logged in: wrangler login')
    console.log('   3. Created project: wrangler pages project create ' + PROJECT_NAME)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Deploy script failed:', error)
  process.exit(1)
})

