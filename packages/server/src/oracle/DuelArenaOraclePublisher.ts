import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { World } from "@hyperforge/shared";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Hex,
} from "viem";
import {
  foundry,
  avalanche,
  avalancheFuji,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
} from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { Logger } from "../systems/ServerNetwork/services/index.js";
import { DUEL_OUTCOME_ORACLE_ABI } from "./duelOutcomeOracleAbi.js";
import type {
  DuelArenaOracleAbortEvent,
  DuelArenaOracleAnnouncementEvent,
  DuelArenaOracleChainKey,
  DuelArenaOracleChainState,
  DuelArenaOracleConfig,
  DuelArenaOracleEvmTargetConfig,
  DuelArenaOracleFightStartEvent,
  DuelArenaOracleParticipant,
  DuelArenaOracleRecord,
  DuelArenaOracleResolutionEvent,
  DuelArenaOracleSolanaTargetConfig,
  DuelArenaOracleStatus,
  DuelArenaOracleStoreFile,
  DuelArenaOracleWinnerSide,
} from "./types.js";

const ORACLE_CONFIG_SEED = Buffer.from("oracle_config", "utf8");
const DUEL_SEED = Buffer.from("duel", "utf8");
const SOLANA_STATUS_TO_VARIANT: Record<DuelArenaOracleStatus, number> = {
  BETTING_OPEN: 1,
  LOCKED: 2,
  RESOLVED: 3,
  CANCELLED: 4,
};
const EVM_STATUS_TO_VARIANT: Record<DuelArenaOracleStatus, number> = {
  BETTING_OPEN: 2,
  LOCKED: 3,
  RESOLVED: 4,
  CANCELLED: 5,
};
const WINNER_SIDE_TO_VARIANT: Record<DuelArenaOracleWinnerSide, number> = {
  A: 1,
  B: 2,
};
const EVM_CHAIN_MAP: Record<DuelArenaOracleEvmTargetConfig["key"], Chain> = {
  anvil: foundry,
  baseSepolia,
  bscTestnet,
  avaxFuji: avalancheFuji,
  base,
  bsc,
  avax: avalanche,
};

function nowIso(): string {
  return new Date().toISOString();
}

function prefixedHex(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

function hashParticipant(participantId: string): string {
  return crypto
    .createHash("sha256")
    .update(`hyperia:duel-arena:participant:${participantId}`)
    .digest("hex");
}

function buildMetadataUri(baseUrl: string, duelId: string): string {
  return `${baseUrl}/duels/${encodeURIComponent(duelId)}`;
}

function buildResultHash(record: DuelArenaOracleRecord): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        duelId: record.duelId,
        cycleId: record.cycleId,
        duelKeyHex: record.duelKeyHex,
        winnerId: record.winnerId,
        loserId: record.loserId,
        winReason: record.winReason,
        seed: record.seed,
        replayHashHex: record.replayHashHex,
        duelEndTime: record.duelEndTime,
      }),
    )
    .digest("hex");
}

function resolveOracleDuelStartTime(record: DuelArenaOracleRecord): number {
  return Math.max(
    record.fightStartTime ?? record.betCloseTime,
    record.betCloseTime,
  );
}

function encodeString(value: string): Buffer {
  const data = Buffer.from(value, "utf8");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32LE(data.length, 0);
  return Buffer.concat([length, data]);
}

function encodeI64(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(8);
  buffer.writeBigInt64LE(BigInt(Math.trunc(value)), 0);
  return buffer;
}

function encodeU64(value: bigint): Buffer {
  const buffer = Buffer.allocUnsafe(8);
  buffer.writeBigUInt64LE(value, 0);
  return buffer;
}

