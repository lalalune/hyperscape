/**
 * Voice Generation Service (Frontend)
 *
 * Client-side service for interacting with ElevenLabs voice generation API.
 *
 * Features:
 * - Fetch voice library
 * - Generate single voice clips
 * - Batch generate dialogue voices
 * - Download voice clips
 * - Cost estimation
 *
 * Used by: VoiceGenerator, VoiceLibraryBrowser components
 */

import { API_ENDPOINTS } from '../config/api'
import { apiFetch } from '../utils/api'
import type {
  ElevenLabsVoice,
  VoiceLibraryResponse,
  VoiceGenerationRequest,
  VoiceBatchGenerationRequest,
  VoiceBatchGenerationResponse,
  VoiceCostEstimate,
  VoiceProfile,
  VoiceSubscriptionInfo,
  VoiceModel,
  VoiceModelsResponse,
  SpeechToSpeechRequest,
  VoiceDesignRequest,
  VoiceDesignResponse,
  CreateVoiceRequest,
  CreateVoiceResponse,
  RateLimitInfo
} from '../types/voice-generation'

class VoiceGenerationService {
  /**
   * Fetch available voices from ElevenLabs library
   * Uses automatic request deduplication for concurrent calls
   */
  async getVoiceLibrary(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceLibrary)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to fetch voice library')
      }

      const data: VoiceLibraryResponse = await response.json()
      return data.voices ?? []
    } catch (error) {
      console.error('[VoiceGenerationService] Error fetching voice library:', error)
      throw error
    }
  }

  /**
   * Generate single voice clip from text
   * @returns Audio blob
   */
  async generateVoiceClip(request: VoiceGenerationRequest): Promise<Blob> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceGenerate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        deduplicate: false // Don't deduplicate POST requests by default
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to generate voice')
      }

      // Response is audio file (MP3)
      const audioBlob = await response.blob()
      return audioBlob
    } catch (error) {
      console.error('[VoiceGenerationService] Error generating voice:', error)
      throw error
    }
  }

  /**
   * Generate voice clips for entire dialogue tree
   */
  async generateBatchVoices(
    request: VoiceBatchGenerationRequest
  ): Promise<VoiceBatchGenerationResponse> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceBatch, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to generate batch voices')
      }

      const data: VoiceBatchGenerationResponse = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error generating batch voices:', error)
      throw error
    }
  }

  /**
   * Get voice profile for an NPC
   * Uses automatic request deduplication for concurrent calls
   */
  async getVoiceProfile(npcId: string): Promise<VoiceProfile | null> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceProfile(npcId))

      if (response.status === 404) {
        return null // No voice profile exists
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to fetch voice profile')
      }

      const data: VoiceProfile = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error fetching voice profile:', error)
      throw error
    }
  }

  /**
   * Delete voice clips for an NPC
   */
  async deleteVoiceClips(npcId: string): Promise<boolean> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceDelete(npcId), {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to delete voice clips')
      }

      const data = await response.json()
      return data.success ?? false
    } catch (error) {
      console.error('[VoiceGenerationService] Error deleting voice clips:', error)
      throw error
    }
  }

  /**
   * Estimate cost for voice generation
   */
  async estimateCost(characterCount: number, modelId?: string): Promise<VoiceCostEstimate> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceEstimate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          characterCount,
          modelId
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to estimate cost')
      }

      const data: VoiceCostEstimate = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error estimating cost:', error)
      throw error
    }
  }

  /**
   * Play audio preview from blob
   * Ensures URL is revoked in all cases (ended, error, pause, beforeunload)
   */
  playAudioPreview(audioBlob: Blob): HTMLAudioElement {
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    // Shared cleanup function that removes all listeners
    const cleanup = () => {
      audio.removeEventListener('ended', cleanup)
      audio.removeEventListener('error', cleanup)
      audio.removeEventListener('pause', cleanup)
      window.removeEventListener('beforeunload', cleanup)
      URL.revokeObjectURL(audioUrl)
    }

    // Clean up object URL in all cases
    audio.addEventListener('ended', cleanup)
    audio.addEventListener('error', cleanup)
    audio.addEventListener('pause', cleanup)
    window.addEventListener('beforeunload', cleanup)

    audio.play().catch(error => {
      console.error('[VoiceGenerationService] Error playing audio:', error)
      cleanup()
    })

    return audio
  }

  /**
   * Download voice clip as MP3
   */
  downloadVoiceClip(audioBlob: Blob, filename: string): void {
    const url = URL.createObjectURL(audioBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.mp3') ? filename : `${filename}.mp3`
    document.body.appendChild(a)
    a.click()
    // Add slight delay before cleanup to ensure download starts
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 500)
  }

  /**
   * Calculate total character count from dialogue nodes
   */
  calculateCharacterCount(dialogueNodes: Array<{ text: string }>): number {
    return dialogueNodes.reduce((total, node) => total + node.text.length, 0)
  }

  /**
   * Get user subscription info (quota, usage, tier)
   * Uses automatic request deduplication for concurrent calls
   * Official docs: https://elevenlabs.io/docs/api-reference/get-subscription-info
   */
  async getSubscriptionInfo(): Promise<VoiceSubscriptionInfo> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceSubscription)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to fetch subscription info')
      }

      const data: VoiceSubscriptionInfo = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error fetching subscription:', error)
      throw error
    }
  }

  /**
   * Get available TTS models
   * Uses automatic request deduplication for concurrent calls
   * Official docs: https://elevenlabs.io/docs/api-reference/get-models
   */
  async getAvailableModels(): Promise<VoiceModel[]> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceModels)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to fetch models')
      }

      const data: VoiceModelsResponse = await response.json()
      return data.models ?? []
    } catch (error) {
      console.error('[VoiceGenerationService] Error fetching models:', error)
      throw error
    }
  }

  /**
   * Get current ElevenLabs rate limit status
   * Uses automatic request deduplication for concurrent calls
   * Official docs: https://help.elevenlabs.io/hc/en-us/articles/14312733311761
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceRateLimit)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to fetch rate limit info')
      }

      const data: RateLimitInfo = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error fetching rate limit:', error)
      throw error
    }
  }

  /**
   * Convert audio from one voice to another (Voice Changer)
   * Official docs: https://elevenlabs.io/docs/api-reference/speech-to-speech/convert
   * @param request Speech-to-speech conversion parameters
   * @returns Converted audio blob
   */
  async speechToSpeech(request: SpeechToSpeechRequest): Promise<Blob> {
    try {
      // Convert audio to base64 if it's a File or Blob
      let audioBase64: string
      if (request.audio instanceof File || request.audio instanceof Blob) {
        audioBase64 = await this.fileToBase64(request.audio)
      } else {
        audioBase64 = request.audio
      }

      const response = await apiFetch(API_ENDPOINTS.voiceSpeechToSpeech, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio: audioBase64,
          voiceId: request.voiceId,
          modelId: request.modelId,
          outputFormat: request.outputFormat,
          stability: request.stability,
          similarityBoost: request.similarityBoost,
          removeBackgroundNoise: request.removeBackgroundNoise,
          seed: request.seed
        }),
        deduplicate: false // Don't deduplicate POST requests
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to convert audio')
      }

      // Response contains { success, audio: base64, size, format }
      const data = await response.json()
      
      // Convert base64 back to blob
      const binaryString = atob(data.audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' })
      
      return audioBlob
    } catch (error) {
      console.error('[VoiceGenerationService] Error converting audio:', error)
      throw error
    }
  }

  /**
   * Design custom voices from text descriptions
   * Official docs: https://elevenlabs.io/docs/api-reference/text-to-voice/design
   * @param request Voice design parameters
   * @returns Voice previews and generated text
   */
  async designVoice(request: VoiceDesignRequest): Promise<VoiceDesignResponse> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceDesign, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        deduplicate: false // Don't deduplicate POST requests
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to design voice')
      }

      const data: VoiceDesignResponse = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error designing voice:', error)
      throw error
    }
  }

  /**
   * Save a designed voice to ElevenLabs library
   * Official docs: https://elevenlabs.io/docs/api-reference/text-to-voice/create
   * @param request Voice creation parameters
   * @returns Created voice details
   */
  async createVoiceFromPreview(request: CreateVoiceRequest): Promise<CreateVoiceResponse> {
    try {
      const response = await apiFetch(API_ENDPOINTS.voiceCreateFromPreview, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        deduplicate: false // Don't deduplicate POST requests
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to create voice from preview')
      }

      const data: CreateVoiceResponse = await response.json()
      return data
    } catch (error) {
      console.error('[VoiceGenerationService] Error creating voice:', error)
      throw error
    }
  }

  /**
   * Convert audio file to base64 string
   * @param file Audio file or blob
   * @returns Base64 string (without data URL prefix)
   */
  private async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = () => {
        const result = reader.result as string
        // Strip data URL prefix (e.g., "data:audio/mpeg;base64,")
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsDataURL(file)
    })
  }
}

// Export singleton instance
export const voiceGenerationService = new VoiceGenerationService()
export default voiceGenerationService
