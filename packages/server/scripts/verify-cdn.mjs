#!/usr/bin/env node
/**
 * CDN Verification Script
 * Tests that the Docker CDN is properly serving all asset types
 */

const CDN_URL = process.env.PUBLIC_CDN_URL || 'http://localhost:8080'

const tests = [
  { name: 'Health Check', url: `${CDN_URL}/health`, expect: '200' },
  { name: 'Music (Normal)', url: `${CDN_URL}/audio/music/normal/1.mp3`, expect: '200' },
  { name: 'Music (Combat)', url: `${CDN_URL}/audio/music/combat/1.mp3`, expect: '200' },
  { name: 'Manifest', url: `${CDN_URL}/manifests/music.json`, expect: '200' },
  { name: 'Environment Model', url: `${CDN_URL}/world/base-environment.glb`, expect: '200' },
  { name: 'Environment Texture', url: `${CDN_URL}/world/day2-2k.jpg`, expect: '200' },
]

console.log(`\n🧪 Testing CDN at: ${CDN_URL}\n`)

let passed = 0
let failed = 0

for (const test of tests) {
  try {
    const response = await fetch(test.url, { method: 'HEAD' })
    const status = response.status.toString()
    
    if (status.startsWith(test.expect)) {
      console.log(`✅ ${test.name}: ${status}`)
      passed++
    } else {
      console.log(`❌ ${test.name}: ${status} (expected ${test.expect})`)
      failed++
    }
  } catch (error) {
    console.log(`❌ ${test.name}: ${error.message}`)
    failed++
  }
}

console.log(`\n📊 Results: ${passed}/${tests.length} tests passed\n`)

if (failed > 0) {
  console.log('⚠️  Some tests failed. Check:')
  console.log('  1. Docker CDN is running: docker ps | grep hyperia-cdn')
  console.log('  2. Assets exist: ls world/assets/music/normal/')
  console.log('  3. CDN logs: bun run cdn:logs')
  process.exit(1)
}

console.log('🎉 CDN is working perfectly!')
process.exit(0)

