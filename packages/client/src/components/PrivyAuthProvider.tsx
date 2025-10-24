import React from 'react'

import { privyAuthManager, PrivyAuthProvider as SharedPrivyAuthProvider } from '../auth'

interface PrivyAuthProviderProps {
  children: React.ReactNode
}

export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const appId = import.meta.env.PUBLIC_PRIVY_APP_ID || ''
  const isValidAppId = appId.length > 0 && !appId.includes('your-privy-app-id')

  if (!isValidAppId) {
    console.warn('[PrivyAuthProvider] No valid Privy App ID configured. Authentication disabled.')
    console.warn('[PrivyAuthProvider] To enable authentication, set PUBLIC_PRIVY_APP_ID in your .env file')
    console.warn('[PrivyAuthProvider] Get your App ID from https://dashboard.privy.io/')
    return <>{children}</>
  }

  return (
    <SharedPrivyAuthProvider
      appId={appId}
      authManager={privyAuthManager}
      exposeLogoutOnWindow
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
            createOnLogin: 'users-without-wallets',
          },
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
      }}
    >
      {children}
    </SharedPrivyAuthProvider>
  )
}
