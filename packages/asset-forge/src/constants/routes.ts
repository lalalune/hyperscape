/**
 * Route constants for Asset Forge navigation
 * Centralized route definitions for type-safety and consistency
 */

export const ROUTES = {
  // Main pages
  HOME: '/',
  DASHBOARD: '/dashboard',

  // Asset Creation
  GENERATION: '/generate',
  ASSETS: '/assets',
  ASSETS_DETAIL: '/assets/:id',

  // Tools
  HAND_RIGGING: '/tools/hand-rigging',
  EQUIPMENT: '/tools/equipment-fitting',
  ARMOR_FITTING: '/tools/armor-fitting',

  // Game Content
  CONTENT: '/content',
  CONTENT_QUESTS: '/content/quests',
  CONTENT_NPCS: '/content/npcs',
  CONTENT_LORE: '/content/lore',
  CONTENT_SCRIPTS: '/content/scripts',
  CONTENT_TRACKING: '/content/tracking',
  CONTENT_VOICE: '/content/voice',

  // Voice Generation (new dedicated routes)
  VOICE_STANDALONE: '/voice/standalone',
  VOICE_MANIFESTS: '/voice/manifests',
  VOICE_DIALOGUE: '/voice/dialogue',

  // Data & Reference
  GAME_DATA: '/game-data',

  // User & Team Management
  PROJECTS: '/projects',
  TEAM: '/team',
  PROFILE: '/profile',

  // Admin
  ADMIN: '/admin',

  // System
  SETTINGS: '/settings',
  HELP: '/help',
} as const

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]

/**
 * Map old navigation views to new routes for compatibility
 */
export const LEGACY_VIEW_TO_ROUTE: Record<string, RoutePath> = {
  'generation': ROUTES.GENERATION,
  'assets': ROUTES.ASSETS,
  'handRigging': ROUTES.HAND_RIGGING,
  'equipment': ROUTES.EQUIPMENT,
  'armorFitting': ROUTES.ARMOR_FITTING,
  'gameData': ROUTES.GAME_DATA,
  'contentBuilder': ROUTES.CONTENT,
}

/**
 * Route metadata for breadcrumbs and page titles
 */
export interface RouteMetadata {
  path: RoutePath
  title: string
  parent?: RoutePath
  breadcrumb?: string
}

export const ROUTE_METADATA: Record<string, RouteMetadata> = {
  [ROUTES.HOME]: {
    path: ROUTES.HOME,
    title: 'Home',
  },
  [ROUTES.DASHBOARD]: {
    path: ROUTES.DASHBOARD,
    title: 'Dashboard',
    breadcrumb: 'Dashboard',
  },
  [ROUTES.GENERATION]: {
    path: ROUTES.GENERATION,
    title: 'Generate Assets',
    breadcrumb: 'Generate',
  },
  [ROUTES.ASSETS]: {
    path: ROUTES.ASSETS,
    title: 'Asset Library',
    breadcrumb: 'Assets',
  },
  [ROUTES.HAND_RIGGING]: {
    path: ROUTES.HAND_RIGGING,
    title: 'Hand Rigging',
    breadcrumb: 'Hand Rigging',
  },
  [ROUTES.EQUIPMENT]: {
    path: ROUTES.EQUIPMENT,
    title: 'Equipment Fitting',
    breadcrumb: 'Equipment',
  },
  [ROUTES.ARMOR_FITTING]: {
    path: ROUTES.ARMOR_FITTING,
    title: 'Armor Fitting',
    breadcrumb: 'Armor Fitting',
  },
  [ROUTES.CONTENT]: {
    path: ROUTES.CONTENT,
    title: 'Game Content',
    breadcrumb: 'Content',
  },
  [ROUTES.CONTENT_QUESTS]: {
    path: ROUTES.CONTENT_QUESTS,
    title: 'Quests',
    parent: ROUTES.CONTENT,
    breadcrumb: 'Quests',
  },
  [ROUTES.CONTENT_NPCS]: {
    path: ROUTES.CONTENT_NPCS,
    title: 'NPCs',
    parent: ROUTES.CONTENT,
    breadcrumb: 'NPCs',
  },
  [ROUTES.CONTENT_LORE]: {
    path: ROUTES.CONTENT_LORE,
    title: 'Lore',
    parent: ROUTES.CONTENT,
    breadcrumb: 'Lore',
  },
  [ROUTES.CONTENT_SCRIPTS]: {
    path: ROUTES.CONTENT_SCRIPTS,
    title: 'NPC Scripts',
    parent: ROUTES.CONTENT,
    breadcrumb: 'Scripts',
  },
  [ROUTES.CONTENT_TRACKING]: {
    path: ROUTES.CONTENT_TRACKING,
    title: 'Quest Tracking',
    parent: ROUTES.CONTENT,
    breadcrumb: 'Tracking',
  },
  [ROUTES.CONTENT_VOICE]: {
    path: ROUTES.CONTENT_VOICE,
    title: 'Voice Generation',
    parent: ROUTES.CONTENT,
    breadcrumb: 'Voice',
  },
  [ROUTES.VOICE_STANDALONE]: {
    path: ROUTES.VOICE_STANDALONE,
    title: 'Voice Experimentation',
    breadcrumb: 'Experiment',
  },
  [ROUTES.VOICE_MANIFESTS]: {
    path: ROUTES.VOICE_MANIFESTS,
    title: 'Manifest Voice Assignment',
    breadcrumb: 'Assign Voices',
  },
  [ROUTES.VOICE_DIALOGUE]: {
    path: ROUTES.VOICE_DIALOGUE,
    title: 'Dialogue Voice Generation',
    breadcrumb: 'Dialogue',
  },
  [ROUTES.GAME_DATA]: {
    path: ROUTES.GAME_DATA,
    title: 'Game Manifests',
    breadcrumb: 'Game Data',
  },
  [ROUTES.PROJECTS]: {
    path: ROUTES.PROJECTS,
    title: 'Projects',
    breadcrumb: 'Projects',
  },
  [ROUTES.TEAM]: {
    path: ROUTES.TEAM,
    title: 'Team',
    breadcrumb: 'Team',
  },
  [ROUTES.PROFILE]: {
    path: ROUTES.PROFILE,
    title: 'Profile',
    breadcrumb: 'Profile',
  },
  [ROUTES.ADMIN]: {
    path: ROUTES.ADMIN,
    title: 'Admin Dashboard',
    breadcrumb: 'Admin',
  },
  [ROUTES.SETTINGS]: {
    path: ROUTES.SETTINGS,
    title: 'Settings',
  },
  [ROUTES.HELP]: {
    path: ROUTES.HELP,
    title: 'Help & Documentation',
    breadcrumb: 'Help',
  },
}
