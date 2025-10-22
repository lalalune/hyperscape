import React, { useState, useEffect } from 'react'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { GlobalSearch } from './components/common/GlobalSearch'
import SideNavigation from './components/navigation/SideNavigation'
import NotificationBar from './components/shared/NotificationBar'
import { NAVIGATION_VIEWS, APP_BACKGROUND_STYLES } from './constants'
import { ROUTES } from './constants/routes'
import { AppProvider } from './contexts/AppContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useNavigation } from './hooks/useNavigation'
import { useNavigationStore } from './store/useNavigationStore'
import { ArmorFittingPage } from './pages/ArmorFittingPage'
import { AssetsPage } from './pages/AssetsPage'
import { ContentGenerationPage } from './pages/ContentGenerationPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { GenerationPage } from './pages/GenerationPage'
import { HandRiggingPage } from './pages/HandRiggingPage'
import { ManifestsPage } from './pages/ManifestsPage'
import { VoiceGenerationPage } from './pages/VoiceGenerationPage'
import { VoiceStandalonePage } from './pages/VoiceStandalonePage'
import { ManifestVoiceAssignmentPage } from './pages/ManifestVoiceAssignmentPage'

// Helper function to get current view from route path
function getCurrentView(path: string): string {
  // Check for voice generation routes first (before generic /content check)
  if (path === '/voice/standalone') return 'voice-standalone' as any
  if (path === '/voice/manifests') return 'voice-manifests' as any
  if (path === '/voice/dialogue' || path === '/content/voice') return 'voice' as any

  if (path.startsWith('/generate')) return NAVIGATION_VIEWS.GENERATION
  if (path.startsWith('/assets')) return NAVIGATION_VIEWS.ASSETS
  if (path.startsWith('/tools/hand-rigging')) return NAVIGATION_VIEWS.HAND_RIGGING
  if (path.startsWith('/tools/equipment')) return NAVIGATION_VIEWS.EQUIPMENT
  if (path.startsWith('/tools/armor')) return NAVIGATION_VIEWS.ARMOR_FITTING
  if (path.startsWith('/game-data')) return NAVIGATION_VIEWS.GAME_DATA
  if (path.startsWith('/content')) return NAVIGATION_VIEWS.CONTENT_BUILDER
  return NAVIGATION_VIEWS.GENERATION // default
}

function AppContent() {
  const { currentView, navigateTo: legacyNavigateTo, navigateToAsset } = useNavigation()
  const currentPath = useNavigationStore(state => state.currentPath)
  const collapsed = useNavigationStore(state => state.collapsed)
  const navigateTo = useNavigationStore(state => state.navigateTo)
  const navigateToLegacyView = useNavigationStore(state => state.navigateToLegacyView)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Sync new navigation store with old navigation context
  useEffect(() => {
    const viewFromPath = getCurrentView(currentPath)
    if (viewFromPath !== currentView) {
      legacyNavigateTo(viewFromPath as any)
    }
  }, [currentPath, currentView, legacyNavigateTo])
  
  // Global search keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-bg-primary to-bg-secondary relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="h-full w-full" style={{
          backgroundImage: APP_BACKGROUND_STYLES.gridImage,
          backgroundSize: APP_BACKGROUND_STYLES.gridSize
        }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen w-full">
        {/* Side Navigation */}
        <SideNavigation />

        {/* Main content area with responsive padding for sidebar */}
        <div
          className={`
            flex-1 flex flex-col min-h-screen w-full
            transition-all duration-300
            ${collapsed ? 'lg:ml-16' : 'lg:ml-[280px]'}
          `}
        >
          <NotificationBar />
          <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

          {/* Main content with proper spacing - mobile optimized */}
          <main className="flex-1 overflow-auto w-full min-h-0">
            {/* Mobile: Add top padding for hamburger menu, Desktop: No extra padding */}
            <div className="w-full h-full pt-16 lg:pt-0">
              {currentView === NAVIGATION_VIEWS.ASSETS && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <AssetsPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.GENERATION && (
                <div className="w-full h-full">
                  <GenerationPage
                    onNavigateToAssets={() => navigateToLegacyView(NAVIGATION_VIEWS.ASSETS)}
                    onNavigateToAsset={navigateToAsset}
                  />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.EQUIPMENT && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <EquipmentPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.HAND_RIGGING && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <HandRiggingPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.ARMOR_FITTING && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <ArmorFittingPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.GAME_DATA && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <ManifestsPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.CONTENT_BUILDER && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <ContentGenerationPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.VOICE && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <VoiceGenerationPage />
                </div>
              )}
              {currentView === 'voice-standalone' && (
                <div className="w-full h-full">
                  <VoiceStandalonePage />
                </div>
              )}
              {currentView === 'voice-manifests' && (
                <div className="w-full h-full">
                  <ManifestVoiceAssignmentPage />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <NavigationProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </NavigationProvider>
    </AppProvider>
  )
}

export default App
