import { NavigationView } from '../types'

// Navigation view constants
export const NAVIGATION_VIEWS = {
  ASSETS: 'assets',
  GENERATION: 'generation',
  EQUIPMENT: 'equipment',
  HAND_RIGGING: 'handRigging',
  ARMOR_FITTING: 'armorFitting',
  GAME_DATA: 'gameData',
  CONTENT_BUILDER: 'contentBuilder',
  VOICE: 'voice',
  VOICE_STANDALONE: 'voice-standalone',
  VOICE_MANIFESTS: 'voice-manifests',
  DASHBOARD: 'dashboard',
  ADMIN: 'admin',
  PROJECTS: 'projects',
  PROFILE: 'profile',
  TEAM: 'team'
} as const satisfies Record<string, NavigationView>

// Grid background styles for the app
export const APP_BACKGROUND_STYLES = {
  gridSize: '50px 50px',
  gridImage: `linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
               linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)`
} as const