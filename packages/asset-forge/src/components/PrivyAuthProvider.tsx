/**
 * Privy Authentication Provider for Asset Forge
 * Wraps the application with Privy authentication context
 */

import React, { useEffect } from 'react'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { privyAuthManager } from '../lib/PrivyAuthManager'

interface PrivyAuthProviderProps {
  children: React.ReactNode
}

/**
 * Inner component that handles Privy hooks
 */
function PrivyAuthHandler({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, getAccessToken, login, logout } = usePrivy()

  useEffect(() => {
    const updateAuth = async () => {
      if (ready && authenticated && user) {
        // Get Privy access token (returns string | null)
        const token = await getAccessToken()
        // Only proceed if we have a valid token
        if (!token) {
          console.warn('[PrivyAuthProvider] getAccessToken returned null')
          return
        }
        privyAuthManager.setAuthenticatedUser(user, token)
      } else if (ready && !authenticated) {
        // User is not authenticated
        privyAuthManager.clearAuth()
      }
    }

    updateAuth()
  }, [ready, authenticated, user, getAccessToken])

  // Expose auth functions globally
  useEffect(() => {
    const handleLogout = async () => {
      await logout()
      privyAuthManager.clearAuth()
    }

    // Expose auth manager, login, and logout globally
    const windowWithAuth = window as typeof window & {
      privyLogin: () => void
      privyLogout: () => void
      privyAuthManager: typeof privyAuthManager
    }
    windowWithAuth.privyLogin = login
    windowWithAuth.privyLogout = handleLogout
    windowWithAuth.privyAuthManager = privyAuthManager
  }, [login, logout])

  return <>{children}</>
}

/**
 * Main Privy Auth Provider Component for Asset Forge
 */
export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  // Get Privy App ID from Vite environment variables
  const appId = import.meta.env.VITE_PRIVY_APP_ID || ''

  // Check if app ID is valid (not empty and not placeholder)
  const isValidAppId = appId && appId.length > 0 && !appId.includes('your_privy_app_id')

  if (!isValidAppId) {
    console.warn('[PrivyAuthProvider] No valid Privy App ID configured. Authentication disabled.')
    console.warn('[PrivyAuthProvider] To enable authentication, set VITE_PRIVY_APP_ID in your .env file')
    console.warn('[PrivyAuthProvider] Get your App ID from https://dashboard.privy.io/')
    // Return children without Privy if no app ID - allows development without Privy
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'google', 'farcaster'],
        appearance: {
          theme: 'dark',
          accentColor: '#d4af37',
          logo: '/logo.png',
          walletList: ['phantom', 'metamask', 'coinbase_wallet', 'rainbow', 'detected_wallets'],
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets' as const
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
      }}
    >
      <PrivyAuthHandler>{children}</PrivyAuthHandler>
    </PrivyProvider>
  )
}
