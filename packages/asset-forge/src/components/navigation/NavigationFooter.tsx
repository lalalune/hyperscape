/**
 * NavigationFooter - Settings, help, and version info
 *
 * Beautiful footer section with settings and help links,
 * plus app version display.
 */

import { navigationConfig, isNavLink } from '../../config/navigation-config'
import { isRouteActive } from '../../config/navigation-config'
import { useNavigationStore } from '../../store/useNavigationStore'

export default function NavigationFooter() {
  const { collapsed, currentPath, navigateTo } = useNavigationStore()

  return (
    <div className="border-t border-border-primary shrink-0">
      {/* Footer Items */}
      <div className="p-2 space-y-1">
        {navigationConfig.footer.items.map((item) => {
          if (!isNavLink(item)) return null

          const isActive = isRouteActive(item.path, currentPath)

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-md
                text-sm font-medium transition-all duration-base
                ${collapsed ? 'justify-center' : 'justify-start'}
                ${
                  isActive
                    ? 'bg-primary bg-opacity-10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }
              `}
              title={collapsed ? item.label : item.tooltip}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </div>

      {/* Version */}
      {!collapsed && navigationConfig.footer.version && (
        <div className="px-4 py-3 text-center border-t border-border-primary">
          <p className="text-xs text-text-secondary">
            v{navigationConfig.footer.version}
          </p>
        </div>
      )}
    </div>
  )
}
