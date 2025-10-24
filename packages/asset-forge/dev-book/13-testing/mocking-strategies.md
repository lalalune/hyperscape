# Mocking Strategies

## Overview

Asset Forge follows a selective mocking philosophy: **mock external services, test real internal logic**. This guide covers when, what, and how to mock in Asset Forge tests.

## Table of Contents

1. [Mocking Philosophy](#mocking-philosophy)
2. [What to Mock](#what-to-mock)
3. [What NOT to Mock](#what-not-to-mock)
4. [External API Mocking](#external-api-mocking)
5. [Database Mocking](#database-mocking)
6. [File System Mocking](#file-system-mocking)
7. [Time and Randomness](#time-and-randomness)
8. [Mock Helpers and Utilities](#mock-helpers-and-utilities)
9. [Best Practices](#best-practices)

## Mocking Philosophy

### Core Principles

1. **Real Internal Services**: Never mock Asset Forge's own services
2. **Mock External APIs**: Always mock third-party services (OpenAI, Meshy, ElevenLabs)
3. **Real Databases**: Use actual SQLite/Blob storage in tests
4. **Real 3D Rendering**: Use actual Three.js, not mocked scene graphs
5. **Realistic Mocks**: Mocks should behave like real services

### Why This Approach?

```typescript
// ❌ BAD: Mocking internal services
const mockAssetService = {
  createAsset: vi.fn().mockResolvedValue({ id: '123' })
}
// Problem: Doesn't test actual asset creation logic

// ✅ GOOD: Testing real service with mocked external dependencies
import { AssetService } from '../services/AssetService'
import { mockMeshy } from './mocks/meshy'

const assetService = new AssetService()
// Tests actual business logic, only external API is mocked
```

## What to Mock

### 1. External AI Services

Mock OpenAI, Claude, and other LLM providers:

```typescript
// tests/mocks/openai.ts
import { vi } from 'vitest'

export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockImplementation(async (params) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100))

        // Extract prompt to provide context-aware responses
        const messages = params.messages
        const lastMessage = messages[messages.length - 1]
        const content = lastMessage.content

        // Generate realistic mock response based on prompt
        let responseContent = ''

        if (content.includes('quest')) {
          responseContent = JSON.stringify({
            quest_title: 'The Lost Artifact',
            description: 'Recover the ancient artifact from the ruins',
            objectives: [
              { id: '1', description: 'Travel to the ancient ruins' },
              { id: '2', description: 'Defeat the guardian' },
              { id: '3', description: 'Retrieve the artifact' }
            ],
            rewards: {
              gold: 500,
              experience: 1000,
              items: ['Ancient Key']
            }
          })
        } else if (content.includes('dialogue')) {
          responseContent = JSON.stringify({
            greeting: 'Welcome, traveler! What brings you to our village?',
            responses: {
              quest: 'I need help with a dangerous mission. Are you interested?',
              trade: 'I have some fine wares for sale. Take a look!',
              farewell: 'Safe travels, friend. May the road rise to meet you.'
            }
          })
        } else {
          responseContent = 'Generic AI response'
        }

        return {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: params.model || 'gpt-4o',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: responseContent
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300
          }
        }
      })
    }
  },

  // Mock embeddings for semantic search
  embeddings: {
    create: vi.fn().mockResolvedValue({
      object: 'list',
      data: [{
        object: 'embedding',
        embedding: Array(1536).fill(0).map(() => Math.random()),
        index: 0
      }],
      model: 'text-embedding-ada-002',
      usage: { prompt_tokens: 50, total_tokens: 50 }
    })
  }
}

// Helper to reset mock state
export function resetOpenAIMock() {
  mockOpenAI.chat.completions.create.mockClear()
  mockOpenAI.embeddings.create.mockClear()
}
```

### 2. 3D Generation Services

Mock Meshy AI and other 3D generation providers:

```typescript
// tests/mocks/meshy.ts
import { vi } from 'vitest'

export const mockMeshy = {
  // Text to 3D generation
  textTo3D: {
    create: vi.fn().mockImplementation(async (params) => {
      await new Promise(resolve => setTimeout(resolve, 50))

      return {
        result: `task-${Date.now()}`,
        status: 'pending',
        progress: 0
      }
    }),

    get: vi.fn().mockImplementation(async (taskId: string) => {
      // Simulate progressive status updates
      const callCount = mockMeshy.textTo3D.get.mock.calls.length

      if (callCount < 3) {
        return {
          id: taskId,
          status: 'processing',
          progress: 0.33 * callCount,
          eta: 30 - (10 * callCount)
        }
      }

      return {
        id: taskId,
        status: 'succeeded',
        progress: 1,
        model_urls: {
          glb: `https://assets.meshy.ai/models/${taskId}.glb`,
          fbx: `https://assets.meshy.ai/models/${taskId}.fbx`,
          usdz: `https://assets.meshy.ai/models/${taskId}.usdz`
        },
        thumbnail_url: `https://assets.meshy.ai/thumbnails/${taskId}.png`,
        vertex_count: 5000,
        face_count: 10000,
        texture_urls: [
          `https://assets.meshy.ai/textures/${taskId}_diffuse.png`,
          `https://assets.meshy.ai/textures/${taskId}_normal.png`
        ]
      }
    })
  },

  // Image to 3D generation
  imageToModel: {
    create: vi.fn().mockResolvedValue({
      result: `img-task-${Date.now()}`,
      status: 'pending'
    }),

    get: vi.fn().mockImplementation(async (taskId: string) => {
      const callCount = mockMeshy.imageToModel.get.mock.calls.length

      if (callCount < 2) {
        return { status: 'processing', progress: 0.5 * callCount }
      }

      return {
        status: 'succeeded',
        model_urls: {
          glb: `https://assets.meshy.ai/models/${taskId}.glb`
        }
      }
    })
  },

  // Texture generation
  textToTexture: {
    create: vi.fn().mockResolvedValue({
      result: `tex-task-${Date.now()}`,
      status: 'pending'
    }),

    get: vi.fn().mockResolvedValue({
      status: 'succeeded',
      texture_urls: {
        base_color: 'https://assets.meshy.ai/tex-base.png',
        normal: 'https://assets.meshy.ai/tex-normal.png',
        roughness: 'https://assets.meshy.ai/tex-roughness.png',
        metallic: 'https://assets.meshy.ai/tex-metallic.png'
      }
    })
  }
}

export function resetMeshyMock() {
  Object.values(mockMeshy).forEach(endpoint => {
    Object.values(endpoint).forEach(method => {
      if (typeof method.mockClear === 'function') {
        method.mockClear()
      }
    })
  })
}

// Simulate failure scenarios
export function simulateMeshyFailure(errorType: 'timeout' | 'quota' | 'invalid') {
  const errors = {
    timeout: new Error('Request timeout after 60 seconds'),
    quota: new Error('Monthly quota exceeded'),
    invalid: new Error('Invalid prompt: contains prohibited content')
  }

  mockMeshy.textTo3D.create.mockRejectedValueOnce(errors[errorType])
}
```

### 3. Voice Generation Services

Mock ElevenLabs and other TTS providers:

```typescript
// tests/mocks/elevenlabs.ts
import { vi } from 'vitest'

export const mockElevenLabs = {
  // Text to speech
  textToSpeech: {
    convert: vi.fn().mockImplementation(async (voiceId: string, text: string, options = {}) => {
      await new Promise(resolve => setTimeout(resolve, 50))

      // Generate realistic mock audio buffer
      // Size proportional to text length
      const audioSize = Math.floor(text.length * 50) // ~50 bytes per character
      const mockAudioBuffer = Buffer.alloc(audioSize)

      // Fill with mock audio data (sine wave pattern for realism)
      for (let i = 0; i < audioSize; i++) {
        mockAudioBuffer[i] = Math.floor(128 + 127 * Math.sin(i / 10))
      }

      return {
        audio: mockAudioBuffer,
        contentType: 'audio/mpeg',
        duration: Math.ceil(text.length / 10), // ~10 chars per second
        characterCount: text.length,
        voiceId: voiceId
      }
    })
  },

  // Voice management
  voices: {
    list: vi.fn().mockResolvedValue({
      voices: [
        {
          voice_id: 'voice-merchant-01',
          name: 'Friendly Merchant',
          category: 'generated',
          labels: { accent: 'british', age: 'middle_aged', gender: 'male' },
          samples: []
        },
        {
          voice_id: 'voice-guard-01',
          name: 'Stern Guard',
          category: 'generated',
          labels: { accent: 'american', age: 'young', gender: 'male' },
          samples: []
        },
        {
          voice_id: 'voice-sage-01',
          name: 'Wise Sage',
          category: 'premade',
          labels: { accent: 'british', age: 'old', gender: 'male' },
          samples: []
        }
      ]
    }),

    get: vi.fn().mockImplementation(async (voiceId: string) => {
      const voices = await mockElevenLabs.voices.list()
      return voices.voices.find((v: any) => v.voice_id === voiceId)
    })
  },

  // User subscription info
  user: {
    getSubscription: vi.fn().mockResolvedValue({
      tier: 'starter',
      character_count: 10000,
      character_limit: 30000,
      can_extend_character_limit: true,
      allowed_to_extend_character_limit: true,
      next_character_count_reset_unix: Date.now() + 30 * 24 * 60 * 60 * 1000,
      voice_limit: 10,
      professional_voice_limit: 1,
      can_use_instant_voice_cloning: true
    })
  }
}

export function resetElevenLabsMock() {
  mockElevenLabs.textToSpeech.convert.mockClear()
  mockElevenLabs.voices.list.mockClear()
  mockElevenLabs.voices.get.mockClear()
  mockElevenLabs.user.getSubscription.mockClear()
}

// Simulate quota exceeded
export function simulateQuotaExceeded() {
  mockElevenLabs.textToSpeech.convert.mockRejectedValueOnce(
    new Error('Quota exceeded: 30000/30000 characters used')
  )
}
```

### 4. Payment and Auth Services

Mock Privy and payment processors:

```typescript
// tests/mocks/privy.ts
import { vi } from 'vitest'
import jwt from 'jsonwebtoken'

export const mockPrivy = {
  verifyAuthToken: vi.fn().mockImplementation(async (token: string) => {
    // Validate JWT format
    if (!token.startsWith('Bearer ')) {
      throw new Error('Invalid token format')
    }

    const jwtToken = token.replace('Bearer ', '')

    try {
      const decoded = jwt.verify(jwtToken, 'test-secret')
      return {
        userId: decoded.sub,
        appId: 'test-app-id',
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000)
      }
    } catch (error) {
      throw new Error('Invalid or expired token')
    }
  }),

  getUser: vi.fn().mockImplementation(async (userId: string) => {
    return {
      id: userId,
      createdAt: new Date('2024-01-01'),
      linkedAccounts: [
        {
          type: 'wallet',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
        }
      ],
      mfaMethods: []
    }
  })
}

// Helper to generate test tokens
export function generateTestToken(userId: string, expiresIn: string = '1h'): string {
  return jwt.sign(
    {
      sub: userId,
      iat: Math.floor(Date.now() / 1000)
    },
    'test-secret',
    { expiresIn }
  )
}
```

## What NOT to Mock

### 1. Internal Services

```typescript
// ❌ DON'T mock internal services
const mockAssetService = {
  createAsset: vi.fn(),
  getAsset: vi.fn()
}

// ✅ DO use real internal services
import { AssetService } from '../services/AssetService'
const assetService = new AssetService()
```

### 2. Three.js Scene Graph

```typescript
// ❌ DON'T mock Three.js objects
const mockScene = {
  add: vi.fn(),
  children: []
}

// ✅ DO use real Three.js
import * as THREE from 'three'
const scene = new THREE.Scene()
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
```

### 3. Database Operations

```typescript
// ❌ DON'T mock database
const mockDb = {
  query: vi.fn().mockResolvedValue([])
}

// ✅ DO use real test database
import { db } from '../server/db'
await db.migrate.latest()
const results = await db('assets').select('*')
```

## Database Mocking

While we use real databases, we may need to mock connection failures:

```typescript
// tests/mocks/database-failures.ts
import { vi } from 'vitest'
import { db } from '../server/db'

export function simulateDatabaseError(errorType: 'connection' | 'timeout' | 'constraint') {
  const errors = {
    connection: new Error('ECONNREFUSED: Connection refused'),
    timeout: new Error('Query timeout after 30 seconds'),
    constraint: new Error('UNIQUE constraint failed: assets.id')
  }

  // Mock a single query to fail
  const originalQuery = db.raw
  vi.spyOn(db, 'raw').mockRejectedValueOnce(errors[errorType])
}

// Usage in tests
it('should handle database connection errors', async () => {
  simulateDatabaseError('connection')

  await expect(assetService.createAsset(data))
    .rejects.toThrow('Connection refused')
})
```

## File System Mocking

Mock file system operations for testing without creating actual files:

```typescript
// tests/mocks/filesystem.ts
import { vi } from 'vitest'
import fs from 'fs/promises'

export function mockFileSystem() {
  const files = new Map<string, Buffer>()

  vi.spyOn(fs, 'readFile').mockImplementation(async (path: string) => {
    if (files.has(path)) {
      return files.get(path)!
    }
    throw new Error(`ENOENT: no such file or directory, open '${path}'`)
  })

  vi.spyOn(fs, 'writeFile').mockImplementation(async (path: string, data: any) => {
    files.set(path, Buffer.from(data))
  })

  vi.spyOn(fs, 'unlink').mockImplementation(async (path: string) => {
    if (files.has(path)) {
      files.delete(path)
    } else {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`)
    }
  })

  vi.spyOn(fs, 'stat').mockImplementation(async (path: string) => {
    if (files.has(path)) {
      const data = files.get(path)!
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: data.length,
        mtime: new Date(),
        ctime: new Date()
      } as any
    }
    throw new Error(`ENOENT: no such file or directory, stat '${path}'`)
  })

  return {
    addFile: (path: string, content: Buffer) => files.set(path, content),
    getFile: (path: string) => files.get(path),
    clear: () => files.clear()
  }
}

// Usage
describe('File operations', () => {
  let mockFs: ReturnType<typeof mockFileSystem>

  beforeEach(() => {
    mockFs = mockFileSystem()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should read test file', async () => {
    mockFs.addFile('/test/data.txt', Buffer.from('test content'))

    const content = await fs.readFile('/test/data.txt', 'utf-8')
    expect(content).toBe('test content')
  })
})
```

## Time and Randomness

### Mocking Time

```typescript
// tests/mocks/time.ts
import { vi } from 'vitest'

export function freezeTime(date: Date | string) {
  const frozenDate = typeof date === 'string' ? new Date(date) : date
  vi.useFakeTimers()
  vi.setSystemTime(frozenDate)
}

export function unfreezeTime() {
  vi.useRealTimers()
}

export function advanceTime(ms: number) {
  vi.advanceTimersByTime(ms)
}

// Usage
describe('Time-dependent features', () => {
  beforeEach(() => {
    freezeTime('2024-01-01T00:00:00Z')
  })

  afterEach(() => {
    unfreezeTime()
  })

  it('should expire tokens after 1 hour', () => {
    const token = generateToken()
    expect(isTokenValid(token)).toBe(true)

    // Advance time by 1 hour
    advanceTime(60 * 60 * 1000)

    expect(isTokenValid(token)).toBe(false)
  })
})
```

### Mocking Randomness

```typescript
// tests/mocks/random.ts
import { vi } from 'vitest'

export function seedRandom(seed: number) {
  let value = seed

  vi.spyOn(Math, 'random').mockImplementation(() => {
    // Simple LCG (Linear Congruential Generator)
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  })
}

export function resetRandom() {
  vi.spyOn(Math, 'random').mockRestore()
}

// Usage
describe('Random generation', () => {
  beforeEach(() => {
    seedRandom(12345)
  })

  afterEach(() => {
    resetRandom()
  })

  it('should generate consistent random values', () => {
    const value1 = Math.random()
    seedRandom(12345) // Reset to same seed
    const value2 = Math.random()

    expect(value1).toBe(value2)
  })
})
```

## Mock Helpers and Utilities

### Test Data Factories

```typescript
// tests/factories/asset-factory.ts
export class AssetFactory {
  static create(overrides = {}) {
    return {
      id: `asset-${Date.now()}`,
      name: 'Test Asset',
      type: 'weapon',
      subtype: 'sword',
      status: 'completed',
      modelUrl: 'https://example.com/model.glb',
      thumbnailUrl: 'https://example.com/thumb.png',
      createdAt: new Date().toISOString(),
      ...overrides
    }
  }

  static createMany(count: number, overrides = {}) {
    return Array.from({ length: count }, (_, i) =>
      AssetFactory.create({
        ...overrides,
        id: `asset-${i}`,
        name: `Test Asset ${i}`
      })
    )
  }

  static createWeapon(overrides = {}) {
    return AssetFactory.create({
      type: 'weapon',
      subtype: 'sword',
      ...overrides
    })
  }

  static createArmor(overrides = {}) {
    return AssetFactory.create({
      type: 'armor',
      subtype: 'helmet',
      ...overrides
    })
  }
}

// Usage
it('should process weapon assets', () => {
  const weapons = AssetFactory.createMany(5, { type: 'weapon' })
  const result = processAssets(weapons)
  expect(result.length).toBe(5)
})
```

### Mock Response Builders

```typescript
// tests/builders/response-builder.ts
export class ResponseBuilder {
  static openAICompletion(content: string, overrides = {}) {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 200,
        total_tokens: 300
      },
      ...overrides
    }
  }

  static meshyTask(status: 'pending' | 'processing' | 'succeeded' | 'failed', overrides = {}) {
    const baseResponse = {
      id: `task-${Date.now()}`,
      status,
      created_at: new Date().toISOString(),
      ...overrides
    }

    if (status === 'succeeded') {
      return {
        ...baseResponse,
        model_urls: {
          glb: 'https://assets.meshy.ai/model.glb'
        },
        thumbnail_url: 'https://assets.meshy.ai/thumb.png'
      }
    }

    if (status === 'failed') {
      return {
        ...baseResponse,
        error: 'Generation failed: invalid prompt'
      }
    }

    return baseResponse
  }
}

// Usage
mockOpenAI.chat.completions.create.mockResolvedValue(
  ResponseBuilder.openAICompletion('{"quest": "data"}')
)
```

## Best Practices

### 1. Reset Mocks Between Tests

```typescript
import { beforeEach, afterEach } from 'vitest'
import { resetAllMocks } from './mocks'

describe('Feature tests', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})
```

### 2. Make Mocks Realistic

```typescript
// ❌ BAD: Unrealistic mock
mockOpenAI.chat.completions.create.mockResolvedValue({ text: 'response' })

// ✅ GOOD: Realistic mock with proper structure and delays
mockOpenAI.chat.completions.create.mockImplementation(async (params) => {
  await new Promise(resolve => setTimeout(resolve, 100)) // Simulate API latency

  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: Date.now(),
    model: params.model,
    choices: [{
      message: {
        role: 'assistant',
        content: 'Properly formatted response'
      },
      finish_reason: 'stop'
    }]
  }
})
```

### 3. Test Mock Failure Scenarios

```typescript
describe('Error handling', () => {
  it('should handle API timeout', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(
      new Error('Request timeout after 60 seconds')
    )

    await expect(generateContent(prompt))
      .rejects.toThrow('timeout')
  })

  it('should handle rate limiting', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(
      new Error('Rate limit exceeded')
    )

    await expect(generateContent(prompt))
      .rejects.toThrow('rate limit')
  })
})
```

### 4. Verify Mock Interactions

```typescript
it('should call OpenAI with correct parameters', async () => {
  await generateQuest(config)

  expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'gpt-4o',
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('quest')
        })
      ]),
      temperature: expect.any(Number)
    })
  )
})
```

### 5. Use Spies for Partial Mocking

```typescript
import { vi } from 'vitest'

describe('Partial mocking', () => {
  it('should spy on specific method', async () => {
    const service = new AssetService()

    // Spy on one method while keeping others real
    const spy = vi.spyOn(service, 'validateAsset')

    await service.createAsset(data)

    expect(spy).toHaveBeenCalledWith(data)
    spy.mockRestore()
  })
})
```

## Conclusion

Effective mocking in Asset Forge means:
- Mock external services (APIs, payment processors)
- Use real internal services and databases
- Create realistic mocks that behave like production
- Test both success and failure scenarios
- Reset mocks between tests for isolation

**Key Takeaways:**
- Only mock what you can't control (external services)
- Make mocks realistic with proper delays and data structures
- Test error scenarios by simulating failures
- Use factories and builders for consistent test data
- Always clean up mocks after tests
