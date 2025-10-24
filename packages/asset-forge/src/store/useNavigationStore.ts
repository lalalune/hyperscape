/**
 * Navigation Store
 *
 * Zustand store for managing navigation state, history, and quick access items.
 * Replaces the old NavigationContext with a more powerful and persistent solution.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { ROUTES, LEGACY_VIEW_TO_ROUTE, type RoutePath } from '../constants/routes'
import type { NavigationView } from '../types/navigation'

const MAX_HISTORY = 50
const MAX_RECENT_ITEMS = 10

interface NavigationState {
  // Current state
  currentPath: RoutePath
  currentSection: string | null
  expandedSections: string[]
  collapsed: boolean

  // History
  history: RoutePath[]
  historyIndex: number

  // Quick access
  recentItems: RoutePath[]
  favoriteItems: RoutePath[]

  // UI state
  searchOpen: boolean
  mobileMenuOpen: boolean

  // Actions
  navigateTo: (path: RoutePath | string) => void
  navigateToLegacyView: (view: NavigationView) => void
  navigateToAsset: (assetId: string) => void
  goBack: () => void
  goForward: () => void
  toggleSection: (sectionId: string) => void
  toggleCollapse: () => void
  setCollapsed: (collapsed: boolean) => void
  addToRecent: (path: RoutePath) => void
  toggleFavorite: (path: RoutePath) => void
  clearRecentItems: () => void
  setSearchOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void

  // Helpers
  canGoBack: () => boolean
  canGoForward: () => boolean
  isFavorite: (path: RoutePath) => boolean
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentPath: ROUTES.GENERATION, // Default to generation page
      currentSection: null,
      expandedSections: ['asset-creation'], // Start with creation section expanded
      collapsed: false,
      history: [ROUTES.GENERATION],
      historyIndex: 0,
      recentItems: [],
      favoriteItems: [],
      searchOpen: false,
      mobileMenuOpen: false,

      // Actions
      navigateTo: (path: RoutePath | string) => {
        // Normalize path - prepend '/' if missing
        const normalizedPath = (path.startsWith('/') ? path : '/' + path) as RoutePath

        const state = get()

        // Don't add duplicate consecutive entries
        if (state.history[state.historyIndex] === normalizedPath) {
          return
        }

        // Add to history (remove forward history if navigating from middle)
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push(normalizedPath)

        // Limit history size efficiently
        const trimmedHistory = newHistory.length > MAX_HISTORY
          ? newHistory.slice(-MAX_HISTORY)
          : newHistory

        set(draft => {
          draft.currentPath = normalizedPath
          draft.history = trimmedHistory
          draft.historyIndex = trimmedHistory.length - 1
          draft.mobileMenuOpen = false // Close mobile menu on navigation
        })

        // Add to recent items
        state.addToRecent(normalizedPath)
      },

      navigateToLegacyView: (view: NavigationView) => {
        const path = LEGACY_VIEW_TO_ROUTE[view] || ROUTES.HOME
        get().navigateTo(path)
      },

      navigateToAsset: (_assetId: string) => {
        // Navigate to assets page with selected asset
        const path = ROUTES.ASSETS
        get().navigateTo(path)
        // Note: Asset selection is handled by useAssetsStore
      },

      goBack: () => {
        const { history, historyIndex } = get()
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          set(state => {
            state.currentPath = history[newIndex]
            state.historyIndex = newIndex
          })
        }
      },

      goForward: () => {
        const { history, historyIndex } = get()
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1
          set(state => {
            state.currentPath = history[newIndex]
            state.historyIndex = newIndex
          })
        }
      },

      toggleSection: (sectionId: string) => {
        set(state => {
          const isExpanded = state.expandedSections.includes(sectionId)
          if (isExpanded) {
            state.expandedSections = state.expandedSections.filter(id => id !== sectionId)
          } else {
            state.expandedSections.push(sectionId)
          }
        })
      },

      toggleCollapse: () => {
        set(state => {
          state.collapsed = !state.collapsed
        })
      },

      setCollapsed: (collapsed: boolean) => {
        set({ collapsed })
      },

      addToRecent: (path: RoutePath) => {
        set(draft => {
          // Remove if already exists and add to front
          const index = draft.recentItems.indexOf(path)
          if (index !== -1) {
            draft.recentItems.splice(index, 1)
          }
          draft.recentItems.unshift(path)

          // Limit size
          if (draft.recentItems.length > MAX_RECENT_ITEMS) {
            draft.recentItems = draft.recentItems.slice(0, MAX_RECENT_ITEMS)
          }
        })
      },

      toggleFavorite: (path: RoutePath) => {
        set(state => {
          const isFavorite = state.favoriteItems.includes(path)
          if (isFavorite) {
            state.favoriteItems = state.favoriteItems.filter(item => item !== path)
          } else {
            state.favoriteItems.push(path)
          }
        })
      },

      clearRecentItems: () => {
        set({ recentItems: [] })
      },

      setSearchOpen: (open: boolean) => {
        set({ searchOpen: open })
      },

      setMobileMenuOpen: (open: boolean) => {
        set({ mobileMenuOpen: open })
      },

      // Helpers
      canGoBack: () => {
        const { historyIndex } = get()
        return historyIndex > 0
      },

      canGoForward: () => {
        const { history, historyIndex } = get()
        return historyIndex < history.length - 1
      },

      isFavorite: (path: RoutePath) => {
        const { favoriteItems } = get()
        return favoriteItems.includes(path)
      },
    })),
    {
      name: 'navigation-store',
      version: 1,
      // Only persist user preferences and history
      partialize: state => ({
        expandedSections: state.expandedSections,
        collapsed: state.collapsed,
        history: state.history.slice(-10), // Only last 10 for size
        historyIndex: 0, // Reset index on reload
        recentItems: state.recentItems,
        favoriteItems: state.favoriteItems,
        // Don't persist: currentPath, searchOpen, mobileMenuOpen
      }),
    }
  )
)

// Convenience selectors
export const useCurrentPath = () => useNavigationStore(state => state.currentPath)
export const useCollapsed = () => useNavigationStore(state => state.collapsed)
export const useRecentItems = () => useNavigationStore(state => state.recentItems)
export const useFavoriteItems = () => useNavigationStore(state => state.favoriteItems)
export const useExpandedSections = () => useNavigationStore(state => state.expandedSections)
export const useMobileMenuOpen = () => useNavigationStore(state => state.mobileMenuOpen)
