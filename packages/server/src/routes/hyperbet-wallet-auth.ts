/**
 * HyperBet Wallet Auth — Ed25519 signature verification for Solana wallets
 *
 * Viewers prove wallet ownership by signing a message.
 * Format: "HyperBet:{action}:{nonce}:{timestamp}"
 */

import { PublicKey } from "@solana/web3.js";
import { createPublicKey, verify } from "node:crypto";

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_NONCE_CACHE = 10_000;

/** Ed25519 DER prefix for SPKI encoding (RFC 8410) */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** In-memory nonce replay protection */
const usedNonces = new Map<string, number>();

/** Periodic cleanup of expired nonces */
let cleanupScheduled = false;
function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    cleanupScheduled = false;
    const now = Date.now();
    for (const [nonce, ts] of usedNonces) {
      if (now - ts > NONCE_EXPIRY_MS) usedNonces.delete(nonce);
    }
  }, 60_000).unref();
}

export interface WalletAuthPayload {
  walletAddress: string;
  signature: string; // base64-encoded Ed25519 signature
  message: string; // the signed message string
}

export interface WalletAuthResult {
  valid: boolean;
  walletAddress: string | null;
  action: string | null;
  error?: string;
}

/**
 * Verify a wallet signature for a HyperBet action.
 */
export function checkWalletSignature(
  payload: WalletAuthPayload,
): WalletAuthResult {
  const { walletAddress, signature, message } = payload;

  // Parse the message format
  const parts = message.split(":");
  if (parts.length !== 4 || parts[0] !== "HyperBet") {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error:
        "Invalid message format — expected HyperBet:{action}:{nonce}:{timestamp}",
    };
  }

  const [, action, nonce, timestampStr] = parts;
  const timestamp = parseInt(timestampStr, 10);

  // Check timestamp freshness
  const now = Date.now();
  if (isNaN(timestamp) || Math.abs(now - timestamp) > NONCE_EXPIRY_MS) {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error: "Message expired or invalid timestamp",
    };
  }

  // Check nonce replay
  const nonceKey = `${walletAddress}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error: "Nonce already used",
    };
  }

  // Verify Ed25519 signature
  let pubkeyBytes: Uint8Array;
  try {
    pubkeyBytes = new PublicKey(walletAddress).toBytes();
  } catch {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error: "Invalid wallet address",
    };
  }

  let sigBytes: Uint8Array;
  try {
    sigBytes = Buffer.from(signature, "base64");
  } catch {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error: "Invalid signature encoding",
    };
  }

  const messageBytes = new TextEncoder().encode(message);

  // Use Node.js crypto Ed25519 verification
  let isValid: boolean;
  try {
    const keyObject = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pubkeyBytes)]),
      format: "der",
      type: "spki",
    });
    isValid = verify(null, messageBytes, keyObject, sigBytes);
  } catch {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error: "Signature verification failed",
    };
  }

  if (!isValid) {
    return {
      valid: false,
      walletAddress: null,
      action: null,
      error: "Signature verification failed",
    };
  }

  // Mark nonce as used
  if (usedNonces.size >= MAX_NONCE_CACHE) {
    const iter = usedNonces.keys();
    for (let i = 0; i < 1000; i++) {
      const key = iter.next().value;
      if (key) usedNonces.delete(key);
    }
  }
  usedNonces.set(nonceKey, now);
  scheduleCleanup();

  return { valid: true, walletAddress, action };
}
