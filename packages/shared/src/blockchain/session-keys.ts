/**
 * Session Keys for Gasless Game Actions
 *
 * Session keys enable users to grant limited permissions to the game server
 * for frequent actions (inventory, equipment, combat) without wallet popups.
 *
 * Flow:
 * 1. User logs in and grants a session key (one-time signature)
 * 2. Session key is stored on server with permissions
 * 3. Server uses session key for all game actions
 * 4. Session expires after configurable duration
 *
 * Security:
 * - Session keys have limited permissions (specific contracts/functions)
 * - Short expiration (24h default)
 * - Can be revoked by user at any time
 * - Never touches user's main funds without explicit approval
 */

import {
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  toBytes,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { getChain, getRpcUrl, type JejuNetwork } from "./chain";

// ============ Types ============

export interface SessionKeyPermission {
  /** Contract address this permission applies to */
  target: Address;
  /** Function selector (4 bytes) or "*" for all functions */
  selector: Hex | "*";
  /** Maximum value that can be sent (0 for no value) */
  maxValue?: bigint;
  /** Maximum number of times this can be called (0 for unlimited) */
  maxCalls?: number;
}

export interface SessionKey {
  /** Session key address (derived from private key) */
  address: Address;
  /** Encrypted private key (only stored server-side) */
  encryptedPrivateKey: string;
  /** Owner's address who granted this session */
  owner: Address;
  /** Permissions granted to this session key */
  permissions: SessionKeyPermission[];
  /** Unix timestamp when session expires */
  expiresAt: number;
  /** Unix timestamp when session was created */
  createdAt: number;
  /** Whether this session is still valid */
  isValid: boolean;
  /** Number of transactions executed */
  transactionCount: number;
  /** Signature from owner authorizing this session */
  ownerSignature: Hex;
}

export interface CreateSessionKeyParams {
  /** Owner's wallet address */
  ownerAddress: Address;
  /** Permissions to grant */
  permissions: SessionKeyPermission[];
  /** Duration in seconds (default 24 hours) */
  duration?: number;
  /** Network */
  network?: JejuNetwork;
}

export interface SessionKeyStore {
  /** Get session key for an owner */
  get: (ownerAddress: Address) => Promise<SessionKey | null>;
  /** Store a new session key */
  set: (sessionKey: SessionKey) => Promise<void>;
  /** Delete a session key */
  delete: (ownerAddress: Address) => Promise<void>;
  /** Increment transaction count */
  incrementTxCount: (ownerAddress: Address) => Promise<void>;
}

// ============ Constants ============

const DEFAULT_SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

/**
 * Compute function selector (first 4 bytes of keccak256 hash)
 */
function selector(signature: string): Hex {
  const hash = keccak256(toBytes(signature));
  return hash.slice(0, 10) as Hex;
}

/**
 * Pre-defined permission sets for common game operations
 */
export const GAME_PERMISSION_SETS = {
  /** Basic gameplay: inventory, equipment, combat */
  GAMEPLAY: (worldAddress: Address): SessionKeyPermission[] => [
    { target: worldAddress, selector: "*" }, // All functions on World contract
  ],

  /** Inventory only */
  INVENTORY: (worldAddress: Address): SessionKeyPermission[] => [
    { target: worldAddress, selector: selector("hyperscape__addItem(address,uint16,uint32)") },
    { target: worldAddress, selector: selector("hyperscape__removeItem(address,uint8,uint32)") },
    { target: worldAddress, selector: selector("hyperscape__moveItem(address,uint8,uint8)") },
  ],

  /** Equipment only */
  EQUIPMENT: (worldAddress: Address): SessionKeyPermission[] => [
    { target: worldAddress, selector: selector("hyperscape__equipItem(uint8)") },
    { target: worldAddress, selector: selector("hyperscape__unequipItem(uint8)") },
  ],

  /** Combat only */
  COMBAT: (worldAddress: Address): SessionKeyPermission[] => [
    { target: worldAddress, selector: selector("hyperscape__attackMob(address)") },
  ],

  /** Resource gathering */
  GATHERING: (worldAddress: Address): SessionKeyPermission[] => [
    { target: worldAddress, selector: selector("hyperscape__chopTree(address)") },
    { target: worldAddress, selector: selector("hyperscape__fish(address)") },
  ],
} as const;

// ============ Session Key Management ============

/**
 * Generate a message for the owner to sign to authorize a session key
 */
export function generateSessionAuthorizationMessage(
  sessionKeyAddress: Address,
  permissions: SessionKeyPermission[],
  expiresAt: number,
  chainId: number
): string {
  const permissionsSummary = permissions
    .map((p) => `${p.target}:${p.selector}`)
    .join(", ");

  return [
    "Authorize Session Key for Hyperscape",
    "",
    `Session Key: ${sessionKeyAddress}`,
    `Chain ID: ${chainId}`,
    `Expires: ${new Date(expiresAt * 1000).toISOString()}`,
    "",
    "Permissions:",
    permissionsSummary,
    "",
    "This session key can execute game actions on your behalf.",
    "You can revoke this at any time by disconnecting.",
  ].join("\n");
}

/**
 * Generate a hash for verifying session key authorization
 */
export function hashSessionAuthorization(
  sessionKeyAddress: Address,
  permissions: SessionKeyPermission[],
  expiresAt: number,
  chainId: number
): Hex {
  const permissionsHash = keccak256(
    encodeAbiParameters(
      [{ type: "tuple[]", components: [{ type: "address" }, { type: "bytes4" }] }],
      [permissions.map((p) => [p.target, p.selector === "*" ? "0x00000000" : p.selector])]
    )
  );

  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }],
      [sessionKeyAddress, permissionsHash, BigInt(expiresAt), BigInt(chainId)]
    )
  );
}

