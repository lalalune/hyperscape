import React, { useState, useEffect } from 'react'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { GlobalSearch } from './components/common/GlobalSearch'
import Navigation from './components/shared/Navigation'
import NotificationBar from './components/shared/NotificationBar'
import { NAVIGATION_VIEWS, APP_BACKGROUND_STYLES } from './constants'
import { AppProvider } from './contexts/AppContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useNavigation } from './hooks/useNavigation'
import { ArmorFittingPage } from './pages/ArmorFittingPage'
import { AssetsPage } from './pages/AssetsPage'
import { ContentGenerationPage } from './pages/ContentGenerationPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { GenerationPage } from './pages/GenerationPage'
import { HandRiggingPage } from './pages/HandRiggingPage'
import { ManifestsPage } from './pages/ManifestsPage'

function AppContent() {
  const { currentView, navigateTo, navigateToAsset } = useNavigation()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  
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
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-bg-primary to-bg-secondary relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="h-full w-full" style={{
          backgroundImage: APP_BACKGROUND_STYLES.gridImage,
          backgroundSize: APP_BACKGROUND_STYLES.gridSize
        }} />
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navigation currentView={currentView} onViewChange={navigateTo} onSearchClick={() => setIsSearchOpen(true)} />
        <NotificationBar />
        <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      
        <main className="flex-1">
          {currentView === NAVIGATION_VIEWS.ASSETS && (
            <div className="h-full overflow-hidden">
              <AssetsPage />
            </div>
          )}
          {currentView === NAVIGATION_VIEWS.GENERATION && (
            <GenerationPage 
              onNavigateToAssets={() => navigateTo(NAVIGATION_VIEWS.ASSETS)}
              onNavigateToAsset={navigateToAsset}
            />
          )}
          {currentView === NAVIGATION_VIEWS.EQUIPMENT && (
            <EquipmentPage />
          )}
          {currentView === NAVIGATION_VIEWS.HAND_RIGGING && (
            <HandRiggingPage />
          )}
          {currentView === NAVIGATION_VIEWS.ARMOR_FITTING && (
            <ArmorFittingPage />
          )}
          {currentView === NAVIGATION_VIEWS.GAME_DATA && (
            <ManifestsPage />
          )}
          {currentView === NAVIGATION_VIEWS.CONTENT_BUILDER && (
            <ContentGenerationPage />
          )}
        </main>
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
