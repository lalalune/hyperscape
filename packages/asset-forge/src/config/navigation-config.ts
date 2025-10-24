/**
 * Navigation Configuration
 *
 * Single source of truth for all navigation in Asset Forge.
 * Defines routes, menu items, groups, permissions, and behaviors.
 *
 * @module navigation-config
 */

import {
  Home,
  Wand2,
  Database,
  Hand,
  Wrench,
  Shield,
  Scroll,
  FileJson,
  Mic,
  FileCode,
  Target,
  Users,
  BookOpen,
  MessageSquare,
  ListChecks,
  Settings,
  HelpCircle,
  Star,
  Clock,
  Sparkles,
} from 'lucide-react'

import type { NavigationConfig, NavigationLink } from '../types/navigation'
import { ROUTES } from '../constants/routes'

/**
 * Primary navigation configuration
 * Defines all navigation items, groups, and their structure
 */
export const navigationConfig: NavigationConfig = {
  sections: [
    // Home
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      type: 'single',
      path: ROUTES.HOME,
    },

    // Quick Access
    {
      id: 'quick-access',
      label: 'Quick Access',
      type: 'collapsible',
      collapsible: true,
      defaultExpanded: false,
      items: [
        {
          id: 'recent',
          type: 'link',
          label: 'Recent Assets',
          icon: Clock,
          path: ROUTES.ASSETS,
          tooltip: 'Recently accessed assets',
          keywords: ['recent', 'history', 'last'],
        },
        {
          id: 'favorites',
          type: 'link',
          label: 'Favorites',
          icon: Star,
          path: ROUTES.ASSETS,
          tooltip: 'Your favorite assets',
          keywords: ['favorites', 'starred', 'bookmarks'],
        },
      ],
    },

    // Asset Creation
    {
      id: 'asset-creation',
      label: 'Creation',
      type: 'collapsible',
      icon: Wand2,
      collapsible: true,
      defaultExpanded: true,
      items: [
        {
          id: 'generate',
          type: 'link',
          path: ROUTES.GENERATION,
          label: 'Generate',
          icon: Wand2,
          tooltip: 'Create new 3D assets with AI',
          keywords: ['generate', 'create', 'ai', 'meshy', 'new asset'],
          shortcut: 'g',
        },
        {
          id: 'assets',
          type: 'link',
          path: ROUTES.ASSETS,
          label: 'Asset Library',
          icon: Database,
          tooltip: 'Browse and manage your assets',
          keywords: ['assets', 'library', 'browse', 'manage', 'models'],
          shortcut: 'a',
        },
      ],
    },

    // Tools
    {
      id: 'fitting-rigging',
      label: 'Fitting & Rigging',
      type: 'collapsible',
      icon: Wrench,
      collapsible: true,
      defaultExpanded: false,
      items: [
        {
          id: 'hand-rigging',
          type: 'link',
          path: ROUTES.HAND_RIGGING,
          label: 'Hand Rigging',
          icon: Hand,
          tooltip: 'Rig hand-held items and weapons',
          keywords: ['hand', 'rigging', 'grip', 'weapon', 'hold'],
          shortcut: 'h',
        },
        {
          id: 'equipment',
          type: 'link',
          path: ROUTES.EQUIPMENT,
          label: 'Equipment Fitting',
          icon: Wrench,
          tooltip: 'Fit equipment to character models',
          keywords: ['equipment', 'fitting', 'attach', 'equip'],
          shortcut: 'e',
        },
        {
          id: 'armor',
          type: 'link',
          path: ROUTES.ARMOR_FITTING,
          label: 'Armor Fitting',
          icon: Shield,
          tooltip: 'Fit armor pieces to character models',
          keywords: ['armor', 'fitting', 'character', 'body'],
        },
      ],
    },

    // Game Content
    {
      id: 'game-content',
      label: 'Game Content',
      type: 'collapsible',
      icon: Scroll,
      collapsible: true,
      defaultExpanded: false,
      items: [
        {
          id: 'quests',
          type: 'link',
          path: ROUTES.CONTENT_QUESTS,
          label: 'Quests',
          icon: Target,
          tooltip: 'Generate and manage quests',
          keywords: ['quest', 'mission', 'objective', 'task'],
          shortcut: 'q',
        },
        {
          id: 'npcs',
          type: 'link',
          path: ROUTES.CONTENT_NPCS,
          label: 'NPCs',
          icon: Users,
          tooltip: 'Create NPC characters with personalities',
          keywords: ['npc', 'character', 'dialogue', 'personality'],
          shortcut: 'n',
        },
        {
          id: 'lore',
          type: 'link',
          path: ROUTES.CONTENT_LORE,
          label: 'Lore',
          icon: BookOpen,
          tooltip: 'Generate world lore and backstory',
          keywords: ['lore', 'story', 'world', 'backstory'],
          shortcut: 'l',
        },
        {
          id: 'scripts',
          type: 'link',
          path: ROUTES.CONTENT_SCRIPTS,
          label: 'NPC Scripts',
          icon: FileCode,
          tooltip: 'Manage NPC behavior scripts',
          keywords: ['script', 'code', 'npc', 'behavior'],
        },
        {
          id: 'voice',
          type: 'link',
          path: ROUTES.CONTENT_VOICE,
          label: 'Voice Generation',
          icon: Mic,
          tooltip: 'Generate voice clips with ElevenLabs',
          keywords: ['voice', 'audio', 'elevenlabs', 'speech', 'tts'],
          isNew: true,
        },
        {
          id: 'tracking',
          type: 'link',
          path: ROUTES.CONTENT_TRACKING,
          label: 'Quest Tracker',
          icon: ListChecks,
          tooltip: 'Quest execution and tracking system',
          keywords: ['tracking', 'quest', 'objectives', 'progress'],
        },
      ],
    },

    // Voice Generation (dedicated section)
    {
      id: 'voice-generation',
      label: 'Voice Generation',
      type: 'collapsible',
      icon: Mic,
      collapsible: true,
      defaultExpanded: false,
      items: [
        {
          id: 'voice-experiment',
          type: 'link',
          path: ROUTES.VOICE_STANDALONE,
          label: 'Experiment',
          icon: Sparkles,
          tooltip: 'Test voices and settings without NPCs',
          keywords: ['voice', 'experiment', 'test', 'standalone', 'preview'],
          isNew: true,
        },
        {
          id: 'voice-manifests',
          type: 'link',
          path: ROUTES.VOICE_MANIFESTS,
          label: 'Assign to Manifests',
          icon: Users,
          tooltip: 'Assign voices to NPCs and mobs from manifests',
          keywords: ['voice', 'manifest', 'npc', 'mob', 'assign'],
          isNew: true,
        },
        {
          id: 'voice-dialogue',
          type: 'link',
          path: ROUTES.CONTENT_VOICE,
          label: 'Dialogue Trees',
          icon: MessageSquare,
          tooltip: 'Generate voices for NPC dialogue scripts',
          keywords: ['voice', 'dialogue', 'script', 'npc'],
        },
      ],
    },

    // Game Data
    {
      id: 'game-data',
      label: 'Game Manifests',
      icon: FileJson,
      type: 'single',
      path: ROUTES.GAME_DATA,
      tooltip: 'Browse game data manifests',
      keywords: ['manifest', 'data', 'items', 'mobs', 'resources'],
    },
  ],

  quickAccess: {
    enabled: true,
    maxItems: 5,
    showRecent: true,
    showFavorites: true,
  },

  footer: {
    items: [
      {
        id: 'settings',
        type: 'link',
        path: ROUTES.SETTINGS,
        label: 'Settings',
        icon: Settings,
        tooltip: 'Application settings and preferences',
        keywords: ['settings', 'preferences', 'config', 'options'],
        shortcut: ',',
      },
      {
        id: 'help',
        type: 'link',
        path: ROUTES.HELP,
        label: 'Help',
        icon: HelpCircle,
        tooltip: 'Help and documentation',
        keywords: ['help', 'docs', 'support', 'documentation', 'guide'],
        shortcut: '?',
      },
    ],
    version: '1.0.0',
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a navigation item is a link (has a route)
 */
export function isNavLink(item: any): item is NavigationLink {
  return item.type === 'link' && 'path' in item
}

// Cached nav items for performance
let cachedNavItems: NavigationLink[] | null = null

/**
 * Get all nav items (flattened from all groups and sections)
 * Cached for performance
 */
export function getAllNavItems(): NavigationLink[] {
  if (cachedNavItems) return cachedNavItems

  const items: NavigationLink[] = []

  for (const section of navigationConfig.sections) {
    if (section.type === 'single' && section.path && section.icon) {
      items.push({
        id: section.id,
        type: 'link',
        label: section.label,
        icon: section.icon,
        path: section.path,
        tooltip: section.tooltip,
        keywords: section.keywords,
      } as NavigationLink)
    } else if (section.items) {
      for (const item of section.items) {
        if (isNavLink(item)) {
          items.push(item)
        }
      }
    }
  }

  // Add footer items
  for (const item of navigationConfig.footer.items) {
    if (isNavLink(item)) {
      items.push(item)
    }
  }

  cachedNavItems = items
  return items
}

/**
 * Get section for nav item by validating section.icon exists
 */
// function getSectionIconSafely(section: any): any {
//   if (section.icon) {
//     return section.icon
//   }
//   // Return a default icon or undefined
//   return undefined
// }

/**
 * Find a nav item by ID
 */
export function findNavItem(id: string): NavigationLink | undefined {
  return getAllNavItems().find(item => item.id === id)
}

// Cached route map for O(1) lookups
let routeMap: Map<string, NavigationLink> | null = null

/**
 * Get nav item for a route path
 * Optimized with Map for O(1) lookups
 */
export function getNavItemForRoute(path: string): NavigationLink | undefined {
  if (!routeMap) {
    routeMap = new Map()
    getAllNavItems().forEach(item => routeMap!.set(item.path, item))
  }
  return routeMap.get(path)
}

/**
 * Check if a route is active (matches current path)
 */
export function isRouteActive(
  itemPath: string,
  currentPath: string,
  exact: boolean = false
): boolean {
  if (exact) {
    return itemPath === currentPath
  }

  // Normalize paths
  const normalizedItemPath = itemPath.replace(/\/$/, '')
  const normalizedCurrentPath = currentPath.replace(/\/$/, '')

  return (
    normalizedCurrentPath === normalizedItemPath ||
    normalizedCurrentPath.startsWith(normalizedItemPath + '/')
  )
}

/**
 * Get active nav item for current route
 */
export function getActiveNavItem(currentPath: string): NavigationLink | undefined {
  const allItems = getAllNavItems()

  // First try exact match
  const exactMatch = allItems.find(item => isRouteActive(item.path, currentPath, true))

  if (exactMatch) return exactMatch

  // Then try parent path match (longest match first)
  const sortedItems = allItems
    .filter(item => item.path)
    .sort((a, b) => b.path.length - a.path.length)

  return sortedItems.find(item => isRouteActive(item.path, currentPath))
}

export default navigationConfig
