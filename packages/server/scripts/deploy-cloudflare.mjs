#!/usr/bin/env node
/**
 * Deploy Hyperscape Server to Cloudflare Containers
 * Builds Docker image and deploys to Cloudflare's edge
 */

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

async function main() {
  console.log('🚀 Deploying Hyperscape Server to Cloudflare Containers')
  
  // 1. Build the server
  console.log('\n📦 Building server...')
  execSync('bun run build', { cwd: rootDir, stdio: 'inherit' })
  
  // 2. Verify wrangler.toml exists
  const wranglerPath = path.join(rootDir, 'wrangler.toml')
  if (!await fs.pathExists(wranglerPath)) {
    console.error('❌ wrangler.toml not found')
    console.log('💡 Make sure you are in packages/server directory')
    process.exit(1)
  }
  
  // 3. Deploy to Cloudflare
  console.log('\n🌐 Deploying to Cloudflare...')
  
  try {
    execSync('wrangler deploy', { cwd: rootDir, stdio: 'inherit' })
    
    console.log('\n✅ Server deployment successful!')
    console.log('\n📡 Your server is now running on Cloudflare!')
    console.log('   WebSocket: wss://hyperscape-server.your-subdomain.workers.dev/ws')
    console.log('   API: https://hyperscape-server.your-subdomain.workers.dev/api/*')
    
    console.log('\n📝 Next steps:')
    console.log('   1. Set secrets: wrangler secret put LIVEKIT_API_KEY')
    console.log('   2. Set secrets: wrangler secret put PRIVY_APP_SECRET')
    console.log('   3. Test WebSocket: wscat -c wss://your-worker-url/ws')
    console.log('   4. Update client PUBLIC_WS_URL to your worker URL')
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message)
    console.log('\n💡 Troubleshooting:')
    console.log('   1. Check wrangler.toml configuration')
    console.log('   2. Verify Docker is running (for container build)')
    console.log('   3. Ensure you are logged in: wrangler login')
    console.log('   4. Check container limits in dashboard')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Deploy script failed:', error)
  process.exit(1)
})

