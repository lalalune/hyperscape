import { useState, useEffect, lazy, Suspense } from 'react'

import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { createLogger } from './utils/logger'

const logger = createLogger('App')

// Lazy load GlobalSearch to avoid pulling in search dependencies
const GlobalSearch = lazy(() => import('./components/common/GlobalSearch').then(m => ({ default: m.GlobalSearch })))
import {
  GenerationErrorFallback,
  AssetsErrorFallback,
  ContentErrorFallback,
  VoiceErrorFallback,
  ToolsErrorFallback
} from './components/errors'
import SideNavigation from './components/navigation/SideNavigation'
import NotificationBar from './components/shared/NotificationBar'
import { NAVIGATION_VIEWS, APP_BACKGROUND_STYLES } from './constants/navigation'
import { AppProvider } from './contexts/AppContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useNavigation } from './hooks/useNavigation'
import { useNavigationStore } from './store/useNavigationStore'
import type { NavigationView } from './types/navigation'

// Lazy load route-specific pages for better code splitting
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const ArmorFittingPage = lazy(() => import('./pages/ArmorFittingPage').then(m => ({ default: m.ArmorFittingPage })))
const AssetsPage = lazy(() => import('./pages/AssetsPage').then(m => ({ default: m.AssetsPage })))
const ContentGenerationPage = lazy(() => import('./pages/ContentGenerationPage').then(m => ({ default: m.ContentGenerationPage })))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage').then(m => ({ default: m.EquipmentPage })))
const GenerationPage = lazy(() => import('./pages/GenerationPage').then(m => ({ default: m.GenerationPage })))
const HandRiggingPage = lazy(() => import('./pages/HandRiggingPage').then(m => ({ default: m.HandRiggingPage })))
const ManifestVoiceAssignmentPage = lazy(() => import('./pages/ManifestVoiceAssignmentPage').then(m => ({ default: m.ManifestVoiceAssignmentPage })))
const ManifestsPage = lazy(() => import('./pages/ManifestsPage').then(m => ({ default: m.ManifestsPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const TeamsPage = lazy(() => import('./pages/TeamsPage').then(m => ({ default: m.TeamsPage })))
const VoiceGenerationPage = lazy(() => import('./pages/VoiceGenerationPage').then(m => ({ default: m.VoiceGenerationPage })))
const VoiceStandalonePage = lazy(() => import('./pages/VoiceStandalonePage').then(m => ({ default: m.VoiceStandalonePage })))

// Helper function to get current view from route path
function getCurrentView(path: string): NavigationView {
  // Check for voice generation routes first (before generic /content check)
  if (path === '/voice/standalone') return NAVIGATION_VIEWS.VOICE_STANDALONE
  if (path === '/voice/manifests') return NAVIGATION_VIEWS.VOICE_MANIFESTS
  if (path === '/voice/dialogue' || path === '/content/voice') return NAVIGATION_VIEWS.VOICE

  // New routes
  if (path === '/dashboard') return NAVIGATION_VIEWS.DASHBOARD
  if (path === '/admin') return NAVIGATION_VIEWS.ADMIN
  if (path === '/projects') return NAVIGATION_VIEWS.PROJECTS
  if (path === '/profile') return NAVIGATION_VIEWS.PROFILE
  if (path === '/team') return NAVIGATION_VIEWS.TEAM

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
  const navigateToLegacyView = useNavigationStore(state => state.navigateToLegacyView)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Sync new navigation store with old navigation context
  useEffect(() => {
    const viewFromPath = getCurrentView(currentPath)
    if (viewFromPath !== currentView) {
      legacyNavigateTo(viewFromPath)
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

        {/* Main content area - pushes content with padding instead of overlay */}
        <div
          className={`
            flex flex-col min-h-screen flex-1
            transition-all duration-300 ease-in-out
            lg:ml-16
            ${!collapsed && 'lg:ml-[280px]'}
          `}
        >
          <NotificationBar />
          {isSearchOpen && (
            <Suspense fallback={null}>
              <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            </Suspense>
          )}

          {/* Main content with proper spacing - mobile optimized */}
          <main className="flex-1 overflow-auto w-full min-h-0">
            {/* Mobile: Add top padding for hamburger menu, Desktop: No extra padding */}
            <div className="w-full h-full pt-14 lg:pt-0">
              <Suspense fallback={<LoadingSpinner />}>
                {currentView === NAVIGATION_VIEWS.ASSETS && (
                  <ErrorBoundary fallback={<AssetsErrorFallback />} resetKeys={[currentView]}>
                    <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                      <AssetsPage />
                    </div>
                  </ErrorBoundary>
                )}
              {currentView === NAVIGATION_VIEWS.GENERATION && (
                <ErrorBoundary fallback={<GenerationErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <GenerationPage
                      onNavigateToAssets={() => navigateToLegacyView(NAVIGATION_VIEWS.ASSETS)}
                      onNavigateToAsset={navigateToAsset}
                    />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.EQUIPMENT && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Equipment Viewer" />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <EquipmentPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.HAND_RIGGING && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Hand Rigging" />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <HandRiggingPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.ARMOR_FITTING && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Armor Fitting" />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <ArmorFittingPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.GAME_DATA && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <ManifestsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.CONTENT_BUILDER && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <ContentGenerationPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.VOICE && (
                <ErrorBoundary fallback={<VoiceErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <VoiceGenerationPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.VOICE_STANDALONE && (
                <ErrorBoundary fallback={<VoiceErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <VoiceStandalonePage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.VOICE_MANIFESTS && (
                <ErrorBoundary fallback={<VoiceErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <ManifestVoiceAssignmentPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.DASHBOARD && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <div className="text-white">
                    <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
                    <p className="text-gray-400">Dashboard coming soon...</p>
                  </div>
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.ADMIN && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Admin Dashboard" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <AdminDashboardPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.PROJECTS && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Projects" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <ProjectsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.PROFILE && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Profile" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <ProfilePage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.TEAM && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Team Management" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <TeamsPage />
                  </div>
                </ErrorBoundary>
              )}
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function App() {
  // Register service worker on app mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          logger.info('Service worker registered successfully', {
            scope: registration.scope,
            updateViaCache: registration.updateViaCache
          })

          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  logger.info('New service worker available - reload to update')

                  // Optionally show notification to user
                  if (window.confirm('New version available! Reload to update?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                    window.location.reload()
                  }
                }
              })
            }
          })
        })
        .catch((error) => {
          logger.error('Service worker registration failed', error)
        })

      // Listen for controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        logger.info('Service worker controller changed')
      })
    } else {
      logger.warn('Service workers not supported in this browser')
    }
  }, [])

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
