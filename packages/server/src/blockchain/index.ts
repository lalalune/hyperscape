/**
 * Blockchain services for Hyperscape server
 *
 * Main blockchain integration is handled by Chain system in @hyperscape/shared.
 * This module exports server-specific services for direct use.
 *
 * ## Gasless Transaction Architecture
 *
 * All game transactions are sponsored by the server using GameTransactionService:
 * 1. Client sends game action request via WebSocket or REST API
 * 2. Server validates action and creates UserOperation
 * 3. Server submits to bundler with paymaster sponsorship
 * 4. Transaction executes on-chain, user never pays gas
 *
 * @see GameTransactionService for the core implementation
 */

// Server-specific services
export { BanCheckService } from "./BanCheckService";
export { GoldClaimingService } from "./GoldClaimingService";
export { ItemMintingService } from "./ItemMintingService";
export { NFTDropSystem, NFTDropIntegration } from "./NFTDropSystem";
export { OraclePublisher } from "./oraclePublisher";
export { GameSigner } from "./GameSigner";

// Gasless transaction service
export {
  GameTransactionService,
  initializeGameTransactionService,
  initializeGameTransactionServiceFromEnv,
  getGameTransactionService,
  type GameTransaction,
  type TransactionResult,
  type GameTransactionConfig,
} from "./GameTransactionService";

// Re-export shared blockchain utilities
export {
  checkPlayerAccess,
  isBlockchainConfigured,
  getGoldBalance,
  signGoldClaim,
  signItemMint,
  getGoldClaimNonce,
  generateInstanceId,
  watchItemBurns,
  watchGoldClaims,
  watchItemMints,
  getOptionalAddress,
  getChain,
  getRpcUrl,
  type JejuNetwork,
  type AccessCheckResult,
  type GoldClaimParams,
  type ItemMintParams,
} from "@hyperscape/shared/blockchain";

/**
 * @deprecated Use Chain system instead. Configure oracle via ChainConfig.enableOracle
 */
export function initializeBlockchainIntegration(): null {
  console.warn(
    "[Blockchain] initializeBlockchainIntegration is deprecated. " +
    "Oracle publishing is now handled by Chain system. " +
    "Set enableOracle: true and oracleAddress in ChainConfig."
  );
  return null;
}
