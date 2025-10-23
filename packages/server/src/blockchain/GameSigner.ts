/**
 * @fileoverview Game Signer Service
 * @module hyperscape/server/blockchain/GameSigner
 * 
 * Serverless signing service for Hyperscape blockchain operations.
 * Handles signing of:
 * - Gold claim requests (with nonces)
 * - Item mint requests (with instance IDs)
 * - Trade verifications
 * 
 * Security:
 * - Private key stored in environment variable
 * - Nonce tracking to prevent replay attacks
 * - Instance ID tracking to prevent duplication
 * - Rate limiting per player
 * 
 * Architecture:
 * - Single signer wallet (game authority)
 * - In-memory nonce management (persisted to DB)
 * - Instance ID registry (prevents double-minting)
 */

import { Wallet, keccak256, solidityPacked, getBytes, toUtf8Bytes } from 'ethers';
import type { BytesLike } from 'ethers';

export interface GoldClaimRequest {
  playerAddress: string;
  amount: bigint;
}

export interface GoldClaimSignature {
  playerAddress: string;
  amount: string;
  nonce: number;
  signature: string;
}

export interface ItemMintRequest {
  playerAddress: string;
  itemId: number;
  amount: number;
  instanceId: string; // bytes32 hex string
}

export interface ItemMintSignature {
  playerAddress: string;
  itemId: number;
  amount: number;
  instanceId: string;
  signature: string;
}

export class GameSigner {
  private wallet: Wallet;
  private playerNonces: Map<string, number> = new Map();
  private mintedInstances: Set<string> = new Set();
  private lastClaimTime: Map<string, number> = new Map();
  
  // Rate limiting: 1 claim per 5 seconds per player
  private readonly CLAIM_COOLDOWN_MS = 5000;
  
  // Rate limiting: 10 mints per minute per player
  private readonly MINT_RATE_LIMIT = 10;
  private readonly MINT_RATE_WINDOW_MS = 60000;
  private mintCounts: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(privateKey: string) {
    if (!privateKey || privateKey.length < 32) {
      throw new Error('[GameSigner] Invalid private key provided');
    }
    
    this.wallet = new Wallet(privateKey);
    console.log('[GameSigner] Initialized with address:', this.wallet.address);
  }

  /**
   * Get the signer's public address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Sign a gold claim request
   * @param request Gold claim request
   * @returns Signed claim data
   */
  async signGoldClaim(request: GoldClaimRequest): Promise<GoldClaimSignature> {
    const { playerAddress, amount } = request;
    
    // Validate address
    if (!playerAddress || playerAddress.length !== 42) {
      throw new Error('[GameSigner] Invalid player address');
    }
    
    // Validate amount
    if (amount <= 0n) {
      throw new Error('[GameSigner] Amount must be positive');
    }
    
    // Rate limiting
    const now = Date.now();
    const lastClaim = this.lastClaimTime.get(playerAddress.toLowerCase());
    if (lastClaim && now - lastClaim < this.CLAIM_COOLDOWN_MS) {
      throw new Error('[GameSigner] Claim cooldown not met. Try again in a few seconds.');
    }
    
    // Get or initialize nonce
    const playerKey = playerAddress.toLowerCase();
    const nonce = this.playerNonces.get(playerKey) || 0;
    
    // Create message hash matching contract
    // keccak256(abi.encodePacked(player, amount, nonce))
    const messageHash = keccak256(
      solidityPacked(
        ['address', 'uint256', 'uint256'],
        [playerAddress, amount.toString(), nonce]
      )
    );
    
    // Sign the message (adds Ethereum prefix)
    const signature = await this.wallet.signMessage(getBytes(messageHash));
    
    // Update state
    this.playerNonces.set(playerKey, nonce + 1);
    this.lastClaimTime.set(playerKey, now);
    
    console.log('[GameSigner] Signed gold claim:', {
      player: playerAddress,
      amount: amount.toString(),
      nonce,
      signature: signature.substring(0, 20) + '...'
    });
    
    return {
      playerAddress,
      amount: amount.toString(),
      nonce,
      signature
    };
  }

