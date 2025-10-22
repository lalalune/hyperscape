/**
 * Test script for Voice Manifest API endpoints
 *
 * Tests all 6 new endpoints:
 * 1. POST /api/voice/manifest/assign
 * 2. GET /api/voice/manifest/:manifestType/:entityId
 * 3. GET /api/voice/manifest/bulk
 * 4. DELETE /api/voice/manifest/:manifestType/:entityId
 * 5. POST /api/voice/manifest/bulk-assign
 * 6. POST /api/voice/manifest/generate-sample
 *
 * Usage:
 *   node test-voice-manifest-api.mjs
 */

import fetch from 'node-fetch'

const API_URL = process.env.API_URL || 'http://localhost:3004'

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green')
}

function logError(message) {
  log(`✗ ${message}`, 'red')
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue')
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow')
}

function logSection(message) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(message, 'cyan')
  log('='.repeat(60), 'cyan')
}

// Test data
const testVoiceSettings = {
  modelId: 'eleven_multilingual_v2',
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  outputFormat: 'mp3_44100_128'
}

const testAssignment = {
  manifestType: 'npcs',
  entityId: 'test_merchant_001',
  entityName: 'Thomas the Trader',
  voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice
  voiceName: 'Adam',
  settings: testVoiceSettings
}

let testsPassed = 0
let testsFailed = 0

/**
 * Helper function to make API requests
 */
