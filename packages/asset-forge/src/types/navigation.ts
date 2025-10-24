import type { LucideIcon } from 'lucide-react'

import type { RoutePath } from '../constants/routes'

// ============================================================================
// LEGACY TYPES (for compatibility during migration)
// ============================================================================

export type NavigationView =
  | 'assets'
  | 'generation'
  | 'equipment'
  | 'handRigging'
  | 'armorFitting'
  | 'gameData'
  | 'contentBuilder'
  | 'voice'
  | 'voice-standalone'
  | 'voice-manifests'
  | 'dashboard'
  | 'admin'
  | 'projects'
  | 'profile'
  | 'team'

export interface NavigationState {
  currentView: NavigationView
  selectedAssetId: string | null
  navigationHistory: NavigationView[]
}

export interface NavigationContextValue extends NavigationState {
  // Navigation actions
  navigateTo: (view: NavigationView) => void
  navigateToAsset: (assetId: string) => void
  goBack: () => void

  // Navigation helpers
  canGoBack: boolean
}

// ============================================================================
// NEW NAVIGATION TYPES
// ============================================================================

/**
 * Badge configuration for navigation items
 */
export interface NavigationBadge {
  /** Badge display type */
  type: 'count' | 'status' | 'new' | 'beta' | 'text'
  /** Dynamic count getter (for 'count' type) */
  count?: () => number
  /** Status color (for 'status' type) */
  status?: 'success' | 'warning' | 'error' | 'info'
  /** Custom label (for 'text' type) */
  label?: string
  /** Custom CSS classes */
  className?: string
}

/**
 * Permission check function
 * Returns true if user has access to this nav item
 */
export type PermissionCheck = () => boolean

/**
 * Conditional visibility check
 * Returns true if this nav item should be visible
 */
export type VisibilityCheck = () => boolean

/**
 * Base navigation item properties
 */
export interface NavigationItemBase {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Route path */
  path?: RoutePath
  /** Optional badge configuration */
  badge?: NavigationBadge
  /** Permission check (defaults to true) */
  permission?: PermissionCheck
  /** Visibility check (defaults to true) */
  visible?: VisibilityCheck
  /** Tooltip description */
  tooltip?: string
  /** Keyboard shortcut hint */
  shortcut?: string
  /** Keywords for search */
  keywords?: string[]
  /** Mark as new feature */
  isNew?: boolean
  /** Mark as beta feature */
  isBeta?: boolean
}

/**
 * Navigation link item (navigates to a route)
 */
export interface NavigationLink extends NavigationItemBase {
  type: 'link'
  path: RoutePath
  /** Children items (for sub-navigation) */
  children?: NavigationLink[]
}

/**
 * Navigation action item (triggers an action instead of routing)
 */
export interface NavigationAction extends NavigationItemBase {
  type: 'action'
  /** Action handler */
  action: () => void
}

/**
 * Navigation item can be either a link or action
 */
export type NavigationItem = NavigationLink | NavigationAction

/**
 * Navigation section (group of related items)
 */
export interface NavigationSection {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Icon for the section */
  icon?: LucideIcon
  /** Section type */
  type: 'single' | 'group' | 'collapsible'
  /** Route for single-type sections */
  path?: RoutePath
  /** Items in this section */
  items?: NavigationItem[]
  /** Whether section is collapsible (for 'collapsible' type) */
  collapsible?: boolean
  /** Default collapsed state */
  defaultExpanded?: boolean
  /** Permission check for entire section */
  permission?: PermissionCheck
  /** Visibility check for entire section */
  visible?: VisibilityCheck
  /** Badge for the section */
  badge?: NavigationBadge
  /** Tooltip for the section */
  tooltip?: string
  /** Keywords for search */
  keywords?: string[]
  /** Admin only - only show for admin users */
  adminOnly?: boolean
}

/**
 * Quick access configuration
 */
export interface QuickAccessConfig {
  enabled: boolean
  maxItems: number
  showRecent: boolean
  showFavorites: boolean
}

/**
 * Navigation footer configuration
 */
export interface NavigationFooter {
  items: NavigationItem[]
  user?: {
    name: string
    email: string
    avatar?: string
  }
  version?: string
}

/**
 * Complete navigation configuration
 */
export interface NavigationConfig {
  sections: NavigationSection[]
  quickAccess: QuickAccessConfig
  footer: NavigationFooter
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string
  path?: RoutePath
  icon?: LucideIcon
}

/**
 * Navigation analytics event
 */
export interface NavigationEvent {
  type: 'navigate' | 'favorite' | 'search' | 'collapse' | 'expand'
  path: string
  timestamp: number
  metadata?: Record<string, any>
} 