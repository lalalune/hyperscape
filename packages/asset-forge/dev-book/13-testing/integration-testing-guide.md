# Integration Testing Guide

## Overview

Integration tests verify that multiple components work together correctly in Asset Forge. Unlike unit tests that test components in isolation, integration tests validate entire workflows, API interactions, and system behavior.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Integration Test Structure](#integration-test-structure)
3. [API Integration Tests](#api-integration-tests)
4. [Service Integration Tests](#service-integration-tests)
5. [Database Integration Tests](#database-integration-tests)
6. [External Service Integration](#external-service-integration)
7. [Multi-Agent System Integration](#multi-agent-system-integration)
8. [Running Integration Tests](#running-integration-tests)
9. [Best Practices](#best-practices)

## Testing Philosophy

Asset Forge follows a "real testing" philosophy for integration tests:

- **No Mocks for Internal Services**: Test actual service interactions
- **Real Database Instances**: Use SQLite/Blob storage for tests
- **Controlled External Services**: Mock only external APIs (OpenAI, Meshy, ElevenLabs)
- **End-to-End Flows**: Test complete user workflows
- **Production-Like Environment**: Tests run in conditions similar to production

## Integration Test Structure

### Directory Organization

```
packages/asset-forge/
├── tests/
│   ├── e2e/                    # End-to-end Playwright tests
│   │   ├── voice-standalone.spec.ts
│   │   ├── voice-integration.spec.ts
│   │   └── helpers/
│   │       └── test-helpers.ts
│   ├── integration/            # Service integration tests
│   │   ├── generation-pipeline.test.ts
│   │   ├── asset-workflow.test.ts
│   │   └── voice-generation.test.ts
│   └── unit/                   # Unit tests
│       └── services/
│           └── __tests__/
```

### Test File Naming

- **Integration tests**: `feature-name.test.ts` or `workflow-name.test.ts`
- **E2E tests**: `feature-name.spec.ts`
- **Helpers**: `test-helpers.ts`, `test-utils.ts`

## API Integration Tests

### Testing Express API Routes

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../server/api.mjs'
import { db } from '../server/db/index.mjs'

describe('Voice Generation API Integration', () => {
  let testUser: any
  let authToken: string

  beforeEach(async () => {
    // Setup test database
    await db.migrate.latest()

    // Create test user
    testUser = await db('users').insert({
      email: 'test@example.com',
      privy_id: 'test-privy-123',
      created_at: new Date().toISOString()
    }).returning('*')

    // Generate auth token
    authToken = generateTestToken(testUser[0].id)
  })

  afterEach(async () => {
    // Cleanup
    await db('users').delete()
    await db.migrate.rollback()
  })

  describe('POST /api/generate-voice', () => {
    it('should generate voice from text input', async () => {
      const response = await request(app)
        .post('/api/generate-voice')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Welcome to our village, traveler.',
          voiceId: 'merchant-voice-01',
          stability: 0.5,
          similarityBoost: 0.75
        })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        audioUrl: expect.stringMatching(/^https?:\/\/.+\.mp3$/),
        duration: expect.any(Number),
        characters: 33
      })

      // Verify audio URL is accessible
      const audioResponse = await request(response.body.audioUrl).get('/')
      expect(audioResponse.status).toBe(200)
      expect(audioResponse.headers['content-type']).toMatch(/audio/)
    })

    it('should handle text exceeding character limit', async () => {
      const longText = 'a'.repeat(5001) // Exceeds 5000 char limit

      const response = await request(app)
        .post('/api/generate-voice')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: longText,
          voiceId: 'merchant-voice-01'
        })
        .expect(400)

      expect(response.body).toMatchObject({
        error: expect.stringContaining('character limit')
      })
    })

    it('should validate authentication', async () => {
      const response = await request(app)
        .post('/api/generate-voice')
        .send({
          text: 'Test text',
          voiceId: 'merchant-voice-01'
        })
        .expect(401)

      expect(response.body.error).toMatch(/unauthorized|authentication/i)
    })
  })

  describe('GET /api/voice-manifest', () => {
    beforeEach(async () => {
      // Seed voice manifest data
      await db('voice_manifests').insert([
        {
          id: 'manifest-1',
          name: 'Village NPCs',
          npc_count: 5,
          user_id: testUser[0].id,
          created_at: new Date().toISOString()
        }
      ])
    })

    it('should retrieve voice manifests for user', async () => {
      const response = await request(app)
        .get('/api/voice-manifest')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toEqual({
        manifests: [
          expect.objectContaining({
            id: 'manifest-1',
            name: 'Village NPCs',
            npc_count: 5
          })
        ]
      })
    })

    it('should filter manifests by search query', async () => {
      const response = await request(app)
        .get('/api/voice-manifest?search=Village')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.manifests).toHaveLength(1)
      expect(response.body.manifests[0].name).toContain('Village')
    })
  })
})

// Test helper functions
function generateTestToken(userId: string): string {
  // In real implementation, use jsonwebtoken
  return `test-token-${userId}`
}
```

### Testing Rate Limiting

```typescript
describe('API Rate Limiting', () => {
  it('should enforce rate limits on voice generation', async () => {
    const requests = []

    // Make 6 requests (assuming limit is 5 per minute)
    for (let i = 0; i < 6; i++) {
      requests.push(
        request(app)
          .post('/api/generate-voice')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: `Request ${i}`,
            voiceId: 'test-voice'
          })
      )
    }

    const responses = await Promise.all(requests)

    // First 5 should succeed
    expect(responses.slice(0, 5).every(r => r.status === 200)).toBe(true)

    // 6th should be rate limited
    expect(responses[5].status).toBe(429)
    expect(responses[5].body.error).toMatch(/rate limit/i)
  })
})
```

## Service Integration Tests

### Testing Asset Generation Pipeline

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { AssetService } from '../server/services/AssetService.mjs'
import { GenerationService } from '../server/services/GenerationService.mjs'
import { BlobAssetService } from '../server/services/BlobAssetService.mjs'

describe('Asset Generation Pipeline Integration', () => {
  let assetService: AssetService
  let generationService: GenerationService
  let blobService: BlobAssetService

  beforeEach(() => {
    assetService = new AssetService()
    generationService = new GenerationService()
    blobService = new BlobAssetService()
  })

  it('should generate and store asset end-to-end', async () => {
    // Step 1: Start generation
    const config = {
      name: 'Test Sword',
      type: 'weapon',
      subtype: 'sword',
      prompt: 'A medieval iron sword with leather grip'
    }

    const pipelineId = await generationService.startGeneration(config)
    expect(pipelineId).toBeTruthy()

    // Step 2: Poll for completion (mock external service)
    let status = 'pending'
    let attempts = 0
    const maxAttempts = 30

    while (status === 'pending' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const pipeline = await generationService.getPipelineStatus(pipelineId)
      status = pipeline.status
      attempts++
    }

    expect(status).toBe('completed')

    // Step 3: Retrieve generated asset
    const asset = await assetService.getAsset(pipelineId)
    expect(asset).toMatchObject({
      id: pipelineId,
      name: 'Test Sword',
      type: 'weapon',
      status: 'completed',
      modelUrl: expect.stringMatching(/^https?:\/\//)
    })

    // Step 4: Verify blob storage
    const blobData = await blobService.getAsset(pipelineId)
    expect(blobData).toBeDefined()
    expect(blobData.url).toBe(asset.modelUrl)
  })

  it('should handle generation failures gracefully', async () => {
    const config = {
      name: 'Invalid Asset',
      type: 'invalid-type',
      prompt: ''
    }

    await expect(generationService.startGeneration(config))
      .rejects.toThrow(/invalid configuration/i)
  })
})
```

