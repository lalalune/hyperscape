/**
 * Buffer Pool Validation Script
 * Simple test runner to validate buffer pooling functionality
 */

import { BufferPool } from '../BufferPool.ts'

console.log('🧪 Starting Buffer Pool Validation Tests\n')

let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  if (condition) {
    passedTests++
    console.log(`✅ ${message}`)
  } else {
    failedTests++
    console.error(`❌ ${message}`)
  }
}

function assertEquals(actual, expected, message) {
  if (actual === expected) {
    passedTests++
    console.log(`✅ ${message}`)
  } else {
    failedTests++
    console.error(`❌ ${message}`)
    console.error(`   Expected: ${expected}`)
    console.error(`   Actual: ${actual}`)
  }
}

function testGroup(name, fn) {
  console.log(`\n📦 ${name}`)
  fn()
}

// Test 1: Basic Buffer Allocation
testGroup('Basic Buffer Allocation', () => {
  const pool = new BufferPool(10)

  const buffer1 = pool.acquire(100, 'Float32Array')
  assert(buffer1 instanceof Float32Array, 'Should create Float32Array')
  assertEquals(buffer1.length, 100, 'Buffer should have correct length')

  const buffer2 = pool.acquire(100, 'Uint32Array')
  assert(buffer2 instanceof Uint32Array, 'Should create Uint32Array')
})

// Test 2: Buffer Reuse
testGroup('Buffer Reuse', () => {
  const pool = new BufferPool(10)
  pool.resetStats()

  const buffer1 = pool.acquire(100, 'Float32Array')
  buffer1[0] = 42

  pool.release(buffer1)

  const buffer2 = pool.acquire(100, 'Float32Array')

  assert(buffer2 === buffer1, 'Should reuse same buffer')
  assertEquals(buffer2[0], 0, 'Buffer should be cleared')

  const stats = pool.getStats()
  assertEquals(stats.acquisitions, 2, 'Should track 2 acquisitions')
  assertEquals(stats.reuses, 1, 'Should track 1 reuse')
})

// Test 3: Different Sizes Don't Reuse
testGroup('Buffer Size Isolation', () => {
  const pool = new BufferPool(10)

  const buffer1 = pool.acquire(100, 'Float32Array')
  pool.release(buffer1)

  const buffer2 = pool.acquire(200, 'Float32Array')

  assert(buffer2 !== buffer1, 'Different sizes should not reuse')
  assertEquals(buffer2.length, 200, 'Should have requested length')
})

// Test 4: Different Types Don't Reuse
testGroup('Buffer Type Isolation', () => {
  const pool = new BufferPool(10)

  const buffer1 = pool.acquire(100, 'Float32Array')
  pool.release(buffer1)

  const buffer2 = pool.acquire(100, 'Uint32Array')

  assert(buffer2 !== buffer1, 'Different types should not reuse')
  assert(buffer2 instanceof Uint32Array, 'Should have correct type')
})

// Test 5: Buffer Clearing
testGroup('Buffer Clearing', () => {
  const pool = new BufferPool(10)

  const buffer = pool.acquire(10, 'Float32Array')

  // Fill with data
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = i * 10
  }

  pool.release(buffer)

  const buffer2 = pool.acquire(10, 'Float32Array')
  assert(buffer2 === buffer, 'Should get same buffer')

  // Check all values are zero
  let allZero = true
  for (let i = 0; i < buffer2.length; i++) {
    if (buffer2[i] !== 0) {
      allZero = false
      break
    }
  }
  assert(allZero, 'Buffer should be completely cleared')
})

// Test 6: Pool Size Limits
testGroup('Pool Size Limits', () => {
  const pool = new BufferPool(5) // Small pool

  const buffers = []
  for (let i = 0; i < 10; i++) {
    buffers.push(pool.acquire(100, 'Float32Array'))
  }

  // Release all
  for (const buffer of buffers) {
    pool.release(buffer)
  }

  const stats = pool.getStats()
  assert(stats.totalBuffers <= 5, 'Pool should respect size limit')
  console.log(`   Pool size: ${stats.totalBuffers}`)
})

// Test 7: Statistics Tracking
testGroup('Statistics Tracking', () => {
  const pool = new BufferPool(10)
  pool.resetStats()

  pool.acquire(100, 'Float32Array')
  pool.acquire(200, 'Float32Array')

  const stats1 = pool.getStats()
  assertEquals(stats1.acquisitions, 2, 'Should track acquisitions')
  assertEquals(stats1.releases, 0, 'Should track releases')

  // Now with reuse
  const buffer1 = pool.acquire(100, 'Float32Array')
  pool.release(buffer1)
  const buffer2 = pool.acquire(100, 'Float32Array')
  pool.release(buffer2)

  const stats2 = pool.getStats()
  assert(stats2.reuses >= 1, 'Should track reuses')
  assert(stats2.hitRate > 0, 'Should calculate hit rate')
})

// Test 8: Memory Usage Calculation
testGroup('Memory Usage Tracking', () => {
  const pool = new BufferPool(10)

  const buffer1 = pool.acquire(100, 'Float32Array')
  const buffer2 = pool.acquire(100, 'Float32Array')

  pool.release(buffer1)
  pool.release(buffer2)

  const stats = pool.getStats()
  const expectedBytes = 2 * 100 * 4 // 2 buffers * 100 floats * 4 bytes
  assertEquals(stats.totalMemoryBytes, expectedBytes, 'Should calculate memory correctly')
  console.log(`   Memory usage: ${stats.totalMemoryBytes} bytes`)
})

