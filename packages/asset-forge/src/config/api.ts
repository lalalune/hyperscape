/**
 * API Configuration
 *
 * Centralized API endpoint configuration for the Asset Forge frontend.
 * Uses environment variables with sensible fallbacks for development.
 */

import { DEFAULT_API_URL, DEFAULT_CDN_URL } from '../constants/network.ts'

// Get API URL from environment variable or fall back to localhost
const getApiUrl = (): string => {
  // Try various environment variable patterns depending on build tool
  if (typeof process !== 'undefined' && process.env) {
    // Create React App / Webpack
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL
    }
    // Next.js
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL
    }
  }

  // Vite
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string
  }

  // Default to localhost for development
  return DEFAULT_API_URL
}

// Get CDN URL from environment variable or fall back to localhost
const getCdnUrl = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.REACT_APP_CDN_URL) {
      return process.env.REACT_APP_CDN_URL
    }
    if (process.env.NEXT_PUBLIC_CDN_URL) {
      return process.env.NEXT_PUBLIC_CDN_URL
    }
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CDN_URL) {
    return import.meta.env.VITE_CDN_URL as string
  }

  return DEFAULT_CDN_URL
}

export const API_URL = getApiUrl()
export const CDN_URL = getCdnUrl()

// API Endpoints
export const API_ENDPOINTS = {
  generateDialogue: `${API_URL}/api/generate-dialogue`,
  generateNPC: `${API_URL}/api/generate-npc`,
  generateQuest: `${API_URL}/api/generate-quest`,
  npcCollaboration: `${API_URL}/api/generate-npc-collaboration`,
  playtesterSwarm: `${API_URL}/api/generate-playtester-swarm`,
  playtesterPersonas: `${API_URL}/api/playtester-personas`,

  // Voice Generation - Core
  voiceLibrary: `${API_URL}/api/voice/library`,
  voiceGenerate: `${API_URL}/api/voice/generate`,
  voiceBatch: `${API_URL}/api/voice/batch`,
  voiceProfile: (npcId: string) => `${API_URL}/api/voice/profile/${npcId}`,
  voiceDelete: (npcId: string) => `${API_URL}/api/voice/${npcId}`,
  voiceEstimate: `${API_URL}/api/voice/estimate`,
  voiceSubscription: `${API_URL}/api/voice/subscription`,
  voiceModels: `${API_URL}/api/voice/models`,

  // Voice Generation - Manifest Assignment (NEW - requires backend implementation)
  voiceManifestAssign: `${API_URL}/api/voice/manifest/assign`,
  voiceManifestProfile: (manifestType: string, entityId: string) =>
    `${API_URL}/api/voice/manifest/${manifestType}/${entityId}`,
  voiceManifestBulk: `${API_URL}/api/voice/manifest/bulk`,
  voiceManifestBulkAssign: `${API_URL}/api/voice/manifest/bulk-assign`,
  voiceManifestDelete: (manifestType: string, entityId: string) =>
    `${API_URL}/api/voice/manifest/${manifestType}/${entityId}`,
  voiceManifestGenerateSample: `${API_URL}/api/voice/manifest/generate-sample`,
} as const
