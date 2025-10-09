import { NavigationView } from '../types'

// Navigation view constants
export const NAVIGATION_VIEWS = {
  ASSETS: 'assets',
  GENERATION: 'generation',
  EQUIPMENT: 'equipment',
  HAND_RIGGING: 'handRigging',
  ARMOR_FITTING: 'armorFitting'
} as const satisfies Record<string, NavigationView>

// Grid background styles for the app
export const APP_BACKGROUND_STYLES = {
  gridSize: '50px 50px',
  gridImage: `linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
               linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)`
} as const