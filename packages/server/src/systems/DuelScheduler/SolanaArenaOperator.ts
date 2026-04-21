/**
 * SolanaArenaOperator — Implements SolanaArenaOperatorInterface for DuelBettingBridge
 *
 * Sends raw Solana transactions to the deployed Fight Oracle program.
 * Uses @solana/web3.js directly (no Anchor dependency).
 *
 * Env vars:
 *   SOLANA_RPC_URL              — Solana RPC endpoint (required)
 *   SOLANA_REPORTER_PRIVATE_KEY — Reporter keypair as base58 or JSON byte array (required)
 *   SOLANA_FIGHT_ORACLE_PROGRAM_ID — Override program ID (optional)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { createHash } from "node:crypto";
import { Logger } from "../ServerNetwork/services";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PROGRAM_ID = "6Tx7s2UG4maFWakRFVi4GeecXJYyBXQF8f2vJdQShSpV";

/** PDA seeds matching the Anchor program */
const ORACLE_CONFIG_SEED = new TextEncoder().encode("oracle_config");
const DUEL_STATE_SEED = new TextEncoder().encode("duel");

/** Anchor instruction discriminators (from IDL) */
const UPSERT_DUEL_DISCRIMINATOR = Buffer.from([
  174, 7, 139, 223, 70, 128, 251, 128,
]);
const REPORT_RESULT_DISCRIMINATOR = Buffer.from([
  195, 187, 161, 107, 75, 154, 102, 183,
]);

/** DuelStatus enum indices (Borsh u8) */
const DUEL_STATUS = {
  Scheduled: 0,
  BettingOpen: 1,
  Locked: 2,
  Resolved: 3,
  Cancelled: 4,
} as const;

/** MarketSide enum indices (Borsh u8) */
const MARKET_SIDE = {
  None: 0,
  A: 1,
  B: 2,
} as const;

const TX_CONFIRM_TIMEOUT_MS = 30_000;

// ============================================================================
// Borsh serialization helpers
// ============================================================================

function writeU8(buf: Buffer, offset: number, val: number): number {
  buf.writeUInt8(val, offset);
  return offset + 1;
}

function writeI64(buf: Buffer, offset: number, val: bigint): number {
  buf.writeBigInt64LE(val, offset);
  return offset + 8;
}

function writeU64(buf: Buffer, offset: number, val: bigint): number {
  buf.writeBigUInt64LE(val, offset);
  return offset + 8;
}

function writeBytes32(buf: Buffer, offset: number, bytes: Uint8Array): number {
  Buffer.from(bytes).copy(buf, offset);
  return offset + 32;
}

function writeBorshString(buf: Buffer, offset: number, str: string): number {
  const strBytes = Buffer.from(str, "utf-8");
  buf.writeUInt32LE(strBytes.length, offset);
  offset += 4;
  strBytes.copy(buf, offset);
  return offset + strBytes.length;
}

// ============================================================================
// PDA derivation
// ============================================================================

function findOracleConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ORACLE_CONFIG_SEED], programId);
}

function findDuelStatePda(
  duelKeyBytes: Uint8Array,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DUEL_STATE_SEED, duelKeyBytes],
    programId,
  );
}

