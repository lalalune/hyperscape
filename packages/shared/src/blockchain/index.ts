/**
 * Hyperscape Blockchain Integration
 * 
 * Comprehensive on-chain integration for the Hyperscape MMO:
 * 
 * - **chain**: Network configuration and contract addresses
 * - **smart-account**: ERC-4337 smart accounts for gasless UX
 * - **session-keys**: Delegated signing for frequent game actions
 * - **erc8004**: Player identity and ban checking (ERC-8004)
 * - **x402**: HTTP 402 payment protocol with EIP-712 signatures
 * - **paymaster**: Gasless transactions via multicoin paymasters
 * - **game-economy**: Gold.sol and Items.sol integration
 * - **mud-client**: MUD framework integration for game state
 * 
 * ## Gasless UX Architecture
 * 
 * Users never need to worry about gas or wallet popups during gameplay:
 * 
 * 1. User logs in with Privy (email, social, or wallet)
 * 2. Embedded wallet is created automatically
 * 3. Session key is granted for gameplay (one-time signature)
 * 4. All game actions are sponsored by the game server
 * 5. User only sees wallet popup for high-value operations (NFT minting, trading)
 * 
 * @example
 * ```typescript
 * import { 
 *   createSmartAccountClient,
 *   getSessionKeyManager,
 *   checkPlayerAccess, 
 *   getGoldBalance,
 * } from "@hyperscape/shared/blockchain";
 * 
 * // Create smart account for gasless transactions
 * const smartAccount = await createSmartAccountClient({
 *   signer: walletClient,
 *   paymasterAddress: PAYMASTER_ADDRESS,
 * });
 * 
 * // Execute gasless transaction
 * const hash = await smartAccount.sendTransaction({
 *   to: GOLD_CONTRACT,
 *   data: encodeFunctionData({ ... }),
 * });
 * ```
 */

// ============ Chain Configuration ============

export {
  // Types
  type JejuNetwork,
  type ContractAddresses,
  // Chain definitions
  JEJU_LOCALNET,
  JEJU_TESTNET,
  JEJU_MAINNET,
  ANVIL_CHAIN,
  CHAINS,
  CHAIN_IDS,
  // Functions
  getChain,
  getRpcUrl,
  detectNetwork,
  getContractAddresses,
  getOptionalAddress,
  isBlockchainConfigured,
  getConfigurationStatus,
} from "./chain";

// Re-export getChain for direct imports
export { getChain as getJejuChain } from "./chain";

// ============ ERC-8004 Identity & Bans ============

export {
  // Types
  StakeTier,
  type AgentRegistration,
  type BanRecord,
  type MarketplaceInfo,
  type AccessCheckResult,
  // Agent queries
  agentExists,
  getAgent,
  getAgentOwner,
  getMarketplaceInfo,
  getAgentMetadata,
  // Ban checking
  isNetworkBanned,
  isAppBanned,
  isAccessAllowed,
  getNetworkBan,
  getBanReason,
  isAddressBanned,
  // High-level access control
  checkPlayerAccess,
  requirePlayerAccess,
  // Utilities
  generateAppId,
  HYPERSCAPE_APP_ID,
  resetClient as resetErc8004Client,
} from "./erc8004";

// ============ x402 Payments ============

export {
  // Types
  type PaymentRequirements,
  type PaymentScheme,
  type PaymentPayload,
  type SettlementResult,
  type PaymentVerification,
  // Constants
  GAME_PAYMENT_TIERS,
  // Core functions
  createPaymentRequirement,
  createPaymentPayload,
  parsePaymentHeader,
  verifyPaymentSignature,
  signPaymentPayload,
  settlePayment,
  // Token support
  isTokenSupported,
  getFacilitatorStats,
  // High-level functions
  checkPayment,
  requirePayment,
  generate402Headers,
  calculateFee,
} from "./x402";

// ============ Paymaster (Gasless Transactions) ============

export {
  // Types
  type PaymasterInfo,
  type GasEstimate,
  type PaymasterData,
  // Discovery
  getAvailablePaymasters,
  getPaymasterForToken,
  findBestPaymaster,
  // Gas estimation
  estimateGasCost,
  // UserOperation helpers
  generatePaymasterData,
  createPaymasterConfig,
  // Utilities
  isGaslessAvailable,
  getPaymasterVersion,
  // Service
  paymasterService,
} from "./paymaster";

// ============ Game Economy (Gold & Items) ============

export {
  // Types
  type ItemMetadata,
  type MintedItemInfo,
  type GoldClaimParams,
  type ItemMintParams,
  type GameSignerConfig,
  // Gold functions
  getGoldBalance,
  getGoldClaimNonce,
  verifyGoldClaim,
  signGoldClaim,
  claimGold,
  burnGold,
  // Items functions
  getItemBalance,
  getItemBalances,
  getItemMetadata,
  getMintedItemInfo,
  checkItemInstance,
  verifyItemMint,
  signItemMint,
  mintItem,
  burnItem,
  // Helpers
  generateInstanceId,
  getGameSigner,
  getGameAgentId,
  getPlayerOnChainState,
  // Event watchers (for server-side inventory sync)
  watchItemBurns,
  watchGoldClaims,
  watchItemMints,
} from "./game-economy";

// ============ Smart Accounts (ERC-4337) ============

export {
  // Types
  type UserOperation,
  type SmartAccountConfig,
  type TransactionRequest,
  type SmartAccountClient,
  // Constants
  ENTRYPOINT_ADDRESS_V07,
  SIMPLE_ACCOUNT_FACTORY,
  // Factory functions
  createSmartAccountClient,
  createSmartAccountFromPrivateKey,
  getSmartAccountAddress,
  createInitCode,
  createBundlerClient,
  // Utilities
  isBundlerAvailable,
} from "./smart-account";

// ============ Session Keys (Gasless Gameplay) ============

export {
  // Types
  type SessionKeyPermission,
  type SessionKey,
  type CreateSessionKeyParams,
  type SessionKeyStore,
  // Permission sets
  GAME_PERMISSION_SETS,
  // Key management
  createSessionKeyPair,
  generateSessionAuthorizationMessage,
  hashSessionAuthorization,
  verifySessionAuthorization,
  hasPermission,
  executeWithSessionKey,
  // Encryption
  encryptSessionKey,
  decryptSessionKey,
  // Manager
  SessionKeyManager,
  getSessionKeyManager,
  defaultSessionKeyStore,
} from "./session-keys";

// ============ MUD Client ============

export {
  // Types
  type MudClient,
  type TxReceipt,
  type MudEventType,
  type MudGameEvent,
  // Setup
  setupMudClient,
  isMudClientAvailable,
  getMudClientOrThrow,
  // Batch operations
  batchInventoryOperations,
  // Event system
  onMudEvent,
  emitMudEvent,
  // Integration status
  isFullIntegrationAvailable,
  getIntegrationStatus,
} from "./mud-client";

// ============ Gasless Transactions ============

export {
  // Types
  type GaslessConfig,
  type GaslessResult,
  type GameAction,
  type GameActionParams,
  // Client-side API
  executeGaslessAction,
  executeGaslessBatch,
  // Server-side helpers
  encodeGameAction,
  // Action-specific helpers
  claimGoldGasless,
  mintItemGasless,
  burnGoldGasless,
  addItemGasless,
  equipItemGasless,
  registerPlayerGasless,
  // Utilities
  estimateActionCost,
  isGaslessAvailable as isGaslessServerAvailable,
} from "./gasless";
