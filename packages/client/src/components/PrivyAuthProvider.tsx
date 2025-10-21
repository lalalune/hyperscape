/**
 * Privy Authentication Provider
 * Wraps the application with Privy authentication context
 */

import React, { useEffect } from 'react'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { privyAuthManager } from '../PrivyAuthManager'

interface PrivyAuthProviderProps {
  children: React.ReactNode
}

/**
 * Inner component that handles Privy hooks
 */
function PrivyAuthHandler({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy()

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

  // Handle logout
  useEffect(() => {
    const handleLogout = async () => {
      await logout()
      privyAuthManager.clearAuth()
    }

    // Expose logout globally for debugging
    const windowWithLogout = window as typeof window & { privyLogout: () => void }
    windowWithLogout.privyLogout = handleLogout
  }, [logout])

  return <>{children}</>
}

/**
 * Main Privy Auth Provider Component
 */
export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  // Get Privy App ID from Vite environment variables (PUBLIC_ prefix configured in vite.config.ts)
  const appId = import.meta.env.PUBLIC_PRIVY_APP_ID || ''

  // Check if app ID is valid (not empty and not placeholder)
  const isValidAppId = appId && appId.length > 0 && !appId.includes('your-privy-app-id')

  if (!isValidAppId) {
    console.warn('[PrivyAuthProvider] No valid Privy App ID configured. Authentication disabled.')
    console.warn('[PrivyAuthProvider] To enable authentication, set PUBLIC_PRIVY_APP_ID in your .env file')
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
          logo: '/assets/images/logo.png',
          walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'detected_wallets'],
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets' as const
          }
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