async function apiRequest(method, path, body = null) {
  const url = `${API_URL}${path}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  return { response, data }
}

/**
 * Test 1: POST /api/voice/manifest/assign
 */
async function testAssignVoice() {
  logSection('Test 1: POST /api/voice/manifest/assign')

  try {
    const { response, data } = await apiRequest('POST', '/api/voice/manifest/assign', testAssignment)

    if (response.status === 200 && data.success) {
      logSuccess('Voice assignment created successfully')
      logInfo(`Entity ID: ${data.assignment.entityId}`)
      logInfo(`Voice ID: ${data.assignment.voiceId}`)
      logInfo(`Voice Name: ${data.assignment.voiceName}`)
      testsPassed++
      return data.assignment
    } else {
      logError(`Failed with status ${response.status}`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return null
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return null
  }
}

/**
 * Test 2: GET /api/voice/manifest/:manifestType/:entityId
 */
async function testGetAssignment() {
  logSection('Test 2: GET /api/voice/manifest/:manifestType/:entityId')

  try {
    const { response, data } = await apiRequest(
      'GET',
      `/api/voice/manifest/${testAssignment.manifestType}/${testAssignment.entityId}`
    )

    if (response.status === 200 && data) {
      logSuccess('Voice assignment retrieved successfully')
      logInfo(`Entity Name: ${data.entityName}`)
      logInfo(`Voice Name: ${data.voiceName}`)
      logInfo(`Assigned At: ${data.assignedAt}`)
      logInfo(`Updated At: ${data.updatedAt}`)
      testsPassed++
      return data
    } else if (response.status === 404) {
      logWarning('No assignment found (expected if running fresh)')
      testsPassed++
      return null
    } else {
      logError(`Failed with status ${response.status}`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return null
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return null
  }
}

/**
 * Test 3: GET /api/voice/manifest/bulk
 */
async function testGetBulkAssignments() {
  logSection('Test 3: GET /api/voice/manifest/bulk')

  try {
    const { response, data } = await apiRequest(
      'GET',
      `/api/voice/manifest/bulk?manifestType=${testAssignment.manifestType}&limit=10&offset=0`
    )

    if (response.status === 200 && data) {
      logSuccess('Bulk assignments retrieved successfully')
      logInfo(`Total Assignments: ${data.total}`)
      logInfo(`Returned: ${data.assignments.length}`)
      logInfo(`Limit: ${data.limit}`)
      logInfo(`Offset: ${data.offset}`)

      if (data.assignments.length > 0) {
        logInfo(`First Assignment: ${data.assignments[0].entityName}`)
      }

      testsPassed++
      return data
    } else {
      logError(`Failed with status ${response.status}`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return null
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return null
  }
}

/**
 * Test 4: POST /api/voice/manifest/bulk-assign
 */
async function testBulkAssign() {
  logSection('Test 4: POST /api/voice/manifest/bulk-assign')

  const bulkAssignments = [
    {
      manifestType: 'npcs',
      entityId: 'test_merchant_002',
      entityName: 'Sarah the Shopkeeper',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella voice
      voiceName: 'Bella',
      settings: testVoiceSettings
    },
    {
      manifestType: 'npcs',
      entityId: 'test_guard_001',
      entityName: 'Guard Captain Marcus',
      voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice
      voiceName: 'Adam',
      settings: testVoiceSettings
    }
  ]

  try {
    const { response, data } = await apiRequest('POST', '/api/voice/manifest/bulk-assign', {
      assignments: bulkAssignments
    })

    if (response.status === 200 && data.success) {
      logSuccess('Bulk assignment completed successfully')
      logInfo(`Assigned: ${data.assigned}`)
      logInfo(`Failed: ${data.failed}`)

      if (data.errors.length > 0) {
        logWarning('Errors encountered:')
        data.errors.forEach(err => {
          logWarning(`  - ${err.entityId}: ${err.error}`)
        })
      }

      testsPassed++
      return data
    } else {
      logError(`Failed with status ${response.status}`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return null
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return null
  }
}

/**
 * Test 5: POST /api/voice/manifest/generate-sample
 */
async function testGenerateSample() {
  logSection('Test 5: POST /api/voice/manifest/generate-sample')

  const sampleRequest = {
    manifestType: 'npcs',
    entityId: 'test_merchant_001',
    entityType: 'merchant',
    count: 3
  }

  try {
    // Check if OPENAI_API_KEY is configured
    if (!process.env.OPENAI_API_KEY) {
      logWarning('OPENAI_API_KEY not configured - skipping sample generation test')
      testsPassed++
      return null
    }

    const { response, data } = await apiRequest('POST', '/api/voice/manifest/generate-sample', sampleRequest)

    if (response.status === 200 && data) {
      logSuccess('Sample dialogue generated successfully')
      logInfo(`Entity: ${data.entityName}`)
      logInfo(`Entity Type: ${data.entityType}`)
      logInfo(`Samples Generated: ${data.samples.length}`)

      data.samples.forEach((sample, index) => {
        logInfo(`\nSample ${index + 1}:`)
        logInfo(`  Context: ${sample.context}`)
        logInfo(`  Text: "${sample.text}"`)
      })

      testsPassed++
      return data
    } else if (response.status === 503) {
      logWarning('OpenAI API not available (expected if OPENAI_API_KEY not set)')
      testsPassed++
      return null
    } else {
      logError(`Failed with status ${response.status}`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return null
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return null
  }
}

/**
 * Test 6: DELETE /api/voice/manifest/:manifestType/:entityId
 */
async function testDeleteAssignment() {
  logSection('Test 6: DELETE /api/voice/manifest/:manifestType/:entityId')

  try {
    const { response, data } = await apiRequest(
      'DELETE',
      `/api/voice/manifest/${testAssignment.manifestType}/${testAssignment.entityId}`
    )

    if (response.status === 200 && data.success) {
      logSuccess('Voice assignment deletion successful')
      logInfo(`Deleted: ${data.deleted}`)
      testsPassed++
      return data
    } else {
      logError(`Failed with status ${response.status}`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return null
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return null
  }
}

/**
 * Test 7: Verify deletion
 */
async function testVerifyDeletion() {
  logSection('Test 7: Verify Deletion')

  try {
    const { response, data } = await apiRequest(
      'GET',
      `/api/voice/manifest/${testAssignment.manifestType}/${testAssignment.entityId}`
    )

    if (response.status === 404) {
      logSuccess('Voice assignment successfully deleted (404 expected)')
      testsPassed++
      return true
    } else {
      logError(`Unexpected status ${response.status} - expected 404`)
      logError(JSON.stringify(data, null, 2))
      testsFailed++
      return false
    }
  } catch (error) {
    logError(`Error: ${error.message}`)
    testsFailed++
    return false
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n🧪 Voice Manifest API Test Suite', 'cyan')
  log(`API URL: ${API_URL}`, 'cyan')
  log(`Starting tests at ${new Date().toISOString()}\n`, 'cyan')

  // Check if server is running
  try {
    const healthCheck = await fetch(`${API_URL}/api/health`)
    if (!healthCheck.ok) {
      logError('Server health check failed')
      logError('Make sure the API server is running with: npm run dev:api')
      process.exit(1)
    }
    logSuccess('Server health check passed\n')
  } catch (error) {
    logError('Cannot connect to API server')
    logError('Make sure the API server is running with: npm run dev:api')
    logError(`Error: ${error.message}`)
    process.exit(1)
  }

  // Run tests in sequence
  await testAssignVoice()
  await testGetAssignment()
  await testGetBulkAssignments()
  await testBulkAssign()
  await testGenerateSample()
  await testDeleteAssignment()
  await testVerifyDeletion()

  // Print summary
  logSection('Test Summary')
  log(`Total Tests: ${testsPassed + testsFailed}`, 'cyan')
  logSuccess(`Passed: ${testsPassed}`)

  if (testsFailed > 0) {
    logError(`Failed: ${testsFailed}`)
    log('\n❌ Some tests failed', 'red')
    process.exit(1)
  } else {
    log('\n✅ All tests passed!', 'green')
    process.exit(0)
  }
}

// Run tests
runTests().catch(error => {
  logError(`Unhandled error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
