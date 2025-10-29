import { useState, useEffect, lazy, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'

import { ErrorBoundary } from './components/common/ErrorBoundary'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { LoginScreen } from './auth/LoginScreen'
import { createLogger } from './utils/logger'
import { pipelinePollingService } from './services/PipelinePollingService'
import { IndexedDBCache } from './services/IndexedDBCache'

const logger = createLogger('App')

// Lazy load GlobalSearch to avoid pulling in search dependencies
const GlobalSearch = lazy(() => import('./components/common/GlobalSearch').then(m => ({ default: m.GlobalSearch })))
const KeyboardShortcutsHelp = lazy(() => import('./components/common/KeyboardShortcutsHelp').then(m => ({ default: m.KeyboardShortcutsHelp })))
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
import { useNavigationStore } from './stores/useNavigationStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { NavigationView } from './types/navigation'

// Lazy load route-specific pages for better code splitting
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const AdminApprovalsPage = lazy(() => import('./pages/AdminApprovalsPage').then(m => ({ default: m.AdminApprovalsPage })))
const AIContextSettingsPage = lazy(() => import('./pages/AIContextSettingsPage').then(m => ({ default: m.AIContextSettingsPage })))
const ArmorFittingPage = lazy(() => import('./pages/ArmorFittingPage').then(m => ({ default: m.ArmorFittingPage })))
const AssetsPage = lazy(() => import('./pages/AssetsPage').then(m => ({ default: m.AssetsPage })))
const ContentGenerationPage = lazy(() => import('./pages/ContentGenerationPage').then(m => ({ default: m.ContentGenerationPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const EquipmentPage = lazy(() => import('./pages/EquipmentPage').then(m => ({ default: m.EquipmentPage })))
const GenerationPage = lazy(() => import('./pages/GenerationPage').then(m => ({ default: m.GenerationPage })))
const HandRiggingPage = lazy(() => import('./pages/HandRiggingPage').then(m => ({ default: m.HandRiggingPage })))
const LorePage = lazy(() => import('./pages/LorePage').then(m => ({ default: m.LorePage })))
const ManifestVoiceAssignmentPage = lazy(() => import('./pages/ManifestVoiceAssignmentPage').then(m => ({ default: m.ManifestVoiceAssignmentPage })))
const ManifestsPage = lazy(() => import('./pages/ManifestsPage').then(m => ({ default: m.ManifestsPage })))
const NPCsPage = lazy(() => import('./pages/NPCsPage').then(m => ({ default: m.NPCsPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const QuestsPage = lazy(() => import('./pages/QuestsPage').then(m => ({ default: m.QuestsPage })))
const ScriptsPage = lazy(() => import('./pages/ScriptsPage').then(m => ({ default: m.ScriptsPage })))
const TeamsPage = lazy(() => import('./pages/TeamsPage').then(m => ({ default: m.TeamsPage })))
const TrackerPage = lazy(() => import('./pages/TrackerPage').then(m => ({ default: m.TrackerPage })))
const VoiceGenerationPage = lazy(() => import('./pages/VoiceGenerationPage').then(m => ({ default: m.VoiceGenerationPage })))
const VoiceStandalonePage = lazy(() => import('./pages/VoiceStandalonePage').then(m => ({ default: m.VoiceStandalonePage })))
const VoiceChangerPage = lazy(() => import('./pages/VoiceChangerPage').then(m => ({ default: m.VoiceChangerPage })))
const VoiceDesignPage = lazy(() => import('./pages/VoiceDesignPage').then(m => ({ default: m.VoiceDesignPage })))
const SoundEffectsPage = lazy(() => import('./pages/SoundEffectsPage').then(m => ({ default: m.default })))
const MusicPage = lazy(() => import('./pages/MusicPage').then(m => ({ default: m.default })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })))

// Helper function to get current view from route path
function getCurrentView(path: string): NavigationView {
  // Check for voice generation routes first (before generic /content check)
  if (path === '/voice/standalone') return NAVIGATION_VIEWS.VOICE_STANDALONE
  if (path === '/voice/manifests') return NAVIGATION_VIEWS.VOICE_MANIFESTS
  if (path === '/voice/changer') return NAVIGATION_VIEWS.VOICE_CHANGER
  if (path === '/voice/design') return NAVIGATION_VIEWS.VOICE_DESIGN
  if (path === '/voice/dialogue' || path === '/content/voice') return NAVIGATION_VIEWS.VOICE

  // Sound Effects
  if (path === '/sfx/generate') return NAVIGATION_VIEWS.SOUND_EFFECTS

  // Music Generation
  if (path === '/music/generate') return NAVIGATION_VIEWS.MUSIC

  // Content-specific routes (check before generic /content)
  if (path === '/content/quests') return NAVIGATION_VIEWS.CONTENT_QUESTS
  if (path === '/content/npcs') return NAVIGATION_VIEWS.CONTENT_NPCS
  if (path === '/content/lore') return NAVIGATION_VIEWS.CONTENT_LORE
  if (path === '/content/scripts') return NAVIGATION_VIEWS.CONTENT_SCRIPTS
  if (path === '/content/tracking') return NAVIGATION_VIEWS.CONTENT_TRACKING

  // Manifest routes
  if (path === '/manifests/preview' || path === '/manifests/submissions') return NAVIGATION_VIEWS.GAME_DATA
  if (path.startsWith('/manifests')) return NAVIGATION_VIEWS.GAME_DATA

  // New routes
  if (path === '/dashboard') return NAVIGATION_VIEWS.DASHBOARD
  if (path === '/admin/approvals') return NAVIGATION_VIEWS.ADMIN_APPROVALS
  if (path === '/admin') return NAVIGATION_VIEWS.ADMIN
  if (path === '/projects') return NAVIGATION_VIEWS.PROJECTS
  if (path === '/profile') return NAVIGATION_VIEWS.PROFILE
  if (path === '/team') return NAVIGATION_VIEWS.TEAM
  if (path === '/settings/ai-context') return NAVIGATION_VIEWS.AI_CONTEXT_SETTINGS
  if (path === '/settings') return NAVIGATION_VIEWS.SETTINGS
  if (path === '/help') return NAVIGATION_VIEWS.HELP

  if (path.startsWith('/generate')) return NAVIGATION_VIEWS.GENERATION
  if (path.startsWith('/assets')) return NAVIGATION_VIEWS.ASSETS
  if (path.startsWith('/tools/hand-rigging')) return NAVIGATION_VIEWS.HAND_RIGGING
  if (path.startsWith('/tools/equipment')) return NAVIGATION_VIEWS.EQUIPMENT
  if (path.startsWith('/tools/armor')) return NAVIGATION_VIEWS.ARMOR_FITTING
  if (path.startsWith('/game-data')) return NAVIGATION_VIEWS.GAME_DATA
  if (path.startsWith('/content')) return NAVIGATION_VIEWS.CONTENT_BUILDER
  return NAVIGATION_VIEWS.DASHBOARD // default - home page
}

function AppContent() {
  const { currentView, navigateTo: legacyNavigateTo, navigateToAsset } = useNavigation()
  const currentPath = useNavigationStore(state => state.currentPath)
  const collapsed = useNavigationStore(state => state.collapsed)
  const navigateToLegacyView = useNavigationStore(state => state.navigateToLegacyView)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  // Sync new navigation store with old navigation context
  useEffect(() => {
    const viewFromPath = getCurrentView(currentPath)
    if (viewFromPath !== currentView) {
      legacyNavigateTo(viewFromPath)
    }
  }, [currentPath, currentView, legacyNavigateTo])

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onOpenSearch: () => setIsSearchOpen(true),
    onOpenHelp: () => setIsHelpOpen(true),
    enabled: true,
  })

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
          {isHelpOpen && (
            <Suspense fallback={null}>
              <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
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
              {currentView === NAVIGATION_VIEWS.CONTENT_QUESTS && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <QuestsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.CONTENT_NPCS && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <NPCsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.CONTENT_LORE && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <LorePage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.CONTENT_SCRIPTS && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <ScriptsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.CONTENT_TRACKING && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                    <TrackerPage />
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
              {currentView === NAVIGATION_VIEWS.VOICE_CHANGER && (
                <ErrorBoundary fallback={<VoiceErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <VoiceChangerPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.VOICE_DESIGN && (
                <ErrorBoundary fallback={<VoiceErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <VoiceDesignPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.SOUND_EFFECTS && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <SoundEffectsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.MUSIC && (
                <ErrorBoundary fallback={<ContentErrorFallback />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <MusicPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.DASHBOARD && (
                <div className="w-full h-full p-4 sm:p-6 lg:p-8">
                  <DashboardPage />
                </div>
              )}
              {currentView === NAVIGATION_VIEWS.ADMIN && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Admin Dashboard" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <AdminDashboardPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.ADMIN_APPROVALS && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Admin Approvals" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <AdminApprovalsPage />
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
              {currentView === NAVIGATION_VIEWS.SETTINGS && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Settings" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <SettingsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.AI_CONTEXT_SETTINGS && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="AI Context Settings" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <AIContextSettingsPage />
                  </div>
                </ErrorBoundary>
              )}
              {currentView === NAVIGATION_VIEWS.HELP && (
                <ErrorBoundary fallback={<ToolsErrorFallback toolName="Help" />} resetKeys={[currentView]}>
                  <div className="w-full h-full">
                    <HelpPage />
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
  const { ready, authenticated } = usePrivy()
  const [showApp, setShowApp] = useState(false)

  // Cleanup all services on unmount
  useEffect(() => {
    return () => {
      logger.info('App unmounting, cleaning up services...')

      // Cleanup pipeline polling service
      try {
        pipelinePollingService.destroy()
        logger.debug('PipelinePollingService cleaned up')
      } catch (error) {
        logger.error('Error cleaning up PipelinePollingService:', error)
      }

      // Cleanup IndexedDB cache
      try {
        IndexedDBCache.getInstance().then(cache => {
          cache.destroy()
          logger.debug('IndexedDBCache cleaned up')
        }).catch(err => {
          logger.error('Error cleaning up IndexedDBCache:', err)
        })
      } catch (error) {
        logger.error('Error initiating IndexedDBCache cleanup:', error)
      }
    }
  }, [])

  // Show loading while Privy initializes
  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!authenticated) {
    return <LoginScreen onAuthenticated={() => setShowApp(true)} />
  }

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
