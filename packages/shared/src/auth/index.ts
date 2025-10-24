/**
 * Shared Authentication Module
 * 
 * Unified authentication utilities for all Hyperscape applications.
 * Provides both client-side and server-side authentication components.
 * 
 * @packageDocumentation
 */

// Client-side exports
export {
  PrivyAuthManager,
  privyAuthManager,
  createPrivyAuthManager,
  type PrivyAuthState,
  type PrivyAuthConfig,
} from './PrivyAuthManager'

export {
  PrivyAuthProvider,
  type PrivyAuthProviderProps,
  LoginScreen,
  type LoginScreenProps,
  type LoginScreenBranding,
  type LoginScreenCopy,
  type LoginScreenFeature,
  type LoginScreenTheme,
} from './client'

// Server-side exports
export {
  PrivyAuthService,
  createPrivyAuthService,
  type PrivyUserInfo,
  type User,
  type PrivyAuthAdapter,
  type PrivyAuthConfig as PrivyServiceConfig,
} from './server/privy-auth'

export {
  JWTService,
  createJWTService,
  type JWTConfig,
  type JWTPayload,
} from './server/jwt'

export {
  createAuthMiddleware,
  type AuthMiddleware,
  type AuthMiddlewareConfig,
  type AuthenticatedRequest,
} from './server/middleware'

// Re-export types
export type { User as PrivyUser } from '@privy-io/react-auth'
