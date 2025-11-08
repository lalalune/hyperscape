import { Database, Wand2, Wrench, Hand, Shield, Shuffle, User, LogOut, ChevronDown } from 'lucide-react'
import React, { useState } from 'react'

import { NAVIGATION_VIEWS } from '../../constants'
import { NavigationView } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { AuthModal } from '../AuthModal'
import { UserProfileModal } from '../UserProfileModal'

interface NavigationProps {
  currentView: NavigationView
  onViewChange: (view: NavigationView) => void
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  const { isAuthenticated, user, logout } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const getUserDisplayName = () => {
    // Check for display name first
    if ((user as any)?.displayName) {
      return (user as any).displayName
    }
    if (user?.email?.address) {
      return user.email.address
    }
    if (user?.wallet?.address) {
      return `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    }
    return 'User'
  }

  return (
    <>
      <nav className="bg-bg-secondary border-b border-border-primary px-6 shadow-theme-sm relative z-[100]">
        <div className="flex items-center justify-between h-[60px]">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gradient">3D Asset Forge</h1>
          </div>

          <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.GENERATION 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.GENERATION)}
          >
            <Wand2 size={18} />
            <span>Generate</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.ASSETS 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.ASSETS)}
          >
            <Database size={18} />
            <span>Assets</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.HAND_RIGGING 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.HAND_RIGGING)}
          >
            <Hand size={18} />
            <span>Hand Rigging</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.EQUIPMENT 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.EQUIPMENT)}
          >
            <Wrench size={18} />
            <span>Equipment Fitting</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.ARMOR_FITTING 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.ARMOR_FITTING)}
          >
            <Shield size={18} />
            <span>Armor Fitting</span>
          </button>

          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === NAVIGATION_VIEWS.RETARGET_ANIMATE
                ? 'bg-primary bg-opacity-10 text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange(NAVIGATION_VIEWS.RETARGET_ANIMATE)}
          >
            <Shuffle size={18} />
            <span>Retarget & Animate</span>
          </button>

          {/* User Profile / Auth UI */}
          <div className="ml-4 pl-4 border-l border-border-primary">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all duration-base"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <User size={18} />
                  <span className="max-w-[150px] truncate">{getUserDisplayName()}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* User dropdown menu */}
                {showUserMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-[90]"
                      onClick={() => setShowUserMenu(false)}
                    />

                    <div className="absolute right-0 mt-2 w-56 bg-bg-secondary border border-border-primary rounded-lg shadow-theme-lg z-[110]">
                      <div className="p-3 border-b border-border-primary">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {getUserDisplayName()}
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                          {user?.wallet?.address ? 'Web3 Wallet' : 'Email Account'}
                        </p>
                      </div>

                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        onClick={() => {
                          setShowUserMenu(false)
                          setShowProfileModal(true)
                        }}
                      >
                        <User size={16} />
                        <span>Profile Settings</span>
                      </button>

                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                        onClick={() => {
                          logout()
                          setShowUserMenu(false)
                        }}
                      >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-all duration-base"
                onClick={() => setShowAuthModal(true)}
              >
                <User size={18} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>

    {/* Auth Modal */}
    <AuthModal
      open={showAuthModal}
      onClose={() => setShowAuthModal(false)}
    />

    {/* Profile Modal */}
    <UserProfileModal
      open={showProfileModal}
      onClose={() => setShowProfileModal(false)}
    />
  </>
  )
}

export default Navigation