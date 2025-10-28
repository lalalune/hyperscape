/**
 * API Configuration
 *
 * Centralized API endpoint configuration for the HyperForge frontend.
 * Uses environment variables with sensible fallbacks for development.
 */

import { DEFAULT_API_URL, DEFAULT_CDN_URL } from '../constants/network'

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

// Log API configuration in production for debugging
console.log('[API Config] API_URL:', API_URL)
console.log('[API Config] VITE_API_URL from env:', import.meta.env?.VITE_API_URL)
console.log('[API Config] Mode:', import.meta.env?.MODE)

// Convenience export for API base URL (alias for API_URL)
export const API_BASE_URL = API_URL

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

  // Voice Generation - Advanced Features
  voiceSpeechToSpeech: `${API_URL}/api/voice/speech-to-speech`,
  voiceSpeechToSpeechStream: `${API_URL}/api/voice/speech-to-speech/stream`,
  voiceDesign: `${API_URL}/api/voice/design`,
  voiceCreateFromPreview: `${API_URL}/api/voice/create-from-preview`,
  voiceRateLimit: `${API_URL}/api/voice/rate-limit`,

  // Voice Generation - Manifest Assignment (NEW - requires backend implementation)
  voiceManifestAssign: `${API_URL}/api/voice/manifest/assign`,
  voiceManifestProfile: (manifestType: string, entityId: string) =>
    `${API_URL}/api/voice/manifest/${manifestType}/${entityId}`,
  voiceManifestBulk: `${API_URL}/api/voice/manifest/bulk`,
  voiceManifestBulkAssign: `${API_URL}/api/voice/manifest/bulk-assign`,
  voiceManifestDelete: (manifestType: string, entityId: string) =>
    `${API_URL}/api/voice/manifest/${manifestType}/${entityId}`,
  voiceManifestGenerateSample: `${API_URL}/api/voice/manifest/generate-sample`,

  // Sound Effects Generation
  sfxGenerate: `${API_URL}/api/sfx/generate`,
  sfxBatch: `${API_URL}/api/sfx/batch`,
  sfxEstimate: `${API_URL}/api/sfx/estimate`,

  // Music Generation
  musicGenerate: `${API_URL}/api/music/generate`,
  musicGenerateDetailed: `${API_URL}/api/music/generate-detailed`,
  musicPlan: `${API_URL}/api/music/plan`,
  musicBatch: `${API_URL}/api/music/batch`,
  musicStatus: `${API_URL}/api/music/status`,

  // Hyperscape Manifests API
  manifestsList: `${API_URL}/api/manifests`,
  manifestsGet: (type: string) => `${API_URL}/api/manifests/${type}`,
  manifestsGetItem: (type: string, id: string) => `${API_URL}/api/manifests/${type}/${id}`,
  manifestsUpdate: (type: string) => `${API_URL}/api/manifests/${type}`,
  manifestsAddItem: (type: string) => `${API_URL}/api/manifests/${type}/item`,
  manifestsUpdateItem: (type: string, id: string) => `${API_URL}/api/manifests/${type}/${id}`,

  // Preview Manifests
  previewManifests: `${API_URL}/api/preview-manifests`,
  previewManifestsType: (type: string) => `${API_URL}/api/preview-manifests/${type}`,
  previewManifestsMerged: (type: string) => `${API_URL}/api/preview-manifests/${type}/merged`, // NEW: Merged view (original + user drafts)
  previewManifestsItem: (type: string) => `${API_URL}/api/preview-manifests/${type}/item`,
  previewManifestsUpdateItem: (type: string, itemId: string) => `${API_URL}/api/preview-manifests/${type}/${itemId}`,
  previewManifestsTeam: (teamId: string) => `${API_URL}/api/preview-manifests/team/${teamId}`,
  previewManifestsTeamItem: (teamId: string, type: string) => `${API_URL}/api/preview-manifests/team/${teamId}/${type}/item`,
  previewManifestsTeamUpdateItem: (teamId: string, type: string, itemId: string) => `${API_URL}/api/preview-manifests/team/${teamId}/${type}/${itemId}`,

  // Submissions
  submissions: `${API_URL}/api/submissions`,
  submissionsDetail: (id: string) => `${API_URL}/api/submissions/${id}`,
  submissionsWithdraw: (id: string) => `${API_URL}/api/submissions/${id}/withdraw`,
  submissionsStats: `${API_URL}/api/submissions/stats`,

  // Admin Approvals (mounted at /api/admin/submissions in backend)
  adminPendingSubmissions: `${API_URL}/api/admin/submissions/pending`,
  adminSubmissionDetail: (id: string) => `${API_URL}/api/admin/submissions/${id}`,
  adminEditSubmission: (id: string) => `${API_URL}/api/admin/submissions/${id}/edit`,
  adminApproveSubmission: (id: string) => `${API_URL}/api/admin/submissions/${id}/approve`,
  adminRejectSubmission: (id: string) => `${API_URL}/api/admin/submissions/${id}/reject`,
  adminSubmissionStats: `${API_URL}/api/admin/submissions/stats`,

  // AI Context
  aiContextPreferences: `${API_URL}/api/ai-context/preferences`,
  aiContextBuild: `${API_URL}/api/ai-context/build`,

  // Quest Management
  questFixWithAI: `${API_URL}/api/quests/fix-with-ai`,
  questValidate: `${API_URL}/api/quests/validate`,

  // Admin Logs
  adminLogsStats: `${API_URL}/api/admin/logs/stats`,
  adminLogsErrors: `${API_URL}/api/admin/logs/errors`,
  adminLogsErrorFixPrompt: (index: number) => `${API_URL}/api/admin/logs/error/${index}/fix-prompt`,
  adminLogsClear: `${API_URL}/api/admin/logs/clear`,
} as const
