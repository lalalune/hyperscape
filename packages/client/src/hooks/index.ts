/**
 * Hooks Barrel Export
 *
 * React hooks for Hyperscape client functionality.
 */

export { useFullscreen } from "./useFullscreen";
export { usePane } from "./usePane";
export { useUpdate } from "./useUpdate";

// Blockchain / Wallet hooks
export {
  useJejuWallet,
  useGaslessGameplay,
  useGameTransaction,
  type JejuWalletState,
  type JejuWalletActions,
  type UseJejuWalletResult,
} from "./useJejuWallet";