  /**
   * Sign an item mint request for Items.sol (ERC-1155)
   * @param request Item mint request
   * @returns Signed mint data
   * 
   * Signature must match Items.sol format:
   * keccak256(abi.encodePacked(msg.sender, itemId, amount, instanceId))
   */
  async signItemMint(request: ItemMintRequest): Promise<ItemMintSignature> {
    const { playerAddress, itemId, amount, instanceId } = request;
    
    // Validate address
    if (!playerAddress || playerAddress.length !== 42) {
      throw new Error('[GameSigner] Invalid player address');
    }
    
    // Validate instance ID uniqueness
    if (this.mintedInstances.has(instanceId)) {
      throw new Error('[GameSigner] Instance ID already minted. Possible duplication attack.');
    }
    
    // Rate limiting
    const now = Date.now();
    const playerKey = playerAddress.toLowerCase();
    const mintRecord = this.mintCounts.get(playerKey);
    
    if (mintRecord) {
      if (now > mintRecord.resetAt) {
        // Reset window
        this.mintCounts.set(playerKey, { count: 1, resetAt: now + this.MINT_RATE_WINDOW_MS });
      } else if (mintRecord.count >= this.MINT_RATE_LIMIT) {
        throw new Error('[GameSigner] Mint rate limit exceeded. Try again later.');
      } else {
        mintRecord.count++;
      }
    } else {
      this.mintCounts.set(playerKey, { count: 1, resetAt: now + this.MINT_RATE_WINDOW_MS });
    }
    
    // Create message hash matching Items.sol contract
    // Signature = sign(keccak256(abi.encodePacked(msg.sender, itemId, amount, instanceId)))
    const messageHash = keccak256(
      solidityPacked(
        ['address', 'uint256', 'uint256', 'bytes32'],
        [playerAddress, itemId, amount, instanceId]
      )
    );
    
    // Sign the message (adds Ethereum signed message prefix)
    const signature = await this.wallet.signMessage(getBytes(messageHash));
    
    // Mark instance as minted
    this.mintedInstances.add(instanceId);
    
    console.log('[GameSigner] Signed item mint:', {
      player: playerAddress,
      itemId,
      amount,
      instanceId: instanceId.substring(0, 20) + '...',
      signature: signature.substring(0, 20) + '...'
    });
    
    return {
      playerAddress,
      itemId,
      amount,
      instanceId,
      signature
    };
  }
  
  /**
   * Calculate instance ID (must match PlayerSystem.sol)
   * @param playerAddress Player address
   * @param itemId Item type ID
   * @param slot Inventory slot number
   * @returns Instance ID as bytes32 hex string
   */
  calculateInstanceId(playerAddress: string, itemId: number, slot: number): string {
    // Matches PlayerSystem._calculateInstanceId:
    // keccak256(abi.encodePacked(player, itemId, slot, "hyperscape"))
    return keccak256(
      solidityPacked(
        ['address', 'uint16', 'uint8', 'string'],
        [playerAddress, itemId, slot, 'hyperscape']
      )
    );
  }

  /**
   * Get current nonce for a player
   * @param playerAddress Player's address
   * @returns Current nonce
   */
  getNonce(playerAddress: string): number {
    return this.playerNonces.get(playerAddress.toLowerCase()) || 0;
  }

  /**
   * Check if an instance has been minted
   * @param instanceId Instance ID to check
   * @returns True if already minted
   */
  isInstanceMinted(instanceId: string): boolean {
    return this.mintedInstances.has(instanceId);
  }

  /**
   * Reset nonce for a player (admin only, for testing)
   * @param playerAddress Player's address
   */
  resetNonce(playerAddress: string): void {
    this.playerNonces.delete(playerAddress.toLowerCase());
    console.log('[GameSigner] Reset nonce for:', playerAddress);
  }

  /**
   * Clear minted instance (when NFT is burned and item re-enters game)
   * @param instanceId Instance ID to clear
   */
  clearMintedInstance(instanceId: string): void {
    this.mintedInstances.delete(instanceId);
    console.log('[GameSigner] Cleared minted instance:', instanceId.substring(0, 20) + '...');
  }

  /**
   * Load persisted state from database
   * @param data Persisted signer state
   */
  loadState(data: {
    nonces: Record<string, number>;
    instances: string[];
  }): void {
    this.playerNonces = new Map(Object.entries(data.nonces));
    this.mintedInstances = new Set(data.instances);
    console.log('[GameSigner] Loaded state:', {
      nonces: this.playerNonces.size,
      instances: this.mintedInstances.size
    });
  }

  /**
   * Get state for persistence
   * @returns Serializable state
   */
  getState(): {
    nonces: Record<string, number>;
    instances: string[];
  } {
    return {
      nonces: Object.fromEntries(this.playerNonces),
      instances: Array.from(this.mintedInstances)
    };
  }
}

/**
 * Singleton instance
 */
let gameSignerInstance: GameSigner | null = null;

/**
 * Initialize the game signer (call once on server start)
 * @param privateKey Private key from environment
 */
export function initializeGameSigner(privateKey: string): GameSigner {
  if (gameSignerInstance) {
    console.warn('[GameSigner] Already initialized, returning existing instance');
    return gameSignerInstance;
  }
  
  gameSignerInstance = new GameSigner(privateKey);
  return gameSignerInstance;
}

/**
 * Get the game signer instance
 * @returns Game signer instance
 */
export function getGameSigner(): GameSigner {
  if (!gameSignerInstance) {
    throw new Error('[GameSigner] Not initialized. Call initializeGameSigner() first.');
  }
  return gameSignerInstance;
}