// Test 9: Clear Operations
testGroup('Clear Operations', () => {
  const pool = new BufferPool(10)

  const buffer1 = pool.acquire(100, 'Float32Array')
  const buffer2 = pool.acquire(100, 'Uint32Array')

  pool.release(buffer1)
  pool.release(buffer2)

  assertEquals(pool.getStats().totalBuffers, 2, 'Should have 2 buffers before clear')

  pool.clear()

  assertEquals(pool.getStats().totalBuffers, 0, 'Should have 0 buffers after clear')
})

// Test 10: Type-Specific Clear
testGroup('Type-Specific Clear', () => {
  const pool = new BufferPool(10)

  const buffer1 = pool.acquire(100, 'Float32Array')
  const buffer2 = pool.acquire(100, 'Uint32Array')

  pool.release(buffer1)
  pool.release(buffer2)

  pool.clearType('Float32Array')

  const stats = pool.getStats()
  assertEquals(stats.totalBuffers, 1, 'Should have 1 buffer remaining')
})

// Test 11: withBuffer Helper
testGroup('withBuffer Helper', async () => {
  const pool = new BufferPool(10)
  pool.resetStats()

  let bufferRef = null

  await pool.withBuffer(100, 'Float32Array', async (buffer) => {
    bufferRef = buffer
    assert(buffer instanceof Float32Array, 'Should provide Float32Array')
    assertEquals(buffer.length, 100, 'Should have correct length')
  })

  const stats = pool.getStats()
  assertEquals(stats.releases, 1, 'Should auto-release buffer')
})

// Test 12: withBuffer Error Handling
testGroup('withBuffer Error Handling', async () => {
  const pool = new BufferPool(10)
  pool.resetStats()

  try {
    await pool.withBuffer(100, 'Float32Array', async () => {
      throw new Error('Test error')
    })
  } catch (error) {
    // Expected
  }

  const stats = pool.getStats()
  assertEquals(stats.releases, 1, 'Should release buffer even on error')
})

// Test 13: Performance Benchmark
testGroup('Performance Benchmark', () => {
  const iterations = 1000
  const size = 1000

  // Without pooling
  const startNonPooled = performance.now()
  for (let i = 0; i < iterations; i++) {
    const buffer = new Float32Array(size)
    buffer[0] = i
  }
  const endNonPooled = performance.now()
  const nonPooledTime = endNonPooled - startNonPooled

  // With pooling
  const pool = new BufferPool()
  pool.resetStats()

  const startPooled = performance.now()
  for (let i = 0; i < iterations; i++) {
    const buffer = pool.acquire(size, 'Float32Array')
    buffer[0] = i
    pool.release(buffer)
  }
  const endPooled = performance.now()
  const pooledTime = endPooled - startPooled

  const stats = pool.getStats()

  console.log(`   Non-pooled: ${nonPooledTime.toFixed(2)}ms`)
  console.log(`   Pooled: ${pooledTime.toFixed(2)}ms`)
  console.log(`   Improvement: ${((nonPooledTime - pooledTime) / nonPooledTime * 100).toFixed(1)}%`)
  console.log(`   Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`)

  assert(stats.hitRate > 0.9, 'Should have high hit rate (>90%)')
})

// Test 14: Rapid Allocation/Release
testGroup('Rapid Allocation/Release', () => {
  const pool = new BufferPool(50)
  pool.resetStats()

  const buffers = []

  // Allocate many
  for (let i = 0; i < 100; i++) {
    buffers.push(pool.acquire(1000 + i, 'Float32Array'))
  }

  // Release all
  for (const buffer of buffers) {
    pool.release(buffer)
  }

  // Allocate again
  const newBuffers = []
  for (let i = 0; i < 100; i++) {
    newBuffers.push(pool.acquire(1000 + i, 'Float32Array'))
  }

  const stats = pool.getStats()
  assert(stats.reuses > 0, 'Should have buffer reuse')
  console.log(`   Reused ${stats.reuses} buffers out of ${stats.acquisitions} acquisitions`)

  // Cleanup
  for (const buffer of newBuffers) {
    pool.release(buffer)
  }
})

// Test 15: Size Categories
testGroup('Size Categories', () => {
  const pool = new BufferPool(10)

  // Small buffer (< 1KB)
  const small = pool.acquire(100, 'Float32Array') // 400 bytes
  pool.release(small)

  // Medium buffer (1KB - 100KB)
  const medium = pool.acquire(1000, 'Float32Array') // 4KB
  pool.release(medium)

  // Large buffer (100KB - 1MB)
  const large = pool.acquire(50000, 'Float32Array') // 200KB
  pool.release(large)

  const stats = pool.getStats()
  assert(stats.totalBuffers === 3, 'Should pool different size categories')
  console.log(`   Pooled ${stats.totalBuffers} buffers across size categories`)
})

// Summary
console.log('\n' + '='.repeat(50))
console.log(`\n📊 Test Results:`)
console.log(`   ✅ Passed: ${passedTests}`)
console.log(`   ❌ Failed: ${failedTests}`)
console.log(`   📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`)

if (failedTests === 0) {
  console.log('\n🎉 All tests passed!')
  process.exit(0)
} else {
  console.log('\n⚠️  Some tests failed')
  process.exit(1)
}