/**
 * Create a new session key (generates key pair)
 */
export function createSessionKeyPair(): { privateKey: Hex; address: Address } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

/**
 * Verify a session key authorization signature
 */
export async function verifySessionAuthorization(
  sessionKeyAddress: Address,
  permissions: SessionKeyPermission[],
  expiresAt: number,
  ownerAddress: Address,
  ownerSignature: Hex,
  network?: JejuNetwork
): Promise<boolean> {
  const chain = getChain(network);
  const message = generateSessionAuthorizationMessage(
    sessionKeyAddress,
    permissions,
    expiresAt,
    chain.id
  );

  // Recover signer from signature
  const { recoverMessageAddress } = await import("viem");
  const recoveredAddress = await recoverMessageAddress({
    message,
    signature: ownerSignature,
  });

  return recoveredAddress.toLowerCase() === ownerAddress.toLowerCase();
}

/**
 * Check if a session key has permission for an action
 */
export function hasPermission(
  sessionKey: SessionKey,
  target: Address,
  selector: Hex
): boolean {
  // Check if session is expired
  if (Date.now() / 1000 > sessionKey.expiresAt) {
    return false;
  }

  // Check if session is still valid
  if (!sessionKey.isValid) {
    return false;
  }

  // Check permissions
  for (const permission of sessionKey.permissions) {
    const targetMatch = permission.target.toLowerCase() === target.toLowerCase();
    const selectorMatch =
      permission.selector === "*" ||
      permission.selector.toLowerCase() === selector.slice(0, 10).toLowerCase();

    if (targetMatch && selectorMatch) {
      // Check call limit if set
      if (permission.maxCalls && sessionKey.transactionCount >= permission.maxCalls) {
        continue;
      }
      return true;
    }
  }

  return false;
}

// ============ In-Memory Session Key Store (Default) ============

const sessionKeyCache = new Map<string, SessionKey>();

export const defaultSessionKeyStore: SessionKeyStore = {
  async get(ownerAddress: Address): Promise<SessionKey | null> {
    const key = ownerAddress.toLowerCase();
    const session = sessionKeyCache.get(key);

    if (!session) return null;

    // Check expiration
    if (Date.now() / 1000 > session.expiresAt) {
      sessionKeyCache.delete(key);
      return null;
    }

    return session;
  },

  async set(sessionKey: SessionKey): Promise<void> {
    sessionKeyCache.set(sessionKey.owner.toLowerCase(), sessionKey);
  },

  async delete(ownerAddress: Address): Promise<void> {
    sessionKeyCache.delete(ownerAddress.toLowerCase());
  },

  async incrementTxCount(ownerAddress: Address): Promise<void> {
    const session = sessionKeyCache.get(ownerAddress.toLowerCase());
    if (session) {
      session.transactionCount++;
    }
  },
};

// ============ Session Key Execution ============

/**
 * Execute a transaction using a session key
 */
export async function executeWithSessionKey(
  sessionKey: SessionKey,
  target: Address,
  callData: Hex,
  network?: JejuNetwork
): Promise<Hash> {
  const funcSelector = callData.slice(0, 10) as Hex;

  // Verify permission
  if (!hasPermission(sessionKey, target, funcSelector)) {
    throw new Error(`Session key does not have permission for ${target}:${funcSelector}`);
  }

  const chain = getChain(network);

  // Decrypt and use session key
  const privateKey = decryptSessionKey(sessionKey.encryptedPrivateKey);
  const account = privateKeyToAccount(privateKey as Hex);

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(getRpcUrl(network)),
  });

  // Send transaction  
  const hash = await walletClient.sendTransaction({
    to: target,
    data: callData,
  } as unknown as Parameters<typeof walletClient.sendTransaction>[0]);

  return hash;
}

