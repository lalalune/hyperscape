/**
 * Main Entry Point with Authentication
 *
 * Wraps the application with Privy authentication and shows landing page
 */

// Buffer polyfill for Privy
import { Buffer } from 'buffer'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { LoginScreen } from './auth/LoginScreen'
import { privyAuthManager } from './auth/PrivyAuthManager'
import { PrivyAuthProvider } from './auth/PrivyAuthProvider'
import './styles/index.css'

// Set up Buffer polyfill for Privy
if (!globalThis.Buffer) {
  (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = Buffer
}

// Unregister any existing service workers to prevent caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('[Asset Forge] Unregistering service worker:', registration.scope)
      registration.unregister()
    })
  })
}

// Log environment info for debugging deployment issues
console.log('[Asset Forge] Initializing...')
console.log('[Asset Forge] Environment:', import.meta.env.MODE)
console.log('[Asset Forge] Privy App ID:', import.meta.env.VITE_PUBLIC_PRIVY_APP_ID ? '✅ Set' : '❌ Missing')

// Check for required environment variables
if (!import.meta.env.VITE_PUBLIC_PRIVY_APP_ID) {
  console.error('[Asset Forge] ❌ CRITICAL: VITE_PUBLIC_PRIVY_APP_ID is not set!')
  console.error('[Asset Forge] Available env vars:', Object.keys(import.meta.env))
}

function AuthenticatedApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    try {
      // Try to restore session from localStorage
      const { token } = privyAuthManager.restoreFromStorage()

      if (token) {
        setIsAuthenticated(true)
      }

      setIsLoading(false)

      // Listen for auth state changes
      const handleAuthChanged = (state: unknown) => {
        setIsAuthenticated((state as { isAuthenticated: boolean }).isAuthenticated)
      }

      privyAuthManager.on('state-changed', handleAuthChanged)
      privyAuthManager.on('logged-out', () => setIsAuthenticated(false))

      return () => {
        privyAuthManager.off('state-changed', handleAuthChanged)
        privyAuthManager.off('logged-out', () => setIsAuthenticated(false))
      }
    } catch (err) {
      console.error('[AuthenticatedApp] Initialization error:', err)
      setError(err as Error)
      setIsLoading(false)
    }
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md bg-slate-800/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Application Error</h2>
          <p className="text-gray-400 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-400">Loading Asset Forge...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={() => setIsAuthenticated(true)} />
  }

  return <App />
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <PrivyAuthProvider>
      <AuthenticatedApp />
      <Analytics />
      <SpeedInsights />
    </PrivyAuthProvider>
  </React.StrictMode>
)

