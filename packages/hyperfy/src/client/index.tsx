import React from 'react'
import ReactDOM from 'react-dom/client'
import { Client } from './world-client'
import { ErrorBoundary } from './ErrorBoundary'
import { errorReporting } from './error-reporting'
import { playerTokenManager } from './PlayerTokenManager'
import * as THREE from '../core/extras/three'

// Declare global env type
declare global {
  interface Window {
    env?: Record<string, string>
    THREE?: typeof THREE
  }
}

// Expose Three.js globally for direct access by systems
if (typeof window !== 'undefined') {
  (window as any).THREE = THREE
  console.log('[App] Three.js exposed globally as window.THREE')
}

console.log('[App] Starting Hyperfy client...')

// Initialize error reporting as early as possible
console.log('[App] Initializing error reporting system...')

function App() {
  // Initialize player token for persistent identity
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
  
  console.log('[App] WebSocket URL:', wsUrl)
  
  return (
    <ErrorBoundary>
      <Client wsUrl={wsUrl} onSetup={() => {
        console.log('[App] Client onSetup called')
      }} />
    </ErrorBoundary>
  )
}

function mountApp() {
  try {
    console.log('[App] mountApp called, document.readyState:', document.readyState)
    console.log('[App] Looking for root element...')
    
    const rootElement = document.getElementById('root')
    console.log('[App] Root element found:', !!rootElement)
    
    if (rootElement) {
      console.log('[App] Root element details:', {
        id: rootElement.id,
        className: rootElement.className,
        innerHTML: rootElement.innerHTML,
        tagName: rootElement.tagName
      })
      
      console.log('[App] Creating React root...')
      const root = ReactDOM.createRoot(rootElement)
      
      console.log('[App] Rendering App component...')
      root.render(<App />)
      
      console.log('[App] React app mounted successfully!')
      
      // Check if content appeared after a short delay
      setTimeout(() => {
        console.log('[App] After mount check - root innerHTML length:', rootElement.innerHTML.length)
        if (rootElement.innerHTML.length === 0) {
          console.error('[App] WARNING: Root element is still empty after mount!')
        } else {
          console.log('[App] SUCCESS: Content rendered in root element')
        }
      }, 1000)
      
    } else {
      console.error('[App] Root element not found!')
      console.log('[App] Available elements:', Array.from(document.querySelectorAll('*')).map(el => el.tagName + (el.id ? '#' + el.id : '')))
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
console.log('[App] Initial setup, document.readyState:', document.readyState)
if (document.readyState === 'loading') {
  console.log('[App] DOM still loading, adding DOMContentLoaded listener')
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOMContentLoaded event fired')
    mountApp()
  })
} else {
  console.log('[App] DOM already ready, mounting immediately')
  mountApp()
}
