/**
 * Library Barrel Export
 */

export { ThreeResourceManager } from "./ThreeResourceManager";
export { windowManager } from "./responsiveWindowManager";
export { ErrorBoundary } from "./ErrorBoundary";
export * from "./error-reporting";
export { injectFarcasterMetaTags } from "./farcaster-frame-config";
export {
  isTauriApp,
  getPlatformInfo,
  openExternalUrl,
  onDeepLink,
  parseOAuthCallback,
  isSteamDeck,
  isSteamGameMode,
  isGamepadConnected,
  getGamepadType,
  clearPlatformInfoCache,
} from "./tauri-integration";
export type { PlatformInfo } from "./tauri-integration";
