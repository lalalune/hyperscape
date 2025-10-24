/**
 * Test Redis Connection
 */

import 'dotenv/config'
import { redis } from '../server/config/redis.mjs'

async function testRedis() {
  console.log('🔍 Testing Redis connection...\n')

  try {
    // Connect to Redis
    console.log('1. Connecting to Redis...')
    const connected = await redis.connect()

    if (!connected) {
      console.log('❌ Redis not configured (REDIS_URL not set)')
      return
    }

    console.log('✅ Connected to Redis\n')

    // Test cache operations
    console.log('2. Testing cache operations...')

    // Set a value
    await redis.cache.set('test-key', { message: 'Hello from Asset Forge!' }, 60)
    console.log('✅ Set cache value')

    // Get the value
    const value = await redis.cache.get('test-key')
    console.log('✅ Retrieved cache value:', value)

    // Check TTL
    const ttl = await redis.cache.ttl('test-key')
    console.log(`✅ TTL: ${ttl} seconds\n`)

    // Test rate limiting
    console.log('3. Testing rate limiting...')
    const limit = await redis.rateLimit.check('test-user', 5, 60)
    console.log('✅ Rate limit check:', {
      allowed: limit.allowed,
      remaining: limit.remaining,
      resetAt: new Date(limit.resetAt).toISOString()
    })
    console.log('')

    // Test session management
    console.log('4. Testing session management...')
    await redis.session.set('test-session', { userId: '123', email: 'test@example.com' }, 3600)
    console.log('✅ Set session')

    const session = await redis.session.get('test-session')
    console.log('✅ Retrieved session:', session)
    console.log('')

    // Cleanup
    console.log('5. Cleaning up test data...')
    await redis.cache.del('test-key')
    await redis.session.delete('test-session')
    await redis.rateLimit.reset('test-user')
    console.log('✅ Cleanup complete\n')

    console.log('🎉 All Redis tests passed!')

    // Disconnect
    await redis.disconnect()
    console.log('✅ Disconnected from Redis')

  } catch (error) {
    console.error('❌ Redis test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testRedis()