### Testing Multi-Agent Orchestration

```typescript
import { MultiAgentOrchestrator } from '../server/services/MultiAgentOrchestrator.mjs'

describe('Multi-Agent Orchestrator Integration', () => {
  let orchestrator: MultiAgentOrchestrator

  beforeEach(() => {
    orchestrator = new MultiAgentOrchestrator()
  })

  it('should coordinate multiple agents for quest generation', async () => {
    const questRequest = {
      type: 'side-quest',
      theme: 'merchant protection',
      difficulty: 'medium',
      region: 'marketplace'
    }

    // Start orchestration
    const sessionId = await orchestrator.startSession(questRequest)
    expect(sessionId).toBeTruthy()

    // Monitor progress
    const updates: any[] = []
    orchestrator.on('agent-update', (update) => {
      updates.push(update)
    })

    // Wait for completion
    const result = await orchestrator.waitForCompletion(sessionId, 60000)

    expect(result).toMatchObject({
      status: 'completed',
      quest: expect.objectContaining({
        title: expect.any(String),
        description: expect.any(String),
        objectives: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            description: expect.any(String)
          })
        ]),
        rewards: expect.any(Object)
      })
    })

    // Verify agent collaboration
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.some(u => u.agent === 'quest-designer')).toBe(true)
    expect(updates.some(u => u.agent === 'narrative-writer')).toBe(true)
    expect(updates.some(u => u.agent === 'balancer')).toBe(true)
  })

  it('should handle agent failures and retry', async () => {
    // Mock agent failure
    const failingRequest = {
      type: 'invalid-quest',
      theme: '',
      difficulty: 'impossible'
    }

    const sessionId = await orchestrator.startSession(failingRequest)
    const result = await orchestrator.waitForCompletion(sessionId, 30000)

    expect(result.status).toBe('failed')
    expect(result.error).toBeDefined()
    expect(result.retries).toBeGreaterThan(0)
  })
})
```

