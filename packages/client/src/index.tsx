import type { World } from '@hyperscape/shared'
import { THREE, CircularSpawnArea, installThreeJSExtensions } from '@hyperscape/shared'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { errorReporting as _errorReporting } from './error-reporting'
import { ErrorBoundary } from './ErrorBoundary'
import './index.css'
import { playerTokenManager } from './PlayerTokenManager'
import { Client } from './world-client'

// Privy Authentication
import { CharacterSelectPage } from './components/CharacterSelectPage'
import { LoginScreen } from './components/LoginScreen'
import { PrivyAuthProvider } from './components/PrivyAuthProvider'
import { privyAuthManager } from './PrivyAuthManager'

// Farcaster Frame v2
import { injectFarcasterMetaTags } from './farcaster-frame-config'

// Set global environment flags
(globalThis as typeof globalThis & { isBrowser?: boolean; isServer?: boolean }).isBrowser = true;
(globalThis as typeof globalThis & { isBrowser?: boolean; isServer?: boolean }).isServer = false;

// Declare global env type
declare global {
  interface Window {
    env?: Record<string, string>
    THREE?: typeof THREE
    world?: World
  }
}

installThreeJSExtensions()


// Initialize error reporting as early as possible

function App() {
  // Determine Privy availability early so we can gate initial render
  const windowEnvAppId = window.env?.PUBLIC_PRIVY_APP_ID
  const importMetaAppId = import.meta.env.PUBLIC_PRIVY_APP_ID
  const appId = windowEnvAppId || importMetaAppId || ''
  const privyEnabled = appId.length > 0 && !appId.includes('your-privy-app-id')

  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [authState, setAuthState] = React.useState(privyAuthManager.getState())
  // Default to showing character page first when Privy is enabled to avoid racing the world mount
  const [showCharacterPage, setShowCharacterPage] = React.useState<boolean>(privyEnabled)
    
  // Subscribe to auth state changes
  React.useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState)
    // Restore auth from storage on mount
    privyAuthManager.restoreFromStorage()
    // Inject Farcaster meta tags if enabled
    injectFarcasterMetaTags()
    return unsubscribe
  }, [])

  // When auth becomes available (including restored), show pre-world character page first
  React.useEffect(() => {
    if (authState.isAuthenticated) setShowCharacterPage(true)
  }, [authState.isAuthenticated])

  // Pre-world WebSocket is handled inside CharacterSelectPage to avoid duplication

  // Initialize player token (legacy fallback)
  React.useEffect(() => {
    const token = playerTokenManager.getOrCreatePlayerToken('Player');
    const session = playerTokenManager.startSession();
    
    console.log('[App] Player token initialized:', {
      playerId: token.playerId,
      sessionId: session.sessionId,
      playerName: token.playerName
    });

    return () => {
      playerTokenManager.endSession();
    };
  }, []);

  // Try global env first (from env.js), then import.meta.env (build time), then fallback to relative WebSocket
  const wsUrl = 
    window.env?.PUBLIC_WS_URL || 
    import.meta.env.PUBLIC_WS_URL || 
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  
    
  // Add a ref to verify the component is mounting
  const appRef = React.useRef<HTMLDivElement>(null)

  // Handle authentication callback
  const handleAuthenticated = React.useCallback(() => {
    console.log('[App] User authenticated, loading world...')
    setIsAuthenticated(true)
    setShowCharacterPage(true)
  }, [])

  const handleLogout = React.useCallback(() => {
    // Immediately clear local auth so UI updates without a second click
    privyAuthManager.clearAuth()
    setIsAuthenticated(false)
    setShowCharacterPage(false)
    // Fire and forget provider logout to invalidate Privy session
    const windowWithPrivy = window as unknown as { privyLogout: () => Promise<void> | void }
    windowWithPrivy.privyLogout()
  }, [])

  // Pre-world actions are managed by CharacterSelectPage

  // Memoize the onSetup callback to prevent re-initialization
  const handleSetup = React.useCallback((world: World, _config: unknown) => {
    console.log('[App] onSetup callback triggered')
    // Make world accessible globally for debugging
    const globalWindow = window as unknown as { world: World; THREE: typeof THREE; testChat: () => void; Hyperscape: Record<string, unknown> };
    globalWindow.world = world;
    globalWindow.THREE = THREE;
    globalWindow.Hyperscape = {};
    globalWindow.Hyperscape.CircularSpawnArea = CircularSpawnArea;
    
    // Add chat test function
    globalWindow.testChat = () => {
      const worldWithChat = world as unknown as { chat: { send: (msg: string) => void }; network: { id: string; isClient: boolean; send: (method: string, data: unknown) => void } }
      console.log('=== TESTING CHAT ===');
      console.log('world.chat:', worldWithChat.chat);
      console.log('world.network:', worldWithChat.network);
      console.log('world.network.id:', worldWithChat.network.id);
      console.log('world.network.isClient:', worldWithChat.network.isClient);
      console.log('world.network.send:', worldWithChat.network.send);
      
      const testMsg = 'Test message from console at ' + new Date().toLocaleTimeString();
      console.log('Sending test message:', testMsg);
      worldWithChat.chat.send(testMsg);
    };
    console.log('💬 Chat test function available: call testChat() in console');
  }, [])

  // privyEnabled computed above

  // Show login screen if Privy is enabled and user is not authenticated
  if (privyEnabled && !isAuthenticated && !authState.isAuthenticated) {
    return (
      <div ref={appRef} data-component="app-root">
        <LoginScreen onAuthenticated={handleAuthenticated} />
      </div>
    )
  }
  
  // RuneScape-style pre-world character page: always show first when toggled
  if (showCharacterPage) {
    return (
      <div ref={appRef} data-component="app-root">
        <CharacterSelectPage
          wsUrl={wsUrl}
          onPlay={(id) => { 
            if (id) {
              localStorage.setItem('selectedCharacterId', id)
            }
            setShowCharacterPage(false)
          }}
          onLogout={handleLogout}
        />
      </div>
    )
  }

  return (
    <div ref={appRef} data-component="app-root">
      <ErrorBoundary>
        <Client wsUrl={wsUrl} onSetup={handleSetup} />
      </ErrorBoundary>
    </div>
  )
}

function mountApp() {
  const rootElement = document.getElementById('root')!
  
  console.log('[App] Root element details:', {
    id: rootElement.id,
    className: rootElement.className,
    innerHTML: rootElement.innerHTML,
    tagName: rootElement.tagName
  })
  
  const root = ReactDOM.createRoot(rootElement)
  
  root.render(
    <PrivyAuthProvider>
      <App />
    </PrivyAuthProvider>
  )
  
  // Verify render completion
  const verifyRender = (attempts = 0) => {
    const maxAttempts = 10
    const hasContent = rootElement.innerHTML.length > 0
    
    if (hasContent) {
      return
    }
    
    if (attempts < maxAttempts) {
      console.log(`[App] Waiting for React to render... (attempt ${attempts + 1}/${maxAttempts})`)
      requestAnimationFrame(() => verifyRender(attempts + 1))
      return
    }
    
    // Should never reach here - React render failed
    throw new Error('React app mounted but no content rendered after multiple attempts')
  }
  
  setTimeout(() => {
    requestAnimationFrame(() => verifyRender(0))
  }, 0)
}

// Ensure DOM is ready before mounting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        mountApp()
  })
} else {
    mountApp()
}
