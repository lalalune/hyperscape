#!/usr/bin/env node

/**
 * Performance Benchmark Script
 * Compares Express (port 3004) vs Elysia (port 3005) servers
 *
 * Usage:
 *   node scripts/benchmark-servers.mjs
 *
 * Requirements:
 *   - Both servers must be running
 *   - Express on port 3004: npm run dev:api
 *   - Elysia on port 3005: npm run dev:elysia
 */

import { performance } from 'perf_hooks'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

// Configuration
const WARMUP_REQUESTS = 50
const TEST_REQUESTS = 1000
const CONCURRENCY = 10

const SERVERS = {
  express: {
    name: 'Express',
    port: 3004,
    baseUrl: 'http://localhost:3004'
  },
  elysia: {
    name: 'Elysia',
    port: 3005,
    baseUrl: 'http://localhost:3005'
  }
}

const ENDPOINTS = [
  { path: '/api/health', method: 'GET', name: 'Health Check' },
  { path: '/api/assets', method: 'GET', name: 'List Assets' },
  { path: '/api/material-presets', method: 'GET', name: 'Material Presets' }
]

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

/**
 * Check if a server is running
 */
async function checkServer(server) {
  try {
    const response = await fetch(`${server.baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2000)
    })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Run a single request and measure timing
 */
async function makeRequest(url, method = 'GET') {
  const start = performance.now()

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Accept': 'application/json' }
    })

    const end = performance.now()
    const duration = end - start

    return {
      success: response.ok,
      status: response.status,
      duration,
      error: null
    }
  } catch (error) {
    const end = performance.now()
    return {
      success: false,
      status: 0,
      duration: end - start,
      error: error.message
    }
  }
}

/**
 * Run concurrent requests
 */
async function runConcurrentRequests(url, method, count, concurrency) {
  const results = []
  const batches = Math.ceil(count / concurrency)

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, count - batch * concurrency)
    const promises = Array.from({ length: batchSize }, () => makeRequest(url, method))
    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  }

  return results
}

/**
 * Calculate statistics from results
 */
function calculateStats(results) {
  const successfulResults = results.filter(r => r.success)
  const durations = successfulResults.map(r => r.duration).sort((a, b) => a - b)

  if (durations.length === 0) {
    return {
      totalRequests: results.length,
      successful: 0,
      failed: results.length,
      successRate: 0,
      minLatency: 0,
      maxLatency: 0,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      requestsPerSecond: 0
    }
  }

  const totalDuration = durations.reduce((sum, d) => sum + d, 0)
  const avgLatency = totalDuration / durations.length

  const p50Index = Math.floor(durations.length * 0.5)
  const p95Index = Math.floor(durations.length * 0.95)
  const p99Index = Math.floor(durations.length * 0.99)

  return {
    totalRequests: results.length,
    successful: successfulResults.length,
    failed: results.length - successfulResults.length,
    successRate: (successfulResults.length / results.length) * 100,
    minLatency: durations[0],
    maxLatency: durations[durations.length - 1],
    avgLatency,
    p50Latency: durations[p50Index],
    p95Latency: durations[p95Index],
    p99Latency: durations[p99Index],
    requestsPerSecond: 1000 / avgLatency
  }
}

/**
 * Benchmark a single endpoint for one server
 */
async function benchmarkEndpoint(server, endpoint) {
  const url = `${server.baseUrl}${endpoint.path}`

  // Warmup phase
  log(`  Warming up (${WARMUP_REQUESTS} requests)...`, colors.yellow)
  await runConcurrentRequests(url, endpoint.method, WARMUP_REQUESTS, CONCURRENCY)

  // Test phase
  log(`  Running benchmark (${TEST_REQUESTS} requests)...`, colors.yellow)
  const startTime = performance.now()
  const results = await runConcurrentRequests(url, endpoint.method, TEST_REQUESTS, CONCURRENCY)
  const totalTime = performance.now() - startTime

  const stats = calculateStats(results)
  stats.totalTime = totalTime
  stats.throughput = (TEST_REQUESTS / totalTime) * 1000 // requests per second

  return stats
}

/**
 * Run benchmarks for all endpoints on all servers
 */
async function runBenchmarks() {
  log('\n==============================================', colors.bright)
  log('  Performance Benchmark: Express vs Elysia', colors.bright)
  log('==============================================\n', colors.bright)

  // Check server availability
  log('Checking server availability...', colors.cyan)
  for (const [key, server] of Object.entries(SERVERS)) {
    const isRunning = await checkServer(server)
    if (!isRunning) {
      log(`❌ ${server.name} server is not running on port ${server.port}`, colors.red)
      log(`   Start it with: npm run ${key === 'express' ? 'dev:api' : 'dev:elysia'}`, colors.yellow)
      process.exit(1)
    }
    log(`✓ ${server.name} server is running on port ${server.port}`, colors.green)
  }

  log('\n==============================================\n', colors.bright)

  const allResults = {}

  // Run benchmarks for each server and endpoint
  for (const [serverKey, server] of Object.entries(SERVERS)) {
    allResults[serverKey] = {}

    log(`Testing ${server.name} (${server.baseUrl})`, colors.bright + colors.blue)
    log('----------------------------------------------', colors.blue)

    for (const endpoint of ENDPOINTS) {
      log(`\n${endpoint.name} (${endpoint.method} ${endpoint.path})`, colors.cyan)
      const stats = await benchmarkEndpoint(server, endpoint)
      allResults[serverKey][endpoint.path] = stats

      // Display results
      log(`  ✓ Completed in ${stats.totalTime.toFixed(2)}ms`, colors.green)
      log(`  • Success rate: ${stats.successRate.toFixed(2)}%`)
      log(`  • Throughput: ${stats.throughput.toFixed(2)} req/s`)
      log(`  • Avg latency: ${stats.avgLatency.toFixed(2)}ms`)
      log(`  • P95 latency: ${stats.p95Latency.toFixed(2)}ms`)
    }

    log('\n')
  }

  return allResults
}

/**
 * Generate comparison report
 */
function generateReport(results) {
  log('\n==============================================', colors.bright)
  log('  Performance Comparison Summary', colors.bright)
  log('==============================================\n', colors.bright)

  const report = {
    timestamp: new Date().toISOString(),
    configuration: {
      warmupRequests: WARMUP_REQUESTS,
      testRequests: TEST_REQUESTS,
      concurrency: CONCURRENCY
    },
    endpoints: {}
  }

  for (const endpoint of ENDPOINTS) {
    const expressStats = results.express[endpoint.path]
    const elysiaStats = results.elysia[endpoint.path]

    const throughputRatio = elysiaStats.throughput / expressStats.throughput
    const latencyRatio = expressStats.avgLatency / elysiaStats.avgLatency

    log(`${endpoint.name}:`, colors.cyan + colors.bright)
    log('----------------------------------------------', colors.cyan)

    // Throughput comparison
    log(`\nThroughput (req/s):`, colors.yellow)
    log(`  Express: ${expressStats.throughput.toFixed(2)} req/s`)
    log(`  Elysia:  ${elysiaStats.throughput.toFixed(2)} req/s`, colors.green)
    log(`  Winner:  Elysia is ${throughputRatio.toFixed(2)}x faster`, colors.bright + colors.green)

    // Latency comparison
    log(`\nAverage Latency:`, colors.yellow)
    log(`  Express: ${expressStats.avgLatency.toFixed(2)}ms`)
    log(`  Elysia:  ${elysiaStats.avgLatency.toFixed(2)}ms`, colors.green)
    log(`  Winner:  Elysia is ${latencyRatio.toFixed(2)}x faster`, colors.bright + colors.green)

    // P95 Latency comparison
    log(`\nP95 Latency:`, colors.yellow)
    log(`  Express: ${expressStats.p95Latency.toFixed(2)}ms`)
    log(`  Elysia:  ${elysiaStats.p95Latency.toFixed(2)}ms`, colors.green)

    // Success rate
    log(`\nSuccess Rate:`, colors.yellow)
    log(`  Express: ${expressStats.successRate.toFixed(2)}%`)
    log(`  Elysia:  ${elysiaStats.successRate.toFixed(2)}%`)

    log('\n')

    report.endpoints[endpoint.path] = {
      name: endpoint.name,
      express: expressStats,
      elysia: elysiaStats,
      comparison: {
        throughputRatio,
        latencyRatio,
        winner: 'Elysia'
      }
    }
  }

  // Overall summary
  const avgThroughputRatio = Object.values(report.endpoints)
    .reduce((sum, e) => sum + e.comparison.throughputRatio, 0) / ENDPOINTS.length

  const avgLatencyRatio = Object.values(report.endpoints)
    .reduce((sum, e) => sum + e.comparison.latencyRatio, 0) / ENDPOINTS.length

  log('==============================================', colors.bright)
  log('  Overall Performance Summary', colors.bright)
  log('==============================================\n', colors.bright)

  log(`Average throughput improvement: ${avgThroughputRatio.toFixed(2)}x`, colors.green + colors.bright)
  log(`Average latency improvement: ${avgLatencyRatio.toFixed(2)}x`, colors.green + colors.bright)

  if (avgThroughputRatio > 1.5) {
    log(`\n✨ Elysia demonstrates significant performance advantages!`, colors.green + colors.bright)
  } else if (avgThroughputRatio > 1.0) {
    log(`\n✓ Elysia shows measurable performance improvements.`, colors.green)
  } else {
    log(`\n⚠️  Performance results are within margin of error.`, colors.yellow)
  }

  report.overall = {
    avgThroughputRatio,
    avgLatencyRatio,
    winner: 'Elysia'
  }

  return report
}

/**
 * Save results to JSON file
 */
async function saveResults(report) {
  const resultsDir = path.join(ROOT_DIR, 'docs')
  await fs.mkdir(resultsDir, { recursive: true })

  const resultsPath = path.join(resultsDir, 'benchmark-results.json')
  await fs.writeFile(resultsPath, JSON.stringify(report, null, 2))

  log(`\nResults saved to: ${resultsPath}`, colors.cyan)
}

/**
 * Main execution
 */
async function main() {
  try {
    const results = await runBenchmarks()
    const report = generateReport(results)
    await saveResults(report)

    log('\n✓ Benchmark completed successfully!\n', colors.green + colors.bright)
  } catch (error) {
    log(`\n❌ Benchmark failed: ${error.message}\n`, colors.red)
    console.error(error)
    process.exit(1)
  }
}

main()