## Database Integration Tests

### Testing Blob Storage Migration

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { put, del, list } from '@vercel/blob'
import { db } from '../server/db/index.mjs'
import fs from 'fs/promises'
import path from 'path'

describe('Blob Storage Integration', () => {
  const testAssets: string[] = []

  afterEach(async () => {
    // Cleanup test blobs
    for (const url of testAssets) {
      try {
        await del(url)
      } catch (error) {
        console.warn('Failed to delete test blob:', url)
      }
    }
    testAssets.length = 0
  })

  it('should migrate asset from filesystem to blob storage', async () => {
    // Create test file
    const testFilePath = path.join(__dirname, '../temp/test-asset.glb')
    await fs.writeFile(testFilePath, Buffer.from('mock GLB data'))

    // Upload to blob storage
    const fileBuffer = await fs.readFile(testFilePath)
    const blob = await put('assets/test-asset.glb', fileBuffer, {
      access: 'public',
      contentType: 'model/gltf-binary'
    })

    testAssets.push(blob.url)

    expect(blob.url).toMatch(/^https:\/\//)
    expect(blob.size).toBeGreaterThan(0)

    // Update database record
    await db('assets').insert({
      id: 'test-asset-123',
      name: 'Test Asset',
      blob_url: blob.url,
      storage_type: 'blob',
      migrated_at: new Date().toISOString()
    })

    // Verify database record
    const record = await db('assets').where('id', 'test-asset-123').first()
    expect(record.blob_url).toBe(blob.url)
    expect(record.storage_type).toBe('blob')

    // Cleanup filesystem
    await fs.unlink(testFilePath)
  })

  it('should list and filter blobs by prefix', async () => {
    // Upload multiple test blobs
    const blobs = await Promise.all([
      put('assets/weapons/sword-1.glb', Buffer.from('data1'), { access: 'public' }),
      put('assets/weapons/axe-1.glb', Buffer.from('data2'), { access: 'public' }),
      put('assets/armor/helmet-1.glb', Buffer.from('data3'), { access: 'public' })
    ])

    blobs.forEach(b => testAssets.push(b.url))

    // List weapons only
    const weaponBlobs = await list({ prefix: 'assets/weapons/' })
    expect(weaponBlobs.blobs.length).toBe(2)
    expect(weaponBlobs.blobs.every(b => b.pathname.startsWith('assets/weapons/'))).toBe(true)
  })
})
```

## External Service Integration

### Mocking External APIs

For external services (OpenAI, Meshy, ElevenLabs), use controlled mocks that simulate real behavior:

```typescript
import { vi } from 'vitest'

// Mock OpenAI API
export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockImplementation(async (params) => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100))

        // Return realistic mock response
        return {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: params.model,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                quest_title: 'Merchant Protection',
                description: 'Guard the merchant caravan from bandits',
                objectives: [
                  { id: '1', description: 'Meet the merchant at the gate' },
                  { id: '2', description: 'Escort caravan to marketplace' }
                ]
              })
            },
            finish_reason: 'stop'
          }]
        }
      })
    }
  }
}

