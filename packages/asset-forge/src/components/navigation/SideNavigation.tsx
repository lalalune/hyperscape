/**
 * SideNavigation - Main sidebar navigation container
 *
 * Beautiful side navigation with collapsible sections, quick access,
 * and smooth animations. Matches the current UI aesthetic.
 */

import React, { useCallback, useMemo } from 'react'
import { Menu, X } from 'lucide-react'
import { useNavigationStore } from '../../store/useNavigationStore'
import { navigationConfig } from '../../config/navigation-config'
import NavigationSection from './NavigationSection'
import QuickAccess from './QuickAccess'
import NavigationFooter from './NavigationFooter'
import CollapseButton from './CollapseButton'

export default function SideNavigation() {
  const collapsed = useNavigationStore(state => state.collapsed)
  const mobileMenuOpen = useNavigationStore(state => state.mobileMenuOpen)
  const setMobileMenuOpen = useNavigationStore(state => state.setMobileMenuOpen)

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen(!mobileMenuOpen)
  }, [mobileMenuOpen, setMobileMenuOpen])

  const handleOverlayClick = useCallback(() => {
    setMobileMenuOpen(false)
  }, [setMobileMenuOpen])

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={handleMobileMenuToggle}
        className="fixed top-4 left-4 z-50 lg:hidden btn-ghost p-2"
        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-bg-secondary border-r border-border-primary z-50
          flex flex-col transition-all duration-slow
          ${collapsed ? 'w-16' : 'w-[280px]'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border-primary shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-lg font-bold text-white">AF</span>
              </div>
              <div>
                <h1 className="text-sm font-bold text-text-primary">Asset Forge</h1>
                <p className="text-xs text-text-secondary">AI-Powered 3D</p>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-lg font-bold text-white">AF</span>
            </div>
          )}

          {/* Desktop Collapse Button */}
          <div className="hidden lg:block">
            <CollapseButton />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <nav className="p-2">
            {/* Main Sections */}
            {navigationConfig.sections.map((section) => (
              <NavigationSection key={section.id} section={section} />
            ))}

            {/* Quick Access */}
            {navigationConfig.quickAccess.enabled && (
              <QuickAccess />
            )}
          </nav>
        </div>

        {/* Footer */}
        <NavigationFooter />
      </aside>

      {/* Main Content Offset */}
      <div
        className={`
          transition-all duration-slow
          ${collapsed ? 'lg:ml-16' : 'lg:ml-[280px]'}
        `}
      />
    </>
  )
}
