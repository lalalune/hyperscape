import { AppProvider } from './contexts/AppContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useNavigation } from './hooks/useNavigation'
import Navigation from './components/shared/Navigation'
import NotificationBar from './components/shared/NotificationBar'
import { AssetsPage } from './pages/AssetsPage'
import { GenerationPage } from './pages/GenerationPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { HandRiggingPage } from './pages/HandRiggingPage'
import { ArmorFittingPage } from './pages/ArmorFittingPage'
import { NAVIGATION_VIEWS, APP_BACKGROUND_STYLES } from './constants'

function AppContent() {
  const { currentView, navigateTo, navigateToAsset } = useNavigation()

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
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </AppProvider>
  )
}

export default App
