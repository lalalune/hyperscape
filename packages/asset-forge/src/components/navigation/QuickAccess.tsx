/**
 * QuickAccess - Recent items and favorites panel
 *
 * Beautiful quick access panel showing recently visited pages
 * and favorited items for faster navigation.
 */

import { Clock, Star, Trash2 } from 'lucide-react'
import React, { useCallback } from 'react'

import { getNavItemForRoute } from '../../config/navigation-config'
import { isRouteActive } from '../../config/navigation-config'
import type { RoutePath } from '../../constants/routes'
import { useNavigationStore } from '../../store/useNavigationStore'

// Memoized QuickAccessItem to prevent unnecessary re-renders
const QuickAccessItem = React.memo(({
  path,
  currentPath,
  isFavorite,
  navigateTo,
  toggleFavorite
}: {
  path: RoutePath
  currentPath: string
  isFavorite: boolean
  navigateTo: (path: RoutePath | string) => void
  toggleFavorite: (path: RoutePath) => void
}) => {
  const handleNavigate = useCallback(() => {
    navigateTo(path)
  }, [navigateTo, path])

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(path)
  }, [toggleFavorite, path])

  const navItem = getNavItemForRoute(path)
  if (!navItem) return null

  const isActive = isRouteActive(path, currentPath)

  return (
    <div className="relative group">
      <button
        onClick={handleNavigate}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-md
          text-sm font-medium transition-all duration-base
          ${
            isActive
              ? 'bg-primary bg-opacity-10 text-primary border-l-2 border-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-l-2 border-transparent'
          }
        `}
      >
        <navItem.icon size={16} className="shrink-0" />
        <span className="truncate flex-1 text-left">{navItem.label}</span>
      </button>

      <button
        onClick={handleToggleFavorite}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-bg-tertiary rounded"
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          size={14}
          fill={isFavorite ? 'currentColor' : 'none'}
          className={isFavorite ? 'text-yellow-500' : 'text-text-secondary'}
        />
      </button>
    </div>
  )
})
QuickAccessItem.displayName = 'QuickAccessItem'

export default function QuickAccess() {
  const collapsed = useNavigationStore(state => state.collapsed)
  const recentItems = useNavigationStore(state => state.recentItems)
  const favoriteItems = useNavigationStore(state => state.favoriteItems)
  const currentPath = useNavigationStore(state => state.currentPath)
  const navigateTo = useNavigationStore(state => state.navigateTo)
  const toggleFavorite = useNavigationStore(state => state.toggleFavorite)
  const clearRecentItems = useNavigationStore(state => state.clearRecentItems)

  // Don't show when collapsed - items are shown in tooltips
  if (collapsed) return null

  const hasFavorites = favoriteItems.length > 0
  const hasRecent = recentItems.length > 0

  if (!hasFavorites && !hasRecent) return null

  return (
    <div className="mt-4 pt-4 border-t border-border-primary">
      {/* Favorites */}
      {hasFavorites && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-text-secondary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Favorites
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {favoriteItems.slice(0, 5).map((path) => (
              <QuickAccessItem
                key={path}
                path={path}
                currentPath={currentPath}
                isFavorite={true}
                navigateTo={navigateTo}
                toggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Items */}
      {hasRecent && (
        <div>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-secondary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Recent
              </span>
            </div>

            {/* Clear Recent */}
            <button
              onClick={clearRecentItems}
              className="p-1 hover:bg-bg-tertiary rounded transition-colors"
              title="Clear recent items"
              aria-label="Clear recent items"
            >
              <Trash2 size={12} className="text-text-secondary hover:text-text-primary" />
            </button>
          </div>

          <div className="space-y-1">
            {recentItems.slice(0, 5).map((path) => (
              <QuickAccessItem
                key={path}
                path={path}
                currentPath={currentPath}
                isFavorite={favoriteItems.includes(path)}
                navigateTo={navigateTo}
                toggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
