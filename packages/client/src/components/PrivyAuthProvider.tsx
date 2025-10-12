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
        try {
          // Get Privy access token
          const token = await getAccessToken()
          if (token) {
            privyAuthManager.setAuthenticatedUser(user, token)
          }
        } catch (error) {
          console.error('[PrivyAuthHandler] Failed to get access token:', error)
        }
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
      try {
        await logout()
      } catch (err) {
        console.warn('[PrivyAuthHandler] logout threw, continuing to clear local state:', err)
      }
      try {
        privyAuthManager.clearAuth()
      } catch (err) {
        console.warn('[PrivyAuthHandler] clearAuth threw:', err)
      }
    }

    // Expose logout globally for debugging
    if (typeof window !== 'undefined') {
      (window as typeof window & { privyLogout?: () => void }).privyLogout = handleLogout
    }
  }, [logout])

  return <>{children}</>
}

/**
 * Main Privy Auth Provider Component
 */
export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  // Get Privy App ID from environment
  const windowEnvAppId = typeof window !== 'undefined' && (window as typeof window & { env?: { PUBLIC_PRIVY_APP_ID?: string } }).env?.PUBLIC_PRIVY_APP_ID
  const importMetaAppId = typeof import.meta !== 'undefined' ? import.meta.env.PUBLIC_PRIVY_APP_ID : undefined
  const appId = windowEnvAppId || importMetaAppId || ''

  // Check if app ID is valid (not empty and not placeholder)
  const isValidAppId = appId && appId.length > 0 && !appId.includes('your-privy-app-id')

  if (!isValidAppId) {
    console.warn('[PrivyAuthProvider] No valid Privy App ID configured. Authentication disabled.')
    console.warn('[PrivyAuthProvider] To enable authentication, set PUBLIC_PRIVY_APP_ID in your .env file')
    console.warn('[PrivyAuthProvider] Get your App ID from https://dashboard.privy.io/')
    // Return children without Privy if no app ID - allows development without Privy
    return <>{children}</>
  }

  console.log('[PrivyAuthProvider] Initializing Privy with App ID:', appId.substring(0, 10) + '...')

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'google', 'farcaster'],
        appearance: {
          theme: 'dark',
          accentColor: '#4a90e2',
          logo: '/preview.jpg',
          walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'detected_wallets'],
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
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

