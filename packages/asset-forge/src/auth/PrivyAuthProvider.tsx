/**
 * Privy Authentication Provider
 * Wraps the application with Privy authentication context
 */

/// <reference types="vite/client" />

import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import React, { useEffect } from 'react'

import { privyAuthManager } from './PrivyAuthManager'

interface PrivyAuthProviderProps {
  children: React.ReactNode
}

/**
 * Inner component that handles Privy hooks
 */
function PrivyAuthHandler({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy()

  useEffect(() => {
    const handleAuth = async () => {
      if (ready && authenticated && user) {
        const token = await getAccessToken()
        if (!token) {
          console.warn('[PrivyAuthProvider] getAccessToken returned null')
          return
        }
        await privyAuthManager.setAuthenticatedUser(user, token)
      } else if (ready && !authenticated) {
        privyAuthManager.clearAuth()
      }
    }

    handleAuth()
  }, [ready, authenticated, user, getAccessToken])

  return <>{children}</>
}

/**
 * Main Privy Auth Provider Component
 */
export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const appId = import.meta.env.VITE_PUBLIC_PRIVY_APP_ID || ''

  console.log('[PrivyAuthProvider] App ID:', appId ? '✅ Loaded' : '❌ Missing')

  const isValidAppId = appId && appId.length > 0 && !appId.includes('your-privy-app-id')

  if (!isValidAppId) {
    console.error('[PrivyAuthProvider] No valid Privy App ID configured')
    console.error('[PrivyAuthProvider] VITE_PUBLIC_PRIVY_APP_ID:', appId || 'undefined')
    console.error('[PrivyAuthProvider] Available env vars:', Object.keys(import.meta.env))

    // Show error UI instead of black screen
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md bg-slate-800/50 backdrop-blur-sm border border-red-500/20 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Configuration Error</h2>
          <p className="text-gray-400 mb-4">
            Privy authentication is not configured properly. Please contact support.
          </p>
          <p className="text-xs text-gray-500 font-mono">
            VITE_PUBLIC_PRIVY_APP_ID is missing or invalid
          </p>
        </div>
      </div>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#3b82f6',
        },
      }}
    >
      <PrivyAuthHandler>{children}</PrivyAuthHandler>
    </PrivyProvider>
  )
}

