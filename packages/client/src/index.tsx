/**
 * index.tsx - Hyperscape Client Entry Point
 * 
 * Main entry point for the Hyperscape browser client. Initializes the React application,
 * authentication, and 3D game world. Handles the complete client lifecycle from login
 * to world connection.
 * 
 * Application Flow:
 * 1. **Authentication** (if enabled):
 *    - Privy authentication (crypto wallet or email/social login)
 *    - Character selection screen
 *    - Pre-world WebSocket connection for character list
 * 
 * 2. **World Initialization**:
 *    - Create Hyperscape World instance
 *    - Connect to server via WebSocket
 *    - Load game assets (models, textures, audio)
 *    - Initialize physics, graphics, audio systems
 * 
 * 3. **Gameplay**:
 *    - Render 3D world with Three.js
 *    - Handle player input (keyboard, mouse, touch)
 *    - Receive server updates (player positions, combat, etc.)
 *    - Render React UI overlay (inventory, chat, settings)
 * 
 * Key Features:
 * - **Privy Authentication**: Optional crypto wallet or social login
 * - **Farcaster Frame v2**: Social media embeds with play button
 * - **Player Token System**: Persistent player ID across sessions
 * - **Character System**: Multiple characters per account
 * - **Error Reporting**: Automatic crash reporting and error boundaries
 * - **Hot Module Replacement**: Fast development iteration
 * 
 * Environment Variables:
 * - PUBLIC_PRIVY_APP_ID: Privy application ID (optional)
 * - PUBLIC_WS_URL: WebSocket server URL (default: ws://localhost:5555/ws)
 * - PUBLIC_CDN_URL: CDN URL for assets (default: /assets/)
 * - PUBLIC_ENABLE_FARCASTER: Enable Farcaster frame support
 * - PUBLIC_APP_URL: Public app URL for Farcaster
 * - PUBLIC_API_URL: API server URL
 * 
 * Architecture:
 * - React for UI rendering
 * - Hyperscape World for game logic
 * - Three.js for 3D graphics
 * - PhysX (WASM) for physics simulation
 * - WebSocket for real-time networking
 * 
 * Usage:
 * This file is automatically loaded by Vite as the application entry point.
 * See vite.config.ts for build configuration.
 * 
 * References: world-client.tsx (World setup), PrivyAuthProvider.tsx, CharacterSelectPage.tsx
 */

import { CircularSpawnArea, installThreeJSExtensions, THREE, World } from '@hyperscape/shared'
import React from 'react'
import ReactDOM from 'react-dom/client'
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

// Buffer polyfill for Privy (required for crypto operations in browser)
import { Buffer } from 'buffer'
if (!globalThis.Buffer) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer
}

// Set global environment flags
(globalThis as typeof globalThis & { isBrowser?: boolean; isServer?: boolean }).isBrowser = true;
(globalThis as typeof globalThis & { isBrowser?: boolean; isServer?: boolean }).isServer = false;

// Declare global types
declare global {
  interface Window {
    THREE?: typeof THREE
    world?: InstanceType<typeof World>
  }
}

// Vite environment variables (PUBLIC_ prefix is configured in vite.config.ts)
interface ImportMetaEnv {
  readonly PUBLIC_PRIVY_APP_ID?: string
  readonly PUBLIC_WS_URL?: string
  readonly PUBLIC_CDN_URL?: string
  readonly PUBLIC_ENABLE_FARCASTER?: string
  readonly PUBLIC_APP_URL?: string
  readonly PUBLIC_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

installThreeJSExtensions()


// Initialize error reporting as early as possible

function App() {
  // Determine Privy availability early so we can gate initial render
  const appId = import.meta.env.PUBLIC_PRIVY_APP_ID || ''
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

  // Direct connection to game server (no Vite proxy)
  const wsUrl = 
    import.meta.env.PUBLIC_WS_URL || 
    'ws://localhost:5555/ws'
  
    
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
    const debugWindow = window as Window & { privyLogout?: () => Promise<void> | void }
    debugWindow.privyLogout?.()
  }, [])

  // Pre-world actions are managed by CharacterSelectPage

  // Memoize the onSetup callback to prevent re-initialization
  const handleSetup = React.useCallback((world: InstanceType<typeof World>, _config: unknown) => {
    console.log('[App] onSetup callback triggered')
    // Make world accessible globally for debugging
    const globalWindow = window as Window & { 
      world?: InstanceType<typeof World>
      THREE?: typeof THREE
      testChat?: () => void
      Hyperscape?: Record<string, unknown>
    };
    globalWindow.world = world;
    globalWindow.THREE = THREE;
    globalWindow.Hyperscape = {};
    globalWindow.Hyperscape.CircularSpawnArea = CircularSpawnArea;
    
    // Add chat test function
    globalWindow.testChat = () => {
      console.log('=== TESTING CHAT ===');
      const chat = world.getSystem('chat') as { send?: (msg: string) => void } | null
      const network = world.getSystem('network') as { id?: string; isClient?: boolean; send?: unknown } | null
      
      console.log('world.chat:', chat);
      console.log('world.network:', network);
      console.log('world.network.id:', network?.id);
      console.log('world.network.isClient:', network?.isClient);
      console.log('world.network.send:', network?.send);
      
      const testMsg = 'Test message from console at ' + new Date().toLocaleTimeString();
      console.log('Sending test message:', testMsg);
      chat?.send?.(testMsg);
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
