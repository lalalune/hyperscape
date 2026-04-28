/**
 * Library Barrel Export
 */

export { ThreeResourceManager } from "./ThreeResourceManager";
export { windowManager } from "./responsiveWindowManager";
export { ErrorBoundary } from "./ErrorBoundary";
export * from "./error-reporting";
export { injectFarcasterMetaTags } from "./farcaster-frame-config";
export {
  apiClient,
  type ApiClientOptions,
  type ApiResponse,
} from "./api-client";
export {
  GAME_API_URL,
  GAME_WS_URL,
  CDN_URL,
  ELIZAOS_URL,
  ELIZAOS_API,
} from "./api-config";
export {
  withRetry,
  tryWithRetry,
  retryable,
  retryFetch,
  type RetryOptions,
  type RetryResult,
} from "./retry";
export { logger } from "./logger";
// Object pooling for game entities (preferred for MMORPG patterns)
export {
  ObjectPool,
  EntityPool,
  poolRegistry,
  createMonitoredPool,
  type ObjectFactory,
  type ObjectReset,
} from "./LRUCache";

// Secure storage for auth tokens with expiration
export {
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  setSessionData,
  getSessionData,
  removeSessionData,
  isTokenValid,
  getTokenExpirationMs,
  clearAllAuthData,
  migrateToSecureStorage,
} from "./secureStorage";