// ============ Encryption Helpers ============

/**
 * Encrypt a session key private key for storage
 * In production, use proper encryption with server-side secrets
 */
export function encryptSessionKey(privateKey: Hex): string {
  // Simple base64 encoding for development
  // TODO: Replace with proper AES-256-GCM encryption using server secret
  const serverSecret = process.env.SESSION_KEY_SECRET || "development-secret";
  const combined = `${serverSecret}:${privateKey}`;
  return Buffer.from(combined).toString("base64");
}

/**
 * Decrypt a session key private key
 */
export function decryptSessionKey(encrypted: string): Hex {
  const serverSecret = process.env.SESSION_KEY_SECRET || "development-secret";
  const decoded = Buffer.from(encrypted, "base64").toString();
  const [secret, privateKey] = decoded.split(":");

  if (secret !== serverSecret) {
    throw new Error("Invalid session key encryption");
  }

  return privateKey as Hex;
}

// ============ Server-Side Session Management ============

/**
 * Session key manager for server-side use
 */
export class SessionKeyManager {
  private store: SessionKeyStore;
  private network: JejuNetwork;

  constructor(store: SessionKeyStore = defaultSessionKeyStore, network?: JejuNetwork) {
    this.store = store;
    this.network = network || "jeju";
  }

  /**
   * Create and store a new session key for an owner
   * 
   * @param ownerAddress - Address of the wallet owner
   * @param permissions - Permissions to grant to the session key
   * @param ownerSignature - Signature from owner authorizing the session
   * @param duration - Duration in seconds
   * @param existingSessionKey - Optional: pre-generated session key (from pending session flow)
   */
  async createSession(
    ownerAddress: Address,
    permissions: SessionKeyPermission[],
    ownerSignature: Hex,
    duration: number = DEFAULT_SESSION_DURATION,
    existingSessionKey?: { address: Address; privateKey: Hex }
  ): Promise<SessionKey> {
    const { privateKey, address } = existingSessionKey || createSessionKeyPair();
    const _chain = getChain(this.network); // Reserved for future chain-specific logic
    const expiresAt = Math.floor(Date.now() / 1000) + duration;

    // Verify owner's signature
    const isValid = await verifySessionAuthorization(
      address,
      permissions,
      expiresAt,
      ownerAddress,
      ownerSignature,
      this.network
    );

    if (!isValid) {
      throw new Error("Invalid session authorization signature");
    }

    const sessionKey: SessionKey = {
      address,
      encryptedPrivateKey: encryptSessionKey(privateKey),
      owner: ownerAddress,
      permissions,
      expiresAt,
      createdAt: Math.floor(Date.now() / 1000),
      isValid: true,
      transactionCount: 0,
      ownerSignature,
    };

    await this.store.set(sessionKey);
    return sessionKey;
  }

  /**
   * Get active session for an owner
   */
  async getSession(ownerAddress: Address): Promise<SessionKey | null> {
    return this.store.get(ownerAddress);
  }

  /**
   * Revoke a session
   */
  async revokeSession(ownerAddress: Address): Promise<void> {
    await this.store.delete(ownerAddress);
  }

  /**
   * Execute a transaction using the owner's session key
   */
  async execute(
    ownerAddress: Address,
    target: Address,
    callData: Hex
  ): Promise<Hash> {
    const session = await this.store.get(ownerAddress);

    if (!session) {
      throw new Error("No active session for this address");
    }

    const hash = await executeWithSessionKey(session, target, callData, this.network);
    await this.store.incrementTxCount(ownerAddress);

    return hash;
  }

  /**
   * Check if owner has an active session with required permissions
   */
  async canExecute(
    ownerAddress: Address,
    target: Address,
    selector: Hex
  ): Promise<boolean> {
    const session = await this.store.get(ownerAddress);
    if (!session) return false;
    return hasPermission(session, target, selector);
  }
}

// ============ Export Singleton ============

let sessionKeyManager: SessionKeyManager | null = null;

export function getSessionKeyManager(network?: JejuNetwork): SessionKeyManager {
  if (!sessionKeyManager) {
    sessionKeyManager = new SessionKeyManager(defaultSessionKeyStore, network);
  }
  return sessionKeyManager;
}
