/**
 * useAuth Hook
 * Provides access to Privy authentication state
 */

import { useState, useEffect } from 'react'
import { privyAuthManager, type PrivyAuthState } from '../lib/PrivyAuthManager'

/**
 * Check if Privy is configured
 */
const isPrivyConfigured = () => {
  const appId = import.meta.env.VITE_PRIVY_APP_ID || ''
  return appId && appId.length > 0 && !appId.includes('your_privy_app_id')
}

/**
 * Hook to access authentication state and methods
 *
 * @returns Authentication state and methods
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAuthenticated, user, login, logout } = useAuth()
 *
 *   return (
 *     <div>
 *       {isAuthenticated ? (
 *         <>
 *           <p>Welcome, {user?.email?.address}</p>
 *           <button onClick={logout}>Sign Out</button>
 *         </>
 *       ) : (
 *         <button onClick={login}>Sign In</button>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAuth() {
  const [authState, setAuthState] = useState<PrivyAuthState>(privyAuthManager.getState())

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe((state) => {
      setAuthState(state)
    })

    return unsubscribe
  }, [])

  // Login function that handles missing Privy
  const login = () => {
    if (!isPrivyConfigured()) {
      console.error('[useAuth] Cannot login: Privy is not configured. Please set VITE_PRIVY_APP_ID in your .env file.')
      alert('Authentication is not configured.\n\nPlease add VITE_PRIVY_APP_ID to your .env file.\nGet your App ID from https://dashboard.privy.io/')
      return
    }

    // Access the global Privy login function
    const windowWithPrivy = window as any
    if (windowWithPrivy.privyLogin) {
      windowWithPrivy.privyLogin()
    } else {
      console.error('[useAuth] Privy login function not found on window')
    }
  }

  // Logout function
  const logout = async () => {
    // Access the global Privy logout function
    const windowWithPrivy = window as any
    if (windowWithPrivy.privyLogout) {
      await windowWithPrivy.privyLogout()
    }
    privyAuthManager.clearAuth()
  }

  return {
    // State
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    privyUserId: authState.privyUserId,
    privyToken: authState.privyToken,
    isNewUser: authState.isNewUser,

    // Methods
    login,
    logout,
    completeOnboarding: () => privyAuthManager.completeOnboarding(),
    getToken: () => privyAuthManager.getToken(),
  }
}
