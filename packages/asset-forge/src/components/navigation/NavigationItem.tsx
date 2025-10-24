/**
 * NavigationItem - Individual navigation link component
 *
 * Beautiful navigation item with active state, hover effects,
 * tooltips, keyboard shortcuts, and badges.
 */

import { useCallback, useMemo } from 'react'

import { isRouteActive } from '../../config/navigation-config'
import { useNavigationStore } from '../../store/useNavigationStore'
import type { NavigationLink } from '../../types/navigation'

interface NavigationItemProps {
  item: NavigationLink
}

export default function NavigationItem({ item }: NavigationItemProps) {
  const currentPath = useNavigationStore(state => state.currentPath)
  const collapsed = useNavigationStore(state => state.collapsed)
  const navigateTo = useNavigationStore(state => state.navigateTo)

  const isActive = useMemo(
    () => isRouteActive(item.path, currentPath),
    [item.path, currentPath]
  )

  const handleClick = useCallback(() => {
    navigateTo(item.path)
  }, [navigateTo, item.path])

  // Check permission and visibility
  if (item.permission && !item.permission()) return null
  if (item.visible && !item.visible()) return null

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-md
        text-sm font-medium transition-all duration-base
        ${collapsed ? 'justify-center' : 'justify-start'}
        ${
          isActive
            ? 'bg-primary bg-opacity-10 text-primary border-l-2 border-primary'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-l-2 border-transparent'
        }
      `}
      title={collapsed ? item.label : item.tooltip}
      aria-current={isActive ? 'page' : undefined}
      data-testid={`nav-item-${item.id}`}
    >
      {/* Icon */}
      <item.icon size={18} className="shrink-0" />

      {/* Label and Badge */}
      {!collapsed && (
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="truncate">{item.label}</span>

          {/* Badges and Shortcuts */}
          <div className="flex items-center gap-2 ml-2">
            {/* New Badge */}
            {item.isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary text-white">
                New
              </span>
            )}

            {/* Beta Badge */}
            {item.isBeta && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-secondary text-white">
                Beta
              </span>
            )}

            {/* Custom Badge */}
            {item.badge && (
              <>
                {item.badge.type === 'count' && item.badge.count && item.badge.count() > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium bg-primary text-white">
                    {item.badge.count()}
                  </span>
                )}

                {item.badge.type === 'status' && (
                  <span
                    className={`
                      w-2 h-2 rounded-full
                      ${item.badge.status === 'success' ? 'bg-green-500' : ''}
                      ${item.badge.status === 'warning' ? 'bg-yellow-500' : ''}
                      ${item.badge.status === 'error' ? 'bg-red-500' : ''}
                      ${item.badge.status === 'info' ? 'bg-blue-500' : ''}
                    `}
                  />
                )}

                {item.badge.type === 'text' && item.badge.label && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-bg-tertiary text-text-secondary">
                    {item.badge.label}
                  </span>
                )}
              </>
            )}

            {/* Keyboard Shortcut */}
            {item.shortcut && !isActive && (
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded bg-bg-tertiary text-[10px] font-mono text-text-secondary border border-border-primary">
                {item.shortcut}
              </kbd>
            )}
          </div>
        </div>
      )}
    </button>
  )
}