function ixDiscriminator(name: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

function parseSolanaSignerSecret(raw: string | null): Keypair | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (
      trimmed.endsWith(".json") ||
      trimmed.startsWith("~/") ||
      trimmed.startsWith("./") ||
      trimmed.startsWith("../") ||
      trimmed.startsWith("/")
    ) {
      const resolvedPath = trimmed.startsWith("~/")
        ? path.resolve(process.env.HOME || "", trimmed.slice(2))
        : path.resolve(trimmed);
      trimmed = awaitReadJsonSecret(resolvedPath);
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const parsed = JSON.parse(trimmed) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    }

    if (trimmed.includes(",")) {
      const values = trimmed.split(",").map((part) => Number(part.trim()));
      return Keypair.fromSecretKey(Uint8Array.from(values));
    }

    const base64Raw = trimmed.startsWith("base64:")
      ? trimmed.slice("base64:".length).trim()
      : trimmed;
    const decoded = Buffer.from(base64Raw, "base64");
    if (decoded.length === 64) {
      return Keypair.fromSecretKey(Uint8Array.from(decoded));
    }
  } catch (error) {
    Logger.warn(
      "DuelArenaOraclePublisher",
      `Failed to parse Solana signer secret: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return null;
}

function awaitReadJsonSecret(filePath: string): string {
  return readFileSync(filePath, "utf8").trim();
}

class EvmOracleTarget {
  public readonly key: DuelArenaOracleChainKey;
  public readonly label: string;
  private readonly contractAddress: `0x${string}`;
  private readonly publicClient;
  private readonly walletClient;
  private readonly account;

  public constructor(config: DuelArenaOracleEvmTargetConfig) {
    this.key = config.key;
    this.label = config.label;
    this.contractAddress = config.contractAddress;
    const chain = EVM_CHAIN_MAP[config.key];
    this.account = privateKeyToAccount(config.privateKey);
    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });
    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(config.rpcUrl),
    });
  }

  public async publishAnnouncement(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    return this.upsertRecord(record, "BETTING_OPEN");
  }

  public async publishFightStart(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    return this.upsertRecord(record, "LOCKED");
  }

  public async publishCancellation(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    await this.upsertRecord(
      record,
      record.fightStartTime ? "LOCKED" : "BETTING_OPEN",
    );
    const hash = await this.walletClient.writeContract({
      account: this.account,
      address: this.contractAddress,
      abi: DUEL_OUTCOME_ORACLE_ABI,
      functionName: "cancelDuel",
      args: [prefixedHex(record.duelKeyHex), record.metadataUri],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  public async publishResolution(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    await this.upsertRecord(record, "LOCKED");
    if (!record.winnerSide || !record.seed || !record.replayHashHex) {
      throw new Error("Resolved duel is missing winner/seed/replayHash data");
    }
    const hash = await this.walletClient.writeContract({
      account: this.account,
      address: this.contractAddress,
      abi: DUEL_OUTCOME_ORACLE_ABI,
      functionName: "reportResult",
      args: [
        prefixedHex(record.duelKeyHex),
        WINNER_SIDE_TO_VARIANT[record.winnerSide],
        BigInt(record.seed),
        prefixedHex(record.replayHashHex),
        prefixedHex(record.resultHashHex || buildResultHash(record)),
        BigInt(record.duelEndTime || Date.now()),
        record.metadataUri,
      ],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  private async upsertRecord(
    record: DuelArenaOracleRecord,
    status: Extract<DuelArenaOracleStatus, "BETTING_OPEN" | "LOCKED">,
  ): Promise<string> {
    const hash = await this.walletClient.writeContract({
      account: this.account,
      address: this.contractAddress,
      abi: DUEL_OUTCOME_ORACLE_ABI,
      functionName: "upsertDuel",
      args: [
        prefixedHex(record.duelKeyHex),
        prefixedHex(record.participantA.hashHex),
        prefixedHex(record.participantB.hashHex),
        BigInt(record.betOpenTime),
        BigInt(record.betCloseTime),
        BigInt(resolveOracleDuelStartTime(record)),
        record.metadataUri,
        EVM_STATUS_TO_VARIANT[status],
      ],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}

class SolanaOracleTarget {
  public readonly key: DuelArenaOracleChainKey;
  public readonly label: string;
  private readonly programId: PublicKey;
  private readonly connection: Connection;
  private readonly authority: Keypair | null;
  private readonly reporter: Keypair | null;
  private configReady: Promise<void> | null = null;

  public constructor(config: DuelArenaOracleSolanaTargetConfig) {
    this.key = config.key;
    this.label = config.label;
    this.programId = new PublicKey(config.programId);
    this.connection = new Connection(config.rpcUrl, {
      wsEndpoint: config.wsUrl,
      commitment: "confirmed",
    });
    this.authority = parseSolanaSignerSecret(config.authoritySecret);
    this.reporter =
      parseSolanaSignerSecret(config.reporterSecret) ?? this.authority;
  }

  public async publishAnnouncement(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    await this.ensureOracleConfig();
    return this.upsertRecord(record, "BETTING_OPEN");
  }

  public async publishFightStart(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    await this.ensureOracleConfig();
    return this.upsertRecord(record, "LOCKED");
  }

  public async publishCancellation(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    await this.ensureOracleConfig();
    await this.upsertRecord(
      record,
      record.fightStartTime ? "LOCKED" : "BETTING_OPEN",
    );
    const reporter = this.requireReporter();
    const duelKey = Buffer.from(record.duelKeyHex, "hex");
    const oracleConfigPda = this.findOracleConfigPda();
    const duelStatePda = this.findDuelStatePda(duelKey);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: reporter.publicKey, isSigner: true, isWritable: true },
        { pubkey: oracleConfigPda, isSigner: false, isWritable: false },
        { pubkey: duelStatePda, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([
        ixDiscriminator("cancel_duel"),
        duelKey,
        encodeString(record.metadataUri),
      ]),
    });
    return this.sendWithSigner(ix, reporter);
  }

  public async publishResolution(
    record: DuelArenaOracleRecord,
  ): Promise<string> {
    await this.ensureOracleConfig();
    await this.upsertRecord(record, "LOCKED");
    if (!record.winnerSide || !record.seed || !record.replayHashHex) {
      throw new Error("Resolved duel is missing winner/seed/replayHash data");
    }
    const reporter = this.requireReporter();
    const duelKey = Buffer.from(record.duelKeyHex, "hex");
    const oracleConfigPda = this.findOracleConfigPda();
    const duelStatePda = this.findDuelStatePda(duelKey);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: reporter.publicKey, isSigner: true, isWritable: true },
        { pubkey: oracleConfigPda, isSigner: false, isWritable: false },
        { pubkey: duelStatePda, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([
        ixDiscriminator("report_result"),
        duelKey,
        Buffer.from([WINNER_SIDE_TO_VARIANT[record.winnerSide]]),
        encodeU64(BigInt(record.seed)),
        Buffer.from(record.replayHashHex, "hex"),
        Buffer.from(record.resultHashHex || buildResultHash(record), "hex"),
        encodeI64(record.duelEndTime || Date.now()),
        encodeString(record.metadataUri),
      ]),
    });
    return this.sendWithSigner(ix, reporter);
  }

  private async ensureOracleConfig(): Promise<void> {
    if (this.configReady) {
      return this.configReady;
    }

    this.configReady = (async () => {
      const oracleConfigPda = this.findOracleConfigPda();
      const existing = await this.connection.getAccountInfo(oracleConfigPda);
      if (existing) {
        return;
      }

      const authority = this.authority;
      const reporter = this.reporter ?? authority;
      if (!authority || !reporter) {
        throw new Error(
          `${this.label}: missing authority/reporter signer for oracle config initialization`,
        );
      }

      const programDataAddress = PublicKey.findProgramAddressSync(
        [this.programId.toBuffer()],
        new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
      )[0];

      const ix = new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: authority.publicKey, isSigner: true, isWritable: true },
          { pubkey: oracleConfigPda, isSigner: false, isWritable: true },
          { pubkey: this.programId, isSigner: false, isWritable: false },
          { pubkey: programDataAddress, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: Buffer.concat([
          ixDiscriminator("initialize_oracle"),
          reporter.publicKey.toBuffer(),
        ]),
      });

      await this.sendWithSigner(ix, authority);
    })();

    try {
      await this.configReady;
    } catch (error) {
      this.configReady = null;
      throw error;
    }
  }

  private async upsertRecord(
    record: DuelArenaOracleRecord,
    status: Extract<DuelArenaOracleStatus, "BETTING_OPEN" | "LOCKED">,
  ): Promise<string> {
    const reporter = this.requireReporter();
    const duelKey = Buffer.from(record.duelKeyHex, "hex");
    const oracleConfigPda = this.findOracleConfigPda();
    const duelStatePda = this.findDuelStatePda(duelKey);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: reporter.publicKey, isSigner: true, isWritable: true },
        { pubkey: oracleConfigPda, isSigner: false, isWritable: false },
        { pubkey: duelStatePda, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: Buffer.concat([
        ixDiscriminator("upsert_duel"),
        duelKey,
        Buffer.from(record.participantA.hashHex, "hex"),
        Buffer.from(record.participantB.hashHex, "hex"),
        encodeI64(record.betOpenTime),
        encodeI64(record.betCloseTime),
        encodeI64(resolveOracleDuelStartTime(record)),
        encodeString(record.metadataUri),
        Buffer.from([SOLANA_STATUS_TO_VARIANT[status]]),
      ]),
    });
    return this.sendWithSigner(ix, reporter);
  }

  private findOracleConfigPda(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [ORACLE_CONFIG_SEED],
      this.programId,
    )[0];
  }

  private findDuelStatePda(duelKey: Buffer): PublicKey {
    return PublicKey.findProgramAddressSync(
      [DUEL_SEED, duelKey],
      this.programId,
    )[0];
  }

  private requireReporter(): Keypair {
    if (!this.reporter) {
      throw new Error(`${this.label}: reporter signer is not configured`);
    }
    return this.reporter;
  }

  private async sendWithSigner(
    instruction: TransactionInstruction,
    signer: Keypair,
  ): Promise<string> {
    const latestBlockhash =
      await this.connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      feePayer: signer.publicKey,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }).add(instruction);

    transaction.sign(signer);
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      {
        preflightCommitment: "confirmed",
      },
    );
    await this.connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed",
    );
    return signature;
  }
}

type OracleWorld = World & {
  duelArenaOraclePublisher?: DuelArenaOraclePublisher;
};

export class DuelArenaOraclePublisher {
  private readonly records = new Map<string, DuelArenaOracleRecord>();
  private readonly listeners: Array<{
    event: string;
    handler: (payload: unknown) => void;
  }> = [];
  private readonly evmTargets: EvmOracleTarget[];
  private readonly solanaTargets: SolanaOracleTarget[];
  private persistQueue: Promise<void> = Promise.resolve();

  public constructor(
    private readonly world: World,
    private readonly config: DuelArenaOracleConfig,
  ) {
    this.evmTargets = config.evmTargets.map(
      (target) => new EvmOracleTarget(target),
    );
    this.solanaTargets = config.solanaTargets.map(
      (target) => new SolanaOracleTarget(target),
    );
  }

  public async init(): Promise<void> {
    await this.loadPersistedRecords();
    this.attach();
    (this.world as OracleWorld).duelArenaOraclePublisher = this;
    Logger.info("DuelArenaOraclePublisher", "Initialized duel arena oracle", {
      profile: this.config.profile,
      evmTargets: this.evmTargets.length,
      solanaTargets: this.solanaTargets.length,
      metadataBaseUrl: this.config.metadataBaseUrl,
      storePath: this.config.storePath,
    });
  }

  public destroy(): void {
    for (const { event, handler } of this.listeners) {
      this.world.off(event, handler);
    }
    this.listeners.length = 0;
  }

  public getRecord(duelId: string): DuelArenaOracleRecord | null {
    return this.records.get(duelId) ?? null;
  }

  public getRecentRecords(limit: number = 50): DuelArenaOracleRecord[] {
    return Array.from(this.records.values())
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(1, limit));
  }

  private attach(): void {
    this.on("streaming:announcement:start", (payload) => {
      void this.handleAnnouncement(payload);
    });
    this.on("streaming:fight:start", (payload) => {
      void this.handleFightStart(payload);
    });
    this.on("streaming:resolution:start", (payload) => {
      void this.handleResolution(payload);
    });
    this.on("streaming:cycle:aborted", (payload) => {
      void this.handleAbort(payload);
    });
  }

  private on(event: string, handler: (payload: unknown) => void): void {
    this.listeners.push({ event, handler });
    this.world.on(event, handler);
  }

  private async handleAnnouncement(payload: unknown): Promise<void> {
    const event = payload as DuelArenaOracleAnnouncementEvent;
    if (
      !event?.duelId ||
      !event.cycleId ||
      !event.duelKeyHex ||
      !event.agent1?.id ||
      !event.agent2?.id
    ) {
      return;
    }

    const participantA: DuelArenaOracleParticipant = {
      id: event.agent1.id,
      name: event.agent1.name,
      hashHex: hashParticipant(event.agent1.id),
    };
    const participantB: DuelArenaOracleParticipant = {
      id: event.agent2.id,
      name: event.agent2.name,
      hashHex: hashParticipant(event.agent2.id),
    };
    const existing = this.records.get(event.duelId);
    const createdAt = existing?.createdAt ?? nowIso();
    const updatedAt = nowIso();
    const record: DuelArenaOracleRecord = {
      duelId: event.duelId,
      cycleId: event.cycleId,
      duelKeyHex: event.duelKeyHex,
      status: "BETTING_OPEN",
      metadataUri: buildMetadataUri(this.config.metadataBaseUrl, event.duelId),
      participantA,
      participantB,
      betOpenTime: event.betOpenTime,
      betCloseTime: event.betCloseTime,
      fightStartTime: existing?.fightStartTime ?? null,
      duelEndTime: existing?.duelEndTime ?? null,
      winnerId: existing?.winnerId ?? null,
      loserId: existing?.loserId ?? null,
      winnerSide: existing?.winnerSide ?? null,
      winnerName: existing?.winnerName ?? null,
      loserName: existing?.loserName ?? null,
      winReason: existing?.winReason ?? null,
      seed: existing?.seed ?? null,
      replayHashHex: existing?.replayHashHex ?? null,
      resultHashHex: existing?.resultHashHex ?? null,
      chainState: existing?.chainState ?? {},
      createdAt,
      updatedAt,
    };
    this.records.set(record.duelId, record);
    await this.persistRecords();
    await this.publishAcrossTargets(record, "UPSERT");
  }

  private async handleFightStart(payload: unknown): Promise<void> {
    const event = payload as DuelArenaOracleFightStartEvent;
    if (!event?.duelId) {
      return;
    }

    const existing = this.records.get(event.duelId);
    if (!existing) {
      return;
    }

    existing.status = "LOCKED";
    existing.betCloseTime = Math.min(existing.betCloseTime, event.betCloseTime);
    existing.fightStartTime = event.fightStartTime;
    existing.updatedAt = nowIso();
    this.records.set(existing.duelId, existing);
    await this.persistRecords();
    await this.publishAcrossTargets(existing, "UPSERT");
  }

  private async handleResolution(payload: unknown): Promise<void> {
    const event = payload as DuelArenaOracleResolutionEvent;
    if (!event?.duelId || !event.winnerId || !event.loserId) {
      return;
    }

    const existing = this.records.get(event.duelId);
    if (!existing) {
      return;
    }

    existing.status = "RESOLVED";
    existing.duelEndTime = event.duelEndTime;
    existing.winnerId = event.winnerId;
    existing.loserId = event.loserId;
    existing.winnerName = event.winnerName;
    existing.loserName = event.loserName;
    existing.winReason = event.winReason;
    existing.seed = event.seed;
    existing.replayHashHex = event.replayHash;
    existing.winnerSide =
      existing.participantA.id === event.winnerId
        ? "A"
        : existing.participantB.id === event.winnerId
          ? "B"
          : null;
    existing.resultHashHex = buildResultHash(existing);
    existing.updatedAt = nowIso();
    this.records.set(existing.duelId, existing);
    await this.persistRecords();

    if (this.config.settlementDelayMs > 0) {
      Logger.info(
        "DuelArenaOraclePublisher",
        `Delaying oracle publish for ${existing.duelId} by ${this.config.settlementDelayMs}ms to sync with stream`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.settlementDelayMs),
      );
    }

    await this.publishAcrossTargets(existing, "RESOLVE");
  }

  private async handleAbort(payload: unknown): Promise<void> {
    const event = payload as DuelArenaOracleAbortEvent;
    if (!event?.duelId) {
      return;
    }

    const existing = this.records.get(event.duelId);
    if (!existing) {
      return;
    }

    existing.status = "CANCELLED";
    existing.updatedAt = nowIso();
    this.records.set(existing.duelId, existing);
    await this.persistRecords();
    await this.publishAcrossTargets(existing, "CANCEL");
  }

  private async publishAcrossTargets(
    record: DuelArenaOracleRecord,
    action: "UPSERT" | "RESOLVE" | "CANCEL",
  ): Promise<void> {
    for (const target of this.evmTargets) {
      await this.publishToTarget(record, target, action);
    }
    for (const target of this.solanaTargets) {
      await this.publishToTarget(record, target, action);
    }
  }

  private async publishToTarget(
    record: DuelArenaOracleRecord,
    target: EvmOracleTarget | SolanaOracleTarget,
    action: "UPSERT" | "RESOLVE" | "CANCEL",
  ): Promise<void> {
    try {
      let txHash: string;
      if (action === "UPSERT") {
        txHash =
          record.status === "LOCKED"
            ? await target.publishFightStart(record)
            : await target.publishAnnouncement(record);
      } else if (action === "RESOLVE") {
        txHash = await target.publishResolution(record);
      } else {
        txHash = await target.publishCancellation(record);
      }
      this.updateChainState(record.duelId, target.key, {
        target: target.key,
        kind: target instanceof EvmOracleTarget ? "evm" : "solana",
        label: target.label,
        lastAction: action,
        lastTxHash: txHash,
        lastError: null,
        updatedAt: nowIso(),
      });
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (error && typeof error === "object" && "logs" in error) {
        const logs = (error as any).logs;
        if (Array.isArray(logs)) {
          errorMessage = errorMessage
            .replace(
              /Catch the `SendTransactionError` and call `getLogs\(\)` on it for full details\./g,
              "",
            )
            .trim();

          const logsStr = logs.join("\n  ");
          errorMessage = `${errorMessage}\nTransaction Logs:\n  ${logsStr}`;

          if (logsStr.includes("insufficient lamports")) {
            errorMessage = `Insufficient SOL to pay for transaction rent or fees.\n${errorMessage}`;
          }
        }
      }

      this.updateChainState(record.duelId, target.key, {
        target: target.key,
        kind: target instanceof EvmOracleTarget ? "evm" : "solana",
        label: target.label,
        lastAction: action,
        lastTxHash: null,
        lastError: errorMessage,
        updatedAt: nowIso(),
      });
      Logger.warn(
        "DuelArenaOraclePublisher",
        `Failed oracle publish on ${target.label} (${action}) for ${record.duelId}: ${errorMessage}`,
      );
    }
  }

  private updateChainState(
    duelId: string,
    targetKey: DuelArenaOracleChainKey,
    nextState: DuelArenaOracleChainState,
  ): void {
    const record = this.records.get(duelId);
    if (!record) return;
    record.chainState[targetKey] = nextState;
    record.updatedAt = nowIso();
    this.records.set(duelId, record);
    void this.persistRecords();
  }

  private async loadPersistedRecords(): Promise<void> {
    try {
      const raw = await fs.readFile(this.config.storePath, "utf8");
      const parsed = JSON.parse(raw) as DuelArenaOracleStoreFile;
      for (const record of parsed.records || []) {
        this.records.set(record.duelId, record);
      }
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: string }).code === "string"
          ? (error as { code: string }).code
          : null;
      if (code !== "ENOENT") {
        Logger.warn(
          "DuelArenaOraclePublisher",
          `Failed to load persisted oracle records: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async persistRecords(): Promise<void> {
    const snapshot: DuelArenaOracleStoreFile = {
      updatedAt: nowIso(),
      records: Array.from(this.records.values()).sort((left, right) =>
        left.duelId.localeCompare(right.duelId),
      ),
    };

    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(async () => {
        const directory = path.dirname(this.config.storePath);
        await fs.mkdir(directory, { recursive: true });
        const tempPath = `${this.config.storePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2) + "\n");
        await fs.rename(tempPath, this.config.storePath);
      });

    await this.persistQueue;
  }
}

export function getDuelArenaOraclePublisher(
  world: World,
): DuelArenaOraclePublisher | null {
  return (world as OracleWorld).duelArenaOraclePublisher ?? null;
}
