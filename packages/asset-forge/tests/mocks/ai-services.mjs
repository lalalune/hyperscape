/**
 * Mock AI Services for Testing
 * Provides mock implementations of OpenAI, Meshy, and ElevenLabs APIs
 */

import { vi } from 'vitest'

/**
 * Mock OpenAI API
 */
export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Enhanced prompt: A detailed fantasy sword with intricate metalwork'
          }
        }]
      })
    }
  },
  images: {
    generate: vi.fn().mockResolvedValue({
      data: [{
        url: 'https://example.com/generated-image.png'
      }]
    })
  }
}

/**
 * Mock Meshy API
 */
export const mockMeshy = {
  startImageTo3D: vi.fn().mockResolvedValue('task-123-456'),

  getTaskStatus: vi.fn().mockImplementation((taskId) => {
    // Simulate progressive status updates
    const callCount = mockMeshy.getTaskStatus.mock.calls.length

    if (callCount <= 2) {
      return Promise.resolve({
        status: 'PENDING',
        progress: callCount * 30
      })
    }

    return Promise.resolve({
      status: 'SUCCEEDED',
      progress: 100,
      model_urls: {
        glb: 'https://example.com/model.glb',
        fbx: 'https://example.com/model.fbx'
      },
      polycount: 5000,
      thumbnail_url: 'https://example.com/thumbnail.png'
    })
  }),

  startRetextureTask: vi.fn().mockResolvedValue('retexture-task-789'),

  getRetextureTaskStatus: vi.fn().mockImplementation((taskId) => {
    const callCount = mockMeshy.getRetextureTaskStatus.mock.calls.length

    if (callCount <= 1) {
      return Promise.resolve({
        status: 'PENDING',
        progress: callCount * 50
      })
    }

    return Promise.resolve({
      status: 'SUCCEEDED',
      progress: 100,
      model_urls: {
        glb: 'https://example.com/retextured-model.glb'
      }
    })
  }),

  startRiggingTask: vi.fn().mockResolvedValue('rigging-task-abc'),

  getRiggingTaskStatus: vi.fn().mockImplementation((taskId) => {
    const callCount = mockMeshy.getRiggingTaskStatus.mock.calls.length

    if (callCount <= 1) {
      return Promise.resolve({
        status: 'PENDING',
        progress: callCount * 50
      })
    }

    return Promise.resolve({
      status: 'SUCCEEDED',
      progress: 100,
      result: {
        basic_animations: {
          walking_glb_url: 'https://example.com/walking.glb',
          running_glb_url: 'https://example.com/running.glb'
        }
      }
    })
  })
}

/**
 * Mock ElevenLabs API
 */
export const mockElevenLabs = {
  generate: vi.fn().mockResolvedValue({
    audio: Buffer.from('mock-audio-data'),
    contentType: 'audio/mpeg'
  }),

  getVoices: vi.fn().mockResolvedValue({
    voices: [
      {
        voice_id: 'voice-1',
        name: 'Test Voice 1',
        category: 'generated',
        labels: { accent: 'american', age: 'young' }
      },
      {
        voice_id: 'voice-2',
        name: 'Test Voice 2',
        category: 'premade',
        labels: { accent: 'british', age: 'middle-aged' }
      }
    ]
  }),

  createVoice: vi.fn().mockResolvedValue({
    voice_id: 'new-voice-123',
    name: 'Custom Voice',
    status: 'ready'
  })
}

/**
 * Mock node-fetch for HTTP requests
 */
export const mockFetch = vi.fn().mockImplementation((url, options) => {
  // Mock successful GLB download
  if (url.includes('.glb')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    })
  }

  // Mock image download
  if (url.includes('.png') || url.includes('image')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(512))
    })
  }

  // Default success response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true })
  })
})

/**
 * Mock Blob Storage API
 */
export const mockBlobStorage = {
  put: vi.fn().mockResolvedValue({
    url: 'https://blob.vercel-storage.com/test-file.glb',
    downloadUrl: 'https://blob.vercel-storage.com/test-file.glb',
    pathname: 'test-file.glb',
    contentType: 'model/gltf-binary'
  }),

  del: vi.fn().mockResolvedValue(undefined),

  list: vi.fn().mockResolvedValue({
    blobs: [
      {
        url: 'https://blob.vercel-storage.com/test-1.glb',
        pathname: 'test-1.glb',
        size: 1024,
        uploadedAt: new Date()
      }
    ]
  }),

  head: vi.fn().mockResolvedValue({
    url: 'https://blob.vercel-storage.com/test-file.glb',
    size: 2048,
    uploadedAt: new Date(),
    contentType: 'model/gltf-binary'
  })
}

/**
 * Reset all mocks (useful between tests)
 */
export function resetAllMocks() {
  mockOpenAI.chat.completions.create.mockClear()
  mockOpenAI.images.generate.mockClear()
  mockMeshy.startImageTo3D.mockClear()
  mockMeshy.getTaskStatus.mockClear()
  mockMeshy.startRetextureTask.mockClear()
  mockMeshy.getRetextureTaskStatus.mockClear()
  mockMeshy.startRiggingTask.mockClear()
  mockMeshy.getRiggingTaskStatus.mockClear()
  mockElevenLabs.generate.mockClear()
  mockElevenLabs.getVoices.mockClear()
  mockElevenLabs.createVoice.mockClear()
  mockFetch.mockClear()
  mockBlobStorage.put.mockClear()
  mockBlobStorage.del.mockClear()
  mockBlobStorage.list.mockClear()
  mockBlobStorage.head.mockClear()
}