function hexToBytes32(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (normalized.length !== 64) {
    throw new Error(
      `Expected 32-byte hex string, got ${normalized.length / 2} bytes`,
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Expected 32-byte hex string");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function hashParticipant(id: string): Uint8Array {
  return createHash("sha256").update(id).digest();
}

// ============================================================================
// Instruction builders
// ============================================================================

function buildUpsertDuelInstruction(params: {
  reporter: PublicKey;
  oracleConfig: PublicKey;
  duelState: PublicKey;
  programId: PublicKey;
  duelKeyBytes: Uint8Array;
  participantAHash: Uint8Array;
  participantBHash: Uint8Array;
  betOpenTs: bigint;
  betCloseTs: bigint;
  duelStartTs: bigint;
  metadataUri: string;
  status: number;
}): TransactionInstruction {
  const uriBytes = Buffer.from(params.metadataUri, "utf-8");
  // 8 (disc) + 32 (duelKey) + 32 (partA) + 32 (partB) + 8*3 (timestamps) + 4+len (uri) + 1 (status)
  const dataLen = 8 + 32 + 32 + 32 + 24 + 4 + uriBytes.length + 1;
  const data = Buffer.alloc(dataLen);

  let offset = 0;
  UPSERT_DUEL_DISCRIMINATOR.copy(data, offset);
  offset += 8;
  offset = writeBytes32(data, offset, params.duelKeyBytes);
  offset = writeBytes32(data, offset, params.participantAHash);
  offset = writeBytes32(data, offset, params.participantBHash);
  offset = writeI64(data, offset, params.betOpenTs);
  offset = writeI64(data, offset, params.betCloseTs);
  offset = writeI64(data, offset, params.duelStartTs);
  offset = writeBorshString(data, offset, params.metadataUri);
  writeU8(data, offset, params.status);

  return new TransactionInstruction({
    keys: [
      { pubkey: params.reporter, isSigner: true, isWritable: true },
      { pubkey: params.oracleConfig, isSigner: false, isWritable: false },
      { pubkey: params.duelState, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: params.programId,
    data,
  });
}

function buildReportResultInstruction(params: {
  reporter: PublicKey;
  oracleConfig: PublicKey;
  duelState: PublicKey;
  programId: PublicKey;
  duelKeyBytes: Uint8Array;
  winner: number;
  seed: bigint;
  replayHash: Uint8Array;
  resultHash: Uint8Array;
  duelEndTs: bigint;
  metadataUri: string;
}): TransactionInstruction {
  const uriBytes = Buffer.from(params.metadataUri, "utf-8");
  // 8 (disc) + 32 (duelKey) + 1 (winner) + 8 (seed) + 32 (replayHash) + 32 (resultHash) + 8 (duelEndTs) + 4+len (uri)
  const dataLen = 8 + 32 + 1 + 8 + 32 + 32 + 8 + 4 + uriBytes.length;
  const data = Buffer.alloc(dataLen);

  let offset = 0;
  REPORT_RESULT_DISCRIMINATOR.copy(data, offset);
  offset += 8;
  offset = writeBytes32(data, offset, params.duelKeyBytes);
  offset = writeU8(data, offset, params.winner);
  offset = writeU64(data, offset, params.seed);
  offset = writeBytes32(data, offset, params.replayHash);
  offset = writeBytes32(data, offset, params.resultHash);
  offset = writeI64(data, offset, params.duelEndTs);
  writeBorshString(data, offset, params.metadataUri);

  return new TransactionInstruction({
    keys: [
      { pubkey: params.reporter, isSigner: true, isWritable: true },
      { pubkey: params.oracleConfig, isSigner: false, isWritable: false },
      { pubkey: params.duelState, isSigner: false, isWritable: true },
    ],
    programId: params.programId,
    data,
  });
}

// ============================================================================
// SolanaArenaOperator
// ============================================================================

export class SolanaArenaOperator {
  private readonly connection: Connection | null;
  private readonly reporter: Keypair | null;
  private readonly programId: PublicKey;
  private readonly oracleConfigPda: PublicKey;
  private readonly _enabled: boolean;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const reporterKey = process.env.SOLANA_REPORTER_PRIVATE_KEY;
    const programIdStr =
      process.env.SOLANA_FIGHT_ORACLE_PROGRAM_ID || DEFAULT_PROGRAM_ID;

    if (!rpcUrl || !reporterKey) {
      this._enabled = false;
      this.connection = null;
      this.reporter = null;
      this.programId = new PublicKey(programIdStr);
      this.oracleConfigPda = PublicKey.default;
      Logger.info(
        "SolanaArenaOperator",
        "Disabled — missing SOLANA_RPC_URL or SOLANA_REPORTER_PRIVATE_KEY",
      );
      return;
    }

    this.connection = new Connection(rpcUrl, "confirmed");
    this.reporter = parseKeypair(reporterKey);
    this.programId = new PublicKey(programIdStr);
    [this.oracleConfigPda] = findOracleConfigPda(this.programId);
    this._enabled = true;

    Logger.info("SolanaArenaOperator", "Initialized", {
      rpcUrl: rpcUrl.replace(/\/\/.*@/, "//***@"), // redact credentials
      reporter: this.reporter.publicKey.toBase58(),
      programId: this.programId.toBase58(),
    });
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  private requireEnabledResources(): {
    connection: Connection;
    reporter: Keypair;
  } {
    if (!this._enabled || this.connection === null || this.reporter === null) {
      throw new Error("SolanaArenaOperator is disabled");
    }
    return {
      connection: this.connection,
      reporter: this.reporter,
    };
  }

  /**
   * Initialize a round on-chain by calling upsert_duel with BettingOpen status
   */
  async initRound(
    roundSeedHex: string,
    bettingClosesAtMs: number,
  ): Promise<{
    closeSlot: number;
    initOracleSignature: string | null;
    initMarketSignature: string | null;
  } | null> {
    if (!this._enabled) return null;

    try {
      const { connection, reporter } = this.requireEnabledResources();
      const duelKeyBytes = hexToBytes32(roundSeedHex);
      const [duelStatePda] = findDuelStatePda(duelKeyBytes, this.programId);

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const closeSec = BigInt(Math.floor(bettingClosesAtMs / 1000));

      // Use roundSeedHex to derive participant hashes for init
      // Actual participant hashes are updated by subsequent upsert calls from the bridge
      const participantAHash = hashParticipant(`${roundSeedHex}:A`);
      const participantBHash = hashParticipant(`${roundSeedHex}:B`);

      const metadataUri = `${process.env.DUEL_METADATA_BASE_URL || "https://hyperscape.game/api/duels"}/${roundSeedHex}`;

      const ix = buildUpsertDuelInstruction({
        reporter: reporter.publicKey,
        oracleConfig: this.oracleConfigPda,
        duelState: duelStatePda,
        programId: this.programId,
        duelKeyBytes,
        participantAHash,
        participantBHash,
        betOpenTs: nowSec,
        betCloseTs: closeSec,
        duelStartTs: closeSec,
        metadataUri,
        status: DUEL_STATUS.BettingOpen,
      });

      const sig = await this.sendAndConfirm([ix]);

      Logger.info("SolanaArenaOperator", "initRound succeeded", {
        roundSeedHex,
        signature: sig,
      });

      // Approximate close slot (assuming 400ms slot time)
      const slotsUntilClose = Math.ceil((bettingClosesAtMs - Date.now()) / 400);
      const currentSlot = await connection.getSlot();

      return {
        closeSlot: currentSlot + Math.max(slotsUntilClose, 1),
        initOracleSignature: sig,
        initMarketSignature: null,
      };
    } catch (error) {
      Logger.error(
        "SolanaArenaOperator",
        "initRound failed",
        error instanceof Error ? error : null,
        { roundSeedHex },
      );
      return null;
    }
  }

  /**
   * Lock the market by calling upsert_duel with Locked status
   */
  async lockMarket(roundSeedHex: string): Promise<string | null> {
    if (!this._enabled) return null;

    try {
      const { reporter } = this.requireEnabledResources();
      const duelKeyBytes = hexToBytes32(roundSeedHex);
      const [duelStatePda] = findDuelStatePda(duelKeyBytes, this.programId);

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const participantAHash = hashParticipant(`${roundSeedHex}:A`);
      const participantBHash = hashParticipant(`${roundSeedHex}:B`);
      const metadataUri = `${process.env.DUEL_METADATA_BASE_URL || "https://hyperscape.game/api/duels"}/${roundSeedHex}`;

      const ix = buildUpsertDuelInstruction({
        reporter: reporter.publicKey,
        oracleConfig: this.oracleConfigPda,
        duelState: duelStatePda,
        programId: this.programId,
        duelKeyBytes,
        participantAHash,
        participantBHash,
        betOpenTs: nowSec - 60n, // keep original open time approximate
        betCloseTs: nowSec,
        duelStartTs: nowSec,
        metadataUri,
        status: DUEL_STATUS.Locked,
      });

      const sig = await this.sendAndConfirm([ix]);

      Logger.info("SolanaArenaOperator", "lockMarket succeeded", {
        roundSeedHex,
        signature: sig,
      });

      return sig;
    } catch (error) {
      Logger.error(
        "SolanaArenaOperator",
        "lockMarket failed",
        error instanceof Error ? error : null,
        { roundSeedHex },
      );
      return null;
    }
  }

  /**
   * Report duel result and resolve the market on-chain
   */
  async reportAndResolve(params: {
    roundSeedHex: string;
    winnerSide: "A" | "B";
    resultHashHex: string;
    metadataUri: string;
  }): Promise<{
    reportSignature: string | null;
    resolveSignature: string | null;
  } | null> {
    if (!this._enabled) return null;

    try {
      const { reporter } = this.requireEnabledResources();
      const duelKeyBytes = hexToBytes32(params.roundSeedHex);
      const [duelStatePda] = findDuelStatePda(duelKeyBytes, this.programId);

      const winner = params.winnerSide === "A" ? MARKET_SIDE.A : MARKET_SIDE.B;

      const resultHashBytes = hexToBytes32(params.resultHashHex);
      const replayHash = createHash("sha256")
        .update(`replay:${params.roundSeedHex}`)
        .digest();

      // This is deterministic proof material derived from the round seed,
      // not fresh entropy. Reporter authorization on the Solana instruction
      // remains the security boundary; these values let the keeper
      // reconstruct the same report payload if it misses a live event.
      const seedBuf = createHash("sha256")
        .update(`seed:${params.roundSeedHex}`)
        .digest();
      const seed = seedBuf.readBigUInt64LE(0);

      const nowSec = BigInt(Math.floor(Date.now() / 1000));

      const ix = buildReportResultInstruction({
        reporter: reporter.publicKey,
        oracleConfig: this.oracleConfigPda,
        duelState: duelStatePda,
        programId: this.programId,
        duelKeyBytes,
        winner,
        seed,
        replayHash,
        resultHash: resultHashBytes,
        duelEndTs: nowSec,
        metadataUri: params.metadataUri,
      });

      const sig = await this.sendAndConfirm([ix]);

      Logger.info("SolanaArenaOperator", "reportAndResolve succeeded", {
        roundSeedHex: params.roundSeedHex,
        winnerSide: params.winnerSide,
        signature: sig,
      });

      return {
        reportSignature: sig,
        resolveSignature: sig,
      };
    } catch (error) {
      Logger.error(
        "SolanaArenaOperator",
        "reportAndResolve failed",
        error instanceof Error ? error : null,
        { roundSeedHex: params.roundSeedHex },
      );
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Transaction helpers
  // --------------------------------------------------------------------------

  private async sendAndConfirm(
    instructions: TransactionInstruction[],
  ): Promise<string> {
    const { connection, reporter } = this.requireEnabledResources();
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const message = new TransactionMessage({
      payerKey: reporter.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([reporter]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // confirmTransaction can block indefinitely on RPC stalls or a partitioned
    // network. Cap with an explicit timeout so the caller surfaces a clean
    // error instead of a stuck transaction that ties up the reporter wallet.
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed",
        ),
        new Promise<never>((_, reject) => {
          confirmTimer = setTimeout(
            () =>
              reject(
                new Error(
                  `confirmTransaction timed out after ${TX_CONFIRM_TIMEOUT_MS}ms (signature=${sig})`,
                ),
              ),
            TX_CONFIRM_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (confirmTimer !== null) clearTimeout(confirmTimer);
    }

    return sig;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function parseKeypair(raw: string): Keypair {
  const assertSecretKeyLength = (bytes: Uint8Array): Uint8Array => {
    if (bytes.length !== 64) {
      throw new Error(
        `Reporter private key must decode to 64 bytes; received ${bytes.length}`,
      );
    }
    return bytes;
  };

  const trimmed = raw.trim();
  if (trimmed.length > 1024) {
    throw new Error("Reporter private key input is unexpectedly large");
  }

  // JSON byte array: [1,2,3,...]
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Reporter private key JSON is malformed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error("Reporter private key JSON must be a number array");
    }
    // Uint8Array.from silently coerces out-of-range or non-integer values
    // (e.g. 256 → 0, -1 → 255, "1" → 1). Validate each byte explicitly so a
    // corrupted key fails loud instead of producing an attacker-controlled
    // reporter identity.
    for (const byte of parsed) {
      if (
        typeof byte !== "number" ||
        !Number.isInteger(byte) ||
        byte < 0 ||
        byte > 255
      ) {
        throw new Error(
          "Reporter private key JSON must contain only integers in [0, 255]",
        );
      }
    }
    return Keypair.fromSecretKey(
      assertSecretKeyLength(Uint8Array.from(parsed as number[])),
    );
  }

  return Keypair.fromSecretKey(assertSecretKeyLength(bs58.decode(trimmed)));
}

/** @internal Pure helpers exposed for byte-layout regression tests. */
export const __solanaArenaOperatorTestInternals = {
  DUEL_STATUS,
  MARKET_SIDE,
  REPORT_RESULT_DISCRIMINATOR,
  UPSERT_DUEL_DISCRIMINATOR,
  buildReportResultInstruction,
  buildUpsertDuelInstruction,
  hashParticipant,
  hexToBytes32,
  parseKeypair,
};