// Mock Meshy API
export const mockMeshy = {
  createTextToTexture: vi.fn().mockResolvedValue({
    result: 'task-123',
    status: 'pending'
  }),

  getTaskResult: vi.fn().mockImplementation(async (taskId) => {
    // Simulate progressive status updates
    if (mockMeshy.getTaskResult.mock.calls.length < 3) {
      return { status: 'processing', progress: 0.5 }
    }
    return {
      status: 'succeeded',
      model_urls: {
        glb: 'https://example.com/model.glb',
        fbx: 'https://example.com/model.fbx'
      },
      thumbnail_url: 'https://example.com/thumb.png'
    }
  })
}

// Mock ElevenLabs API
export const mockElevenLabs = {
  textToSpeech: vi.fn().mockImplementation(async (voiceId, text, options) => {
    // Return mock audio buffer
    return Buffer.from('mock audio data')
  }),

  getVoices: vi.fn().mockResolvedValue({
    voices: [
      { voice_id: 'voice-1', name: 'Merchant Voice', category: 'generated' },
      { voice_id: 'voice-2', name: 'Guard Voice', category: 'premade' }
    ]
  })
}
```

### Using Mocks in Integration Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockOpenAI, mockMeshy, mockElevenLabs } from './mocks'

// Mock modules
vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI)
}))

vi.mock('@meshy/sdk', () => ({
  MeshyClient: vi.fn(() => mockMeshy)
}))

vi.mock('elevenlabs', () => ({
  ElevenLabsClient: vi.fn(() => mockElevenLabs)
}))

describe('External Service Integration', () => {
  beforeEach(() => {
    // Reset mock call counts
    vi.clearAllMocks()
  })

  it('should generate quest using OpenAI', async () => {
    const questService = new QuestService()
    const quest = await questService.generateQuest({
      theme: 'merchant protection',
      difficulty: 'medium'
    })

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('quest')
          })
        ])
      })
    )

    expect(quest).toMatchObject({
      quest_title: expect.any(String),
      description: expect.any(String),
      objectives: expect.any(Array)
    })
  })

  it('should generate 3D model using Meshy', async () => {
    const generationService = new GenerationService()
    const result = await generationService.generateModel({
      prompt: 'medieval sword',
      style: 'realistic'
    })

    expect(mockMeshy.createTextToTexture).toHaveBeenCalled()
    expect(mockMeshy.getTaskResult).toHaveBeenCalled()

    expect(result).toMatchObject({
      status: 'succeeded',
      modelUrl: expect.stringMatching(/\.glb$/)
    })
  })

  it('should generate voice using ElevenLabs', async () => {
    const voiceService = new VoiceGenerationService()
    const audio = await voiceService.generateVoice({
      text: 'Welcome, traveler!',
      voiceId: 'merchant-voice-01'
    })

    expect(mockElevenLabs.textToSpeech).toHaveBeenCalledWith(
      'merchant-voice-01',
      'Welcome, traveler!',
      expect.any(Object)
    )

    expect(audio).toBeInstanceOf(Buffer)
    expect(audio.length).toBeGreaterThan(0)
  })
})
```

## Multi-Agent System Integration

### Testing Agent Collaboration

```typescript
describe('Multi-Agent Collaboration', () => {
  it('should coordinate multiple agents for NPC generation', async () => {
    const npcBuilder = new NPCCollaborationBuilder()

    // Start collaboration session
    const session = await npcBuilder.startCollaboration({
      npcType: 'merchant',
      personality: 'friendly',
      location: 'marketplace'
    })

    // Track agent contributions
    const contributions: any[] = []
    npcBuilder.on('agent-contribution', (contrib) => {
      contributions.push(contrib)
    })

    // Wait for completion
    const result = await npcBuilder.waitForResult(session.id, 60000)

    // Verify all agents contributed
    const agentTypes = contributions.map(c => c.agentType)
    expect(agentTypes).toContain('personality-designer')
    expect(agentTypes).toContain('dialogue-writer')
    expect(agentTypes).toContain('quest-integrator')

    // Verify final NPC has all components
    expect(result.npc).toMatchObject({
      name: expect.any(String),
      personality: expect.objectContaining({
        traits: expect.any(Array),
        motivations: expect.any(Array)
      }),
      dialogue: expect.objectContaining({
        greeting: expect.any(String),
        farewell: expect.any(String),
        responses: expect.any(Object)
      }),
      quests: expect.any(Array)
    })
  })
})
```

