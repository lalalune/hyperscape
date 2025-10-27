/**
 * NavigationFooter - Settings, help, and version info
 *
 * Beautiful footer section with settings and help links,
 * plus app version display.
 */

import { LogOut } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { navigationConfig, isNavLink } from '../../config/navigation-config'
import { isRouteActive } from '../../config/navigation-config'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { privyAuthManager } from '../../auth/PrivyAuthManager'

export default function NavigationFooter() {
  const { collapsed, currentPath, navigateTo } = useNavigationStore()
  const { logout } = usePrivy()

  const handleLogout = async () => {
    try {
      console.log('[NavigationFooter] Starting logout process...')
      
      // Clear local auth manager state first
      privyAuthManager.clearAuth()

      // Clear all application state
      localStorage.removeItem('app-settings')
      localStorage.removeItem('asset-forge-auth')
      sessionStorage.clear()

      // Clear Privy session and disconnect wallet
      await logout()

      console.log('[NavigationFooter] Logout complete, redirecting...')

      // Force reload to landing page (Privy will show login UI)
      window.location.href = '/'
    } catch (error) {
      console.error('[NavigationFooter] Logout error:', error)
      // Still attempt to clear local state and redirect
      privyAuthManager.clearAuth()
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/'
    }
  }

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

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-md
            text-sm font-medium transition-all duration-base
            ${collapsed ? 'justify-center' : 'justify-start'}
            text-text-secondary hover:text-red-400 hover:bg-red-500/10
          `}
          title={collapsed ? 'Logout' : 'Sign out of your account'}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
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
