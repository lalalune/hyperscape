/**
 * Voice Generation Types
 *
 * Type definitions for ElevenLabs voice generation system.
 *
 * Used by: VoiceGenerationService, useVoiceGenerationStore, Voice components
 */

// ElevenLabs Voice from library
export interface ElevenLabsVoice {
  voiceId: string
  name: string
  category: string
  description: string
  labels: Record<string, string>
  previewUrl?: string
  samples?: Array<{
    sample_id: string
    file_name: string
    mime_type: string
    size_bytes: number
    hash: string
  }>
}

// Audio output formats supported by ElevenLabs API
// Official docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
export type AudioFormat =
  // MP3 formats (compressed, widely compatible)
  | 'mp3_22050_32'    // 22.05kHz @ 32kbps
  | 'mp3_24000_48'    // 24kHz @ 48kbps
  | 'mp3_44100_32'    // 44.1kHz @ 32kbps
  | 'mp3_44100_64'    // 44.1kHz @ 64kbps
  | 'mp3_44100_96'    // 44.1kHz @ 96kbps
  | 'mp3_44100_128'   // 44.1kHz @ 128kbps (DEFAULT - all tiers)
  | 'mp3_44100_192'   // 44.1kHz @ 192kbps (Creator+ tier)
  // PCM formats (uncompressed, highest quality)
  | 'pcm_8000'        // 8kHz
  | 'pcm_16000'       // 16kHz
  | 'pcm_22050'       // 22.05kHz
  | 'pcm_24000'       // 24kHz
  | 'pcm_32000'       // 32kHz
  | 'pcm_44100'       // 44.1kHz (Pro+ tier)
  | 'pcm_48000'       // 48kHz
  // Opus formats (efficient compression, modern)
  | 'opus_48000_32'   // 48kHz @ 32kbps
  | 'opus_48000_64'   // 48kHz @ 64kbps
  | 'opus_48000_96'   // 48kHz @ 96kbps
  | 'opus_48000_128'  // 48kHz @ 128kbps
  | 'opus_48000_192'  // 48kHz @ 192kbps
  // Telephony formats (specialized use cases)
  | 'ulaw_8000'       // mu-law @ 8kHz
  | 'alaw_8000'       // a-law @ 8kHz

// Voice generation settings
export interface VoiceSettings {
  modelId?: string // 'eleven_multilingual_v2', 'eleven_turbo_v2_5', etc.
  outputFormat?: AudioFormat // Audio format (default: mp3_44100_128)
  stability?: number // 0-1, higher = more consistent
  similarityBoost?: number // 0-1, higher = closer to original voice
  style?: number // 0-1, style exaggeration
  useSpeakerBoost?: boolean // Boost speaker clarity
}

// Voice clip metadata
export interface VoiceClip {
  nodeId: string // Dialogue node ID
  text: string // Original text
  audioUrl: string // Relative path to MP3 file (e.g. 'voice/greeting.mp3')
  filepath?: string // Absolute filesystem path (server-side only)
  fileSize: number // Bytes
  duration?: number // Seconds (if available)
  generatedAt: string // ISO timestamp
  error?: string // Error message if generation failed
}

// Voice configuration for an NPC
export interface NPCVoiceConfig {
  npcId: string
  voiceId: string
  voiceName: string
  settings: VoiceSettings
  clips: Record<string, VoiceClip> // Map of dialogueNodeId -> VoiceClip
  totalClips: number
  generatedAt: string
}

// Voice generation request (single clip)
export interface VoiceGenerationRequest {
  text: string
  voiceId: string
  modelId?: string
  outputFormat?: AudioFormat
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
}

// Voice generation request (batch)
export interface VoiceBatchGenerationRequest {
  npcId: string
  dialogueNodes: Array<{ id: string; text: string }>
  voiceId: string
  settings?: VoiceSettings
}

// Voice generation response (batch)
export interface VoiceBatchGenerationResponse {
  success: boolean
  npcId: string
  voiceId: string
  clips: Record<string, VoiceClip>
  totalGenerated: number
  totalRequested: number
}

// Cost estimation
export interface VoiceCostEstimate {
  characterCount: number
  modelId: string
  creditsRequired: number
  estimatedCostUSD: string
}

// Voice library response
export interface VoiceLibraryResponse {
  voices: ElevenLabsVoice[]
  count: number
}

// Voice profile (saved to disk)
export interface VoiceProfile {
  npcId: string
  voiceId: string
  voiceName: string
  settings: VoiceSettings
  clips: number
  generatedAt: string
}

// Subscription info
export interface VoiceSubscriptionInfo {
  tier: string
  characterCount: number
  characterLimit: number
  canExtendCharacterLimit: boolean
  allowedToExtendCharacterLimit: boolean
  nextCharacterCountResetUnix: number
  voiceLimit: number
  professionalVoiceLimit: number
  canExtendVoiceLimit: boolean
  canUseInstantVoiceCloning: boolean
  canUseProfessionalVoiceCloning: boolean
  availableModels: string[]
  status: string
}

// TTS Model info
export interface VoiceModel {
  modelId: string
  name: string
  description: string
  canBeFinetuned: boolean
  canDoTextToSpeech: boolean
  canDoVoiceConversion: boolean
  canUseStyle: boolean
  canUseSpeakerBoost: boolean
  servesProVoices: boolean
  tokenCostFactor: number
  languages: Array<{
    languageId: string
    name: string
  }>
}

// Models list response
export interface VoiceModelsResponse {
  models: VoiceModel[]
  count: number
}

// Voice library cache entry
export interface VoiceCacheEntry {
  voices: ElevenLabsVoice[]
  cachedAt: number
  expiresAt: number
}

// Cache configuration
export const VOICE_CACHE_TTL = 15 * 60 * 1000 // 15 minutes in milliseconds
export const VOICE_CACHE_KEY = 'elevenlabs_voices_cache'

// Rate limit information
// Official docs: https://help.elevenlabs.io/hc/en-us/articles/14312733311761
export interface RateLimitInfo {
  currentConcurrentRequests: number
  maximumConcurrentRequests: number
  remainingCapacity: number
  utilizationPercent: number
  tier: string | null
  lastUpdated: number
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  retryableErrors: string[]
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ['429', 'system_busy', 'rate_limit', 'ECONNRESET', 'ETIMEDOUT']
}