## Running Integration Tests

### Local Development

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm test tests/integration/generation-pipeline.test.ts

# Run with coverage
npm run test:integration:coverage

# Run in watch mode
npm run test:integration:watch
```

### CI/CD Pipeline

```yaml
# .github/workflows/integration.yml
name: Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          BLOB_READ_WRITE_TOKEN: ${{ secrets.TEST_BLOB_TOKEN }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-results
          path: test-results/
```

## Best Practices

### 1. Test Isolation

```typescript
// Each test should be independent
describe('Asset Generation', () => {
  beforeEach(async () => {
    // Fresh database state
    await db.migrate.latest()
    await db.seed.run()
  })

  afterEach(async () => {
    // Cleanup
    await db('assets').delete()
    await cleanupTestFiles()
  })

  it('should generate asset', async () => {
    // Test implementation
  })
})
```

### 2. Use Test Fixtures

```typescript
// tests/fixtures/test-data.ts
export const testAssets = {
  sword: {
    name: 'Test Sword',
    type: 'weapon',
    subtype: 'sword',
    modelUrl: 'https://example.com/sword.glb'
  },
  helmet: {
    name: 'Test Helmet',
    type: 'armor',
    subtype: 'helmet',
    modelUrl: 'https://example.com/helmet.glb'
  }
}

// Usage in tests
import { testAssets } from './fixtures/test-data'

it('should load asset', async () => {
  const asset = await assetService.createAsset(testAssets.sword)
  expect(asset.name).toBe('Test Sword')
})
```

### 3. Test Timeouts

```typescript
// Configure appropriate timeouts
describe('Long-running operations', () => {
  it('should generate complex asset', async () => {
    // This test may take longer
    const asset = await generateComplexAsset()
    expect(asset).toBeDefined()
  }, 120000) // 2 minute timeout
})
```

### 4. Error Scenarios

```typescript
// Test both success and failure paths
describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    // Simulate network failure
    mockMeshy.createTextToTexture.mockRejectedValueOnce(
      new Error('Network timeout')
    )

    await expect(generateAsset(config))
      .rejects.toThrow(/network timeout/i)

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('network'),
      expect.any(Error)
    )
  })

  it('should retry failed requests', async () => {
    // Fail first two attempts, succeed on third
    mockMeshy.createTextToTexture
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ task_id: 'task-123' })

    const result = await generateAssetWithRetry(config)
    expect(result.task_id).toBe('task-123')
    expect(mockMeshy.createTextToTexture).toHaveBeenCalledTimes(3)
  })
})
```

### 5. Performance Testing

```typescript
describe('Performance', () => {
  it('should generate asset within time limit', async () => {
    const startTime = Date.now()

    await generateAsset(config)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000) // Should complete in < 5 seconds
  })

  it('should handle concurrent requests', async () => {
    const requests = Array(10).fill(null).map((_, i) =>
      generateAsset({ ...config, name: `Asset ${i}` })
    )

    const results = await Promise.all(requests)

    expect(results).toHaveLength(10)
    expect(results.every(r => r.status === 'completed')).toBe(true)
  })
})
```

## Troubleshooting

### Common Issues

#### Database Lock Errors

```typescript
// Use WAL mode for SQLite
await db.raw("PRAGMA journal_mode = WAL")
```

#### Timeout Issues

```typescript
// Increase timeout for slow operations
describe('Slow operations', () => {
  // Set longer default timeout
  jest.setTimeout(60000)

  it('should complete eventually', async () => {
    await slowOperation()
  })
})
```

#### Flaky Tests

```typescript
// Add retries for flaky tests
describe('Flaky feature', () => {
  it('should eventually succeed', async () => {
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        await flakyOperation()
        break
      } catch (error) {
        attempts++
        if (attempts === maxAttempts) throw error
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  })
})
```

## Conclusion

Integration tests are critical for verifying that Asset Forge's components work together correctly. By testing real workflows with actual services (and controlled mocks for external APIs), we ensure the system functions as expected in production.

**Key Takeaways:**
- Test complete workflows, not just individual components
- Use real database instances and internal services
- Mock only external APIs (OpenAI, Meshy, ElevenLabs)
- Test both success and failure scenarios
- Ensure tests are isolated and repeatable
- Monitor performance and set appropriate timeouts
