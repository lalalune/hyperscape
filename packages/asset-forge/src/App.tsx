import { useState, useEffect } from 'react'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { PrivyAuthProvider } from './components/PrivyAuthProvider'
import { OnboardingModal } from './components/OnboardingModal'
import Navigation from './components/shared/Navigation'
import NotificationBar from './components/shared/NotificationBar'
import { NAVIGATION_VIEWS, APP_BACKGROUND_STYLES } from './constants'
import { AppProvider } from './contexts/AppContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useNavigation } from './hooks/useNavigation'
import { useAuth } from './hooks/useAuth'
import { ArmorFittingPage } from './pages/ArmorFittingPage'
import { AssetsPage } from './pages/AssetsPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { GenerationPage } from './pages/GenerationPage'
import { HandRiggingPage } from './pages/HandRiggingPage'
import { RetargetAnimatePage } from './pages/RetargetAnimatePage'

function AppContent() {
  const { currentView, navigateTo, navigateToAsset } = useNavigation()
  const { isNewUser } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Show onboarding modal for new users
  useEffect(() => {
    if (isNewUser) {
      setShowOnboarding(true)
    }
  }, [isNewUser])

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
        <Navigation currentView={currentView} onViewChange={navigateTo} />
        <NotificationBar />

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
          {currentView === NAVIGATION_VIEWS.RETARGET_ANIMATE && (
            <RetargetAnimatePage />
          )}
        </main>
      </div>

      {/* Onboarding modal for new users */}
      <OnboardingModal
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  )
}

function App() {
  return (
    <PrivyAuthProvider>
      <AppProvider>
        <NavigationProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </NavigationProvider>
      </AppProvider>
    </PrivyAuthProvider>
  )
}

export default App
