import type { World } from '@hyperscape/shared'
import { THREE, CircularSpawnArea, installThreeJSExtensions } from '@hyperscape/shared'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { errorReporting } from './error-reporting'
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
  const importMetaAppId = typeof import.meta !== 'undefined' ? import.meta.env.PUBLIC_PRIVY_APP_ID : undefined
  const appId: string = (windowEnvAppId || importMetaAppId || '') as string
  const privyEnabled: boolean = !!(typeof appId === 'string' && appId.length > 0 && !appId.includes('your-privy-app-id'))

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
    try { privyAuthManager.clearAuth() } catch {}
    setIsAuthenticated(false)
    setShowCharacterPage(false)
    // Fire and forget provider logout to invalidate Privy session
    try { (window as unknown as { privyLogout?: () => Promise<void> | void }).privyLogout?.() } catch {}
  }, [])

  // Pre-world actions are managed by CharacterSelectPage

  // Memoize the onSetup callback to prevent re-initialization
  const handleSetup = React.useCallback((world: World, _config: unknown) => {
    console.log('[App] onSetup callback triggered')
    // Make world accessible globally for debugging
    if (typeof window !== 'undefined') {
      const globalWindow = window as Window & { world?: unknown; THREE?: unknown; testChat?: () => void };
      globalWindow.world = world;
      globalWindow.THREE = THREE;
      // Expose testing helpers for browser-based tests
      const anyWin = window as unknown as { Hyperscape?: Record<string, unknown> };
      anyWin.Hyperscape = anyWin.Hyperscape || {};
      anyWin.Hyperscape.CircularSpawnArea = CircularSpawnArea;
      
      // Add chat test function
      globalWindow.testChat = () => {
        console.log('=== TESTING CHAT ===');
        console.log('world.chat:', world.chat);
        console.log('world.network:', world.network);
        console.log('world.network.id:', (world.network as { id?: string })?.id);
        console.log('world.network.isClient:', world.network?.isClient);
        console.log('world.network.send:', world.network?.send);
        
        const testMsg = 'Test message from console at ' + new Date().toLocaleTimeString();
        console.log('Sending test message:', testMsg);
        world.chat.send(testMsg);
      };
      console.log('💬 Chat test function available: call testChat() in console');
    }
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
          onPlay={(id) => { if (id) try { localStorage.setItem('selectedCharacterId', id) } catch {}; setShowCharacterPage(false) }}
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
  try {
            
    const rootElement = document.getElementById('root')
        
    if (rootElement) {
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
      
            
      // Use React's callback to verify render completion
      // React 18's createRoot renders are async and may take multiple frames
      const verifyRender = (attempts = 0) => {
        const maxAttempts = 10
        const hasContent = rootElement.innerHTML.length > 0
        
        if (hasContent) {
          return
        } else if (attempts < maxAttempts) {
          // Try again in the next frame
          console.log(`[App] Waiting for React to render... (attempt ${attempts + 1}/${maxAttempts})`)
          requestAnimationFrame(() => verifyRender(attempts + 1))
        } else {
          console.error('[App] WARNING: Root element is still empty after multiple attempts!')
          console.error('[App] Root element state:', {
            innerHTML: rootElement.innerHTML,
            childNodes: rootElement.childNodes.length,
            textContent: rootElement.textContent
          })
          
          // Check if React root was created successfully
          const reactRootKey = Object.keys(rootElement).find(key => key.startsWith('_reactRoot'))
          console.error('[App] React root found:', !!reactRootKey)
          
          errorReporting.reportCustomError(
            'React app mounted but no content rendered after multiple attempts',
            {
              phase: 'post-mount',
              rootElementFound: true,
              innerHTML: rootElement.innerHTML,
              attempts: attempts,
              hasReactRoot: !!reactRootKey
            }
          )
        }
      }
      
      // Start verification process
      // Use setTimeout with 0 delay to ensure React has a chance to start rendering
      setTimeout(() => {
        requestAnimationFrame(() => verifyRender(0))
      }, 0)
      
    } else {
      console.error('[App] Root element not found!')
          }
  } catch (error) {
    console.error('[App] Error during mounting:', error)
    if (error instanceof Error) {
      console.error('[App] Error stack:', error.stack)
      
      // Report mounting error to backend
      errorReporting.reportCustomError(
        `App mounting failed: ${error.message}`, 
        {
          phase: 'mounting',
          stack: error.stack,
          rootElementFound: !!document.getElementById('root')
        }
      )
    }
  }
}

// Ensure DOM is ready before mounting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        mountApp()
  })
} else {
    mountApp()
}
