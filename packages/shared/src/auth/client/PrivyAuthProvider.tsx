import React, { useEffect, useMemo } from 'react'
import {
  PrivyProvider,
  type PrivyProviderProps,
  type User,
  usePrivy,
} from '@privy-io/react-auth'

import {
  PrivyAuthManager,
  createPrivyAuthManager,
  privyAuthManager,
  type PrivyAuthConfig,
} from '../PrivyAuthManager'

type ExtraPrivyProviderProps = Omit<PrivyProviderProps, 'appId' | 'children' | 'config'>

export interface PrivyAuthProviderProps {
  children: React.ReactNode
  /**
   * Privy application identifier.
   * Falls back to environment variables when not provided.
   */
  appId?: string
  /**
   * Optional config forwarded to the underlying PrivyProvider.
   * Merged on top of sane defaults used across Hyperscape apps.
   */
  config?: PrivyProviderProps['config']
  /**
   * Provide a pre-configured auth manager.
   * Defaults to the shared singleton exported by this package.
   */
  authManager?: PrivyAuthManager
  /**
   * Create (or retrieve) a named auth manager instance with the supplied configuration.
   * Ignored when `authManager` is passed.
   */
  authManagerConfig?: PrivyAuthConfig
  /**
   * Additional props forwarded to PrivyProvider (e.g. event handlers).
   */
  providerProps?: Partial<ExtraPrivyProviderProps>
  /**
   * Invoked after a successful authentication cycle with the resolved Privy token.
   */
  onAuthSuccess?: (context: {
    user: User
    privyToken: string
    authManager: PrivyAuthManager
  }) => void
  /**
   * Invoked when authentication is cleared (either via logout or Privy session expiry).
   */
  onLogout?: () => void | Promise<void>
  /**
   * Exposes a `privyLogout()` helper on window for debugging convenience.
   */
  exposeLogoutOnWindow?: boolean
}

interface PrivyAuthHandlerProps {
  children: React.ReactNode
  authManager: PrivyAuthManager
  onAuthSuccess?: PrivyAuthProviderProps['onAuthSuccess']
  onLogout?: PrivyAuthProviderProps['onLogout']
  exposeLogoutOnWindow?: boolean
}

const DEFAULT_CONFIG: PrivyProviderProps['config'] = {
  loginMethods: ['wallet', 'email', 'google', 'farcaster'],
  appearance: {
    theme: 'dark',
    accentColor: '#3b82f6',
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
} as const

function mergeConfig(
  base: PrivyProviderProps['config'],
  override?: PrivyProviderProps['config'],
): PrivyProviderProps['config'] {
  if (!override) {
    return base
  }

  return {
    ...base,
    ...override,
    appearance: {
      ...base?.appearance,
      ...override.appearance,
    },
    embeddedWallets: {
      ...base?.embeddedWallets,
      ...override.embeddedWallets,
    },
  }
}

function resolveAppId(explicit?: string): string | undefined {
  if (explicit) {
    return explicit
  }

  try {
    const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined
    const metaId: string | undefined =
      meta?.env?.PUBLIC_PRIVY_APP_ID ??
      meta?.env?.VITE_PUBLIC_PRIVY_APP_ID ??
      meta?.env?.PRIVY_APP_ID

    if (metaId) {
      return metaId
    }
  } catch {
    // noop – bundlers that do not support import.meta will hit this path
  }

  if (typeof process !== 'undefined') {
    const env = process.env as Record<string, string | undefined>
    const processId =
      env.PUBLIC_PRIVY_APP_ID ?? env.VITE_PUBLIC_PRIVY_APP_ID ?? env.PRIVY_APP_ID

    if (processId) {
      return processId
    }
  }

  if (typeof globalThis !== 'undefined') {
    const globalEnv = (globalThis as Record<string, any>).ENV as
      | Record<string, string | undefined>
      | undefined

    return (
      globalEnv?.PUBLIC_PRIVY_APP_ID ??
      globalEnv?.VITE_PUBLIC_PRIVY_APP_ID ??
      globalEnv?.PRIVY_APP_ID
    )
  }

  return undefined
}

function PrivyAuthHandler({
  children,
  authManager,
  onAuthSuccess,
  onLogout,
  exposeLogoutOnWindow,
}: PrivyAuthHandlerProps) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy()

  useEffect(() => {
    if (!ready) {
      return
    }

    let cancelled = false

    const syncAuthState = async () => {
      if (authenticated && user) {
        try {
          const token = await getAccessToken()

          if (!token) {
            console.warn('[SharedPrivyAuthProvider] getAccessToken returned null')
            return
          }

          await authManager.setAuthenticatedUser(user, token)

          if (!cancelled) {
            onAuthSuccess?.({ user, privyToken: token, authManager })
          }
        } catch (error) {
          console.error('[SharedPrivyAuthProvider] Failed to update auth state', error)
        }
      } else {
        authManager.clearAuth()
        if (!cancelled) {
          try {
            await onLogout?.()
          } catch (error) {
            console.error('[SharedPrivyAuthProvider] onLogout threw', error)
          }
        }
      }
    }

    void syncAuthState()

    return () => {
      cancelled = true
    }
  }, [ready, authenticated, user, getAccessToken, authManager, onAuthSuccess, onLogout])

  useEffect(() => {
    if (!exposeLogoutOnWindow) {
      return
    }

    const handler = async () => {
      try {
        await logout()
      } finally {
        authManager.clearAuth()
        await onLogout?.()
      }
    }

    const target = globalThis as Record<string, unknown>
    target.privyLogout = handler

    return () => {
      if (target.privyLogout === handler) {
        delete target.privyLogout
      }
    }
  }, [logout, authManager, onLogout, exposeLogoutOnWindow])

  return <>{children}</>
}

export function PrivyAuthProvider({
  children,
  appId,
  config,
  authManager,
  authManagerConfig,
  providerProps,
  onAuthSuccess,
  onLogout,
  exposeLogoutOnWindow,
}: PrivyAuthProviderProps) {
  const resolvedAppId = resolveAppId(appId)

  const resolvedManager = useMemo(() => {
    if (authManager) {
      return authManager
    }

    if (authManagerConfig) {
      return createPrivyAuthManager(authManagerConfig, 'shared-client')
    }

    return privyAuthManager
  }, [authManager, authManagerConfig])

  const mergedConfig = useMemo(
    () => mergeConfig(DEFAULT_CONFIG, config),
    [config],
  )

  if (!resolvedAppId) {
    console.warn(
      '[SharedPrivyAuthProvider] No Privy App ID available. Children rendered without authentication.',
    )
    return <>{children}</>
  }

  return (
    <PrivyProvider
      {...((providerProps ?? {}) as ExtraPrivyProviderProps)}
      appId={resolvedAppId}
      config={mergedConfig}
    >
      <PrivyAuthHandler
        authManager={resolvedManager}
        onAuthSuccess={onAuthSuccess}
        onLogout={onLogout}
        exposeLogoutOnWindow={exposeLogoutOnWindow}
      >
        {children}
      </PrivyAuthHandler>
    </PrivyProvider>
  )
}
