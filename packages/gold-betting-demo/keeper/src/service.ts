/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createPublicClient, http, type Address } from "viem";

import { createPrograms, findMarketPda, readKeypair } from "./common";

type StreamState = {
  type: "STREAMING_STATE_UPDATE";
  cycle: Record<string, any>;
  leaderboard: any[];
  cameraTarget: string | null;
  seq: number;
  emittedAt: number;
};

type BetRecord = {
  id: string;
  bettorWallet: string;
  chain: "SOLANA" | "BSC" | "BASE";
  sourceAsset: string;
  sourceAmount: number;
  goldAmount: number;
  feeBps: number;
  txSignature: string;
  marketPda: string | null;
  inviteCode: string | null;
  externalBetRef: string | null;
  recordedAt: number;
};

type WalletPoints = {
  selfPoints: number;
  winPoints: number;
  referralPoints: number;
  stakingPoints: number;
};

type ParserState = {
  enabled: boolean;
  lastSuccessAt: number | null;
  lastError: string | null;
  snapshot: Record<string, any> | null;
};

type RateBucket = {
  tokens: number;
  lastRefillMs: number;
};

const encoder = new TextEncoder();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keeperRoot = path.resolve(__dirname, "..");

const PORT = Number(process.env.PORT || 8080);
const ARENA_WRITE_KEY = process.env.ARENA_EXTERNAL_BET_WRITE_KEY?.trim() || "";
const STREAM_PUBLISH_KEY =
  process.env.STREAM_PUBLISH_KEY?.trim() || ARENA_WRITE_KEY;
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY?.trim() || "";
const BIRDEYE_API_BASE =
  process.env.BIRDEYE_API_BASE?.trim() || "https://public-api.birdeye.so";
const ITEM_MANIFEST_BASE_URL =
  process.env.ITEM_MANIFEST_BASE_URL?.trim() ||
  "https://assets.hyperscape.club/manifests/items";
const STREAM_STATE_SOURCE_URL =
  process.env.STREAM_STATE_SOURCE_URL?.trim() || "";
const STREAM_STATE_SOURCE_BEARER_TOKEN =
  process.env.STREAM_STATE_SOURCE_BEARER_TOKEN?.trim() || "";
const STREAM_STATE_POLL_MS = Math.max(
  1_000,
  Number(process.env.STREAM_STATE_POLL_MS || 2_000),
);
const STREAM_STATE_SOURCE_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.STREAM_STATE_SOURCE_TIMEOUT_MS || 3_000),
);
const STREAM_STATE_SOURCE_MAX_BACKOFF_MS = Math.max(
  STREAM_STATE_POLL_MS,
  Number(process.env.STREAM_STATE_SOURCE_MAX_BACKOFF_MS || 30_000),
);
const CONTRACT_POLL_MS = Math.max(
  5_000,
  Number(process.env.CONTRACT_POLL_MS || 15_000),
);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ENABLE_KEEPER_BOT = process.env.ENABLE_KEEPER_BOT !== "false";
const BET_STORE_LIMIT = Math.max(
  100,
  Number(process.env.BET_STORE_LIMIT || 5000),
);
const SOLANA_RPC_PROXY_URL = process.env.SOLANA_RPC_URL?.trim() || "";
const SOLANA_RPC_PROXY_MAX_BODY_BYTES = Math.max(
  1024,
  Number(process.env.SOLANA_RPC_PROXY_MAX_BODY_BYTES || 1_000_000),
);

const GOLD_CLOB_READ_ABI = [
  {
    type: "function",
    name: "nextMatchId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "matches",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { type: "uint8" },
      { type: "uint8" },
      { type: "uint256" },
      { type: "uint256" },
    ],
  },
] as const;

const defaultAgentA = {
  id: "agent-a",
  name: "Agent A",
  hp: 10,
  maxHp: 10,
};
const defaultAgentB = {
  id: "agent-b",
  name: "Agent B",
  hp: 10,
  maxHp: 10,
};

let streamSeq = 1;
let streamState: StreamState = {
  type: "STREAMING_STATE_UPDATE",
  cycle: {
    cycleId: "boot-cycle",
    phase: "BETTING",
    countdown: 15,
    timeRemaining: 300,
    winnerId: null,
    winnerName: null,
    winReason: null,
    agent1: defaultAgentA,
    agent2: defaultAgentB,
  },
  leaderboard: [
    { id: defaultAgentA.id, name: defaultAgentA.name, wins: 0, losses: 0 },
    { id: defaultAgentB.id, name: defaultAgentB.name, wins: 0, losses: 0 },
  ],
  cameraTarget: null,
  seq: streamSeq,
  emittedAt: Date.now(),
};
let streamLastUpdatedAt = Date.now();
let streamLastSourcePollAt: number | null = null;
let streamLastSourceError: string | null = null;
let streamSourcePollInFlight = false;
let streamSourceConsecutiveFailures = 0;
let streamSourceBackoffUntil = 0;

const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const bets: BetRecord[] = [];
const manifestCache = new Map<string, unknown>();

const walletDisplay = new Map<string, string>();
const pointsByWallet = new Map<string, WalletPoints>();
const canonicalByWallet = new Map<string, string>();
const identityMembers = new Map<string, Set<string>>();
const inviteCodeByWallet = new Map<string, string>();
const walletByInviteCode = new Map<string, string>();
const referredByWallet = new Map<string, { wallet: string; code: string }>();
const invitedWalletsByWallet = new Map<string, Set<string>>();
const referralFeeShareGoldByWallet = new Map<string, number>();
const treasuryFeesFromReferralsByWallet = new Map<string, number>();

const rateBuckets = new Map<string, RateBucket>();

const parsers: {
  solana: ParserState;
  bsc: ParserState;
  base: ParserState;
} = {
  solana: {
    enabled: false,
    lastSuccessAt: null,
    lastError: null,
    snapshot: null,
  },
  bsc: { enabled: false, lastSuccessAt: null, lastError: null, snapshot: null },
  base: {
    enabled: false,
    lastSuccessAt: null,
    lastError: null,
    snapshot: null,
  },
};

const bscRpcUrl = (
  process.env.BSC_RPC_URL ||
  process.env.BSC_TESTNET_RPC ||
  ""
).trim();
const bscContractAddress = (
  process.env.BSC_GOLD_CLOB_ADDRESS ||
  process.env.CLOB_CONTRACT_ADDRESS_BSC ||
  ""
).trim();
const baseRpcUrl = (
  process.env.BASE_RPC_URL ||
  process.env.BASE_SEPOLIA_RPC ||
  ""
).trim();
const baseContractAddress = (
  process.env.BASE_GOLD_CLOB_ADDRESS ||
  process.env.CLOB_CONTRACT_ADDRESS_BASE ||
  ""
).trim();

const bscClient =
  bscRpcUrl && bscContractAddress
    ? createPublicClient({ transport: http(bscRpcUrl) })
    : null;
const baseClient =
  baseRpcUrl && baseContractAddress
    ? createPublicClient({ transport: http(baseRpcUrl) })
    : null;

parsers.bsc.enabled = Boolean(bscClient);
parsers.base.enabled = Boolean(baseClient);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

function rememberWalletCase(wallet: string): string {
  const normalized = normalizeWallet(wallet);
  if (!walletDisplay.has(normalized)) {
    walletDisplay.set(normalized, wallet.trim());
  }
  return normalized;
}

function displayWallet(normalizedWallet: string): string {
  return walletDisplay.get(normalizedWallet) ?? normalizedWallet;
}

function ensureWalletPoints(wallet: string): WalletPoints {
  const normalized = rememberWalletCase(wallet);
  if (!pointsByWallet.has(normalized)) {
    pointsByWallet.set(normalized, {
      selfPoints: 0,
      winPoints: 0,
      referralPoints: 0,
      stakingPoints: 0,
    });
  }
  return pointsByWallet.get(normalized)!;
}

function ensureIdentity(wallet: string): string {
  const normalized = rememberWalletCase(wallet);
  const existingCanonical = canonicalByWallet.get(normalized);
  if (existingCanonical) return existingCanonical;
  canonicalByWallet.set(normalized, normalized);
  identityMembers.set(normalized, new Set([normalized]));
  return normalized;
}

function mergeIdentity(walletA: string, walletB: string): boolean {
  const canonicalA = ensureIdentity(walletA);
  const canonicalB = ensureIdentity(walletB);
  if (canonicalA === canonicalB) {
    return false;
  }

  const membersA = identityMembers.get(canonicalA) ?? new Set([canonicalA]);
  const membersB = identityMembers.get(canonicalB) ?? new Set([canonicalB]);
  const mergedCanonical =
    membersA.size >= membersB.size ? canonicalA : canonicalB;
  const mergedMembers = new Set<string>([...membersA, ...membersB]);

  for (const member of mergedMembers) {
    canonicalByWallet.set(member, mergedCanonical);
  }

  identityMembers.set(mergedCanonical, mergedMembers);
  identityMembers.delete(
    canonicalA === mergedCanonical ? canonicalB : canonicalA,
  );
  return true;
}

function identityWallets(wallet: string, scope: string | null): string[] {
  const normalized = rememberWalletCase(wallet);
  const canonical = ensureIdentity(normalized);
  if (scope?.toLowerCase() !== "linked") {
    return [normalized];
  }
  const members = identityMembers.get(canonical);
  return members ? [...members] : [normalized];
}

function totalPoints(points: WalletPoints): number {
  return (
    points.selfPoints +
    points.winPoints +
    points.referralPoints +
    points.stakingPoints
  );
}

function aggregatePoints(wallets: string[]): WalletPoints {
  return wallets.reduce<WalletPoints>(
    (acc, wallet) => {
      const points = ensureWalletPoints(wallet);
      acc.selfPoints += points.selfPoints;
      acc.winPoints += points.winPoints;
      acc.referralPoints += points.referralPoints;
      acc.stakingPoints += points.stakingPoints;
      return acc;
    },
    { selfPoints: 0, winPoints: 0, referralPoints: 0, stakingPoints: 0 },
  );
}

function inviteCodeForWallet(wallet: string): string {
  const normalized = rememberWalletCase(wallet);
  const existing = inviteCodeByWallet.get(normalized);
  if (existing) return existing;

  const hash = createHash("sha256").update(normalized).digest("hex");
  const code = `HS${hash.slice(0, 8).toUpperCase()}`;
  inviteCodeByWallet.set(normalized, code);
  walletByInviteCode.set(code, normalized);
  return code;
}

function parseNumberInput(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value === "bigint") return Number(value);
  return fallback;
}

function enumVariant(value: unknown): string {
  if (!value || typeof value !== "object") return "unknown";
  const key = Object.keys(value as Record<string, unknown>)[0];
  return key || "unknown";
}

function sanitizeUrlForStatus(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return rawUrl.replace(/\?.*$/, "");
  }
}

function securityHeaders(): HeadersInit {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-xss-protection": "0",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "cross-origin",
  };
}

function applyCors(req: Request, headers: Headers): void {
  const origin = req.headers.get("origin");
  if (!origin) {
    headers.set("access-control-allow-origin", "*");
    return;
  }

  const isAllowedOrigin =
    CORS_ORIGINS.length === 0 ||
    CORS_ORIGINS.includes(origin) ||
    origin === "https://hyperbet.win" ||
    origin.endsWith(".hyperbet.win") ||
    origin === "https://hyperscape.bet" ||
    origin.endsWith(".hyperscape.bet") ||
    origin === "https://hyperscape.gg" ||
    origin.endsWith(".hyperscape.gg") ||
    origin === "https://hyperscape-betting.pages.dev" ||
    origin.endsWith(".hyperscape-betting.pages.dev") ||
    origin === "https://hyperscape.club" ||
    origin.endsWith(".hyperscape.club") ||
    origin === "https://hyperscape.pages.dev" ||
    origin.endsWith(".hyperscape.pages.dev") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");

  if (isAllowedOrigin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  } else {
    headers.set("access-control-allow-origin", "*");
  }

  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set(
    "access-control-allow-headers",
    "content-type,x-arena-write-key,x-forwarded-for,solana-client,x-web3js-version",
  );
  headers.set("access-control-max-age", "86400");
}

function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    ...securityHeaders(),
    ...extraHeaders,
  });
  applyCors(req, headers);
  return new Response(JSON.stringify(body), { status, headers });
}

function textResponse(
  req: Request,
  body: string,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    ...securityHeaders(),
    ...extraHeaders,
  });
  applyCors(req, headers);
  return new Response(body, { status, headers });
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function checkRateLimit(
  ip: string,
  limitPerMinute: number,
  burst: number,
): boolean {
  const now = Date.now();
  const key = `${ip}:${limitPerMinute}:${burst}`;
  const bucket = rateBuckets.get(key) ?? {
    tokens: burst,
    lastRefillMs: now,
  };

  const elapsed = Math.max(0, now - bucket.lastRefillMs);
  const refill = (elapsed / 60_000) * limitPerMinute;
  bucket.tokens = Math.min(burst, bucket.tokens + refill);
  bucket.lastRefillMs = now;

  if (bucket.tokens < 1) {
    rateBuckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= 1;
  rateBuckets.set(key, bucket);
  return true;
}

function requireWriteAuth(
  req: Request,
  fallbackKey = ARENA_WRITE_KEY,
): boolean {
  if (!fallbackKey) return true;
  const provided = req.headers.get("x-arena-write-key")?.trim() || "";
  return provided === fallbackKey;
}

function toStreamState(payload: any): StreamState | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Record<string, any>;
  const cycle = candidate.cycle;
  if (!cycle || typeof cycle !== "object") return null;

  return {
    type: "STREAMING_STATE_UPDATE",
    cycle: cycle as Record<string, any>,
    leaderboard: Array.isArray(candidate.leaderboard)
      ? candidate.leaderboard
      : [],
    cameraTarget:
      typeof candidate.cameraTarget === "string" ||
      candidate.cameraTarget === null
        ? candidate.cameraTarget
        : null,
    seq:
      typeof candidate.seq === "number" && Number.isFinite(candidate.seq)
        ? candidate.seq
        : streamSeq + 1,
    emittedAt:
      typeof candidate.emittedAt === "number" &&
      Number.isFinite(candidate.emittedAt)
        ? candidate.emittedAt
        : Date.now(),
  };
}

function sendSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  id: number,
  data: unknown,
): void {
  const message =
    `id: ${id}\n` + `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}

function broadcastStreamState(nextState: StreamState, event = "state"): void {
  for (const controller of sseClients) {
    try {
      sendSse(controller, event, nextState.seq, nextState);
    } catch {
      sseClients.delete(controller);
    }
  }
}

function publishStreamState(next: StreamState, sourceLabel: string): void {
  streamSeq = Math.max(streamSeq + 1, next.seq || streamSeq + 1);
  streamState = {
    ...next,
    type: "STREAMING_STATE_UPDATE",
    seq: streamSeq,
    emittedAt: Date.now(),
  };
  streamLastUpdatedAt = Date.now();
  streamLastSourceError = null;
  broadcastStreamState(streamState, "state");
  console.log(
    `[${nowIso()}] [stream] updated from ${sourceLabel} cycle=${streamState.cycle?.cycleId ?? "unknown"} phase=${streamState.cycle?.phase ?? "unknown"}`,
  );
}

function nextStreamSourceBackoffMs(): number {
  const step = Math.min(streamSourceConsecutiveFailures, 5);
  return Math.min(
    STREAM_STATE_SOURCE_MAX_BACKOFF_MS,
    STREAM_STATE_POLL_MS * 2 ** step,
  );
}

function registerStreamSourceFailure(reason: string): void {
  streamSourceConsecutiveFailures += 1;
  const backoffMs = nextStreamSourceBackoffMs();
  streamSourceBackoffUntil = Date.now() + backoffMs;

  if (
    streamSourceConsecutiveFailures === 1 ||
    streamSourceConsecutiveFailures % 10 === 0
  ) {
    console.warn(
      `[${nowIso()}] [stream] source poll failed (${reason}); backing off ${backoffMs}ms (consecutive=${streamSourceConsecutiveFailures})`,
    );
  }
}

function resetStreamSourceFailures(): void {
  streamSourceConsecutiveFailures = 0;
  streamSourceBackoffUntil = 0;
}

async function pollStreamStateSource(): Promise<void> {
  if (!STREAM_STATE_SOURCE_URL) return;
  if (streamSourcePollInFlight) return;
  if (Date.now() < streamSourceBackoffUntil) return;

  streamSourcePollInFlight = true;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    STREAM_STATE_SOURCE_TIMEOUT_MS,
  );

  try {
    const headers: Record<string, string> = {};
    if (STREAM_STATE_SOURCE_BEARER_TOKEN) {
      headers.authorization = `Bearer ${STREAM_STATE_SOURCE_BEARER_TOKEN}`;
    }
    headers.connection = "close";

    const response = await fetch(STREAM_STATE_SOURCE_URL, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    streamLastSourcePollAt = Date.now();
    if (!response.ok) {
      streamLastSourceError = `HTTP ${response.status}`;
      try {
        await response.body?.cancel();
      } catch {
        // Ignore cancellation issues for already-closed streams.
      }
      registerStreamSourceFailure(streamLastSourceError);
      return;
    }

    const payload = await response.json();
    const nextState =
      toStreamState(payload) ||
      toStreamState((payload as Record<string, unknown>)?.data);

    if (!nextState) {
      streamLastSourceError = "Invalid payload";
      registerStreamSourceFailure(streamLastSourceError);
      return;
    }

    const changed =
      streamState.cycle?.cycleId !== nextState.cycle?.cycleId ||
      streamState.cycle?.phase !== nextState.cycle?.phase ||
      streamState.cycle?.winnerId !== nextState.cycle?.winnerId;
    if (changed) {
      publishStreamState(nextState, "poll");
    }
    streamLastSourceError = null;
    resetStreamSourceFailures();
  } catch (error) {
    streamLastSourceError =
      error instanceof Error ? error.message : "stream source request failed";
    registerStreamSourceFailure(streamLastSourceError);
  } finally {
    clearTimeout(timeoutId);
    streamSourcePollInFlight = false;
  }
}

function connectedSseCount(): number {
  return sseClients.size;
}

let botSubprocess: Bun.Subprocess | null = null;
let botExitCode: number | null = null;
let botLastExitAt: number | null = null;

function startKeeperBotIfEnabled(): void {
  if (!ENABLE_KEEPER_BOT) return;
  if (botSubprocess) return;

  const childEnv = {
    ...process.env,
    GAME_URL: process.env.GAME_URL || `http://127.0.0.1:${PORT}`,
  };

  botSubprocess = Bun.spawn(["bun", "--bun", "src/bot.ts"], {
    cwd: keeperRoot,
    env: childEnv,
    stdout: "inherit",
    stderr: "inherit",
  });

  void botSubprocess.exited.then((code: number) => {
    botExitCode = code;
    botLastExitAt = Date.now();
    botSubprocess = null;
    console.warn(`[${nowIso()}] [bot] exited with code ${code}`);
    if (ENABLE_KEEPER_BOT) {
      setTimeout(() => {
        startKeeperBotIfEnabled();
      }, 5_000);
    }
  });
}

const solanaKeyRef =
  process.env.BOT_KEYPAIR ||
  process.env.ORACLE_AUTHORITY_KEYPAIR ||
  process.env.MARKET_MAKER_KEYPAIR ||
  "";

let solanaCtx: {
  connection: any;
  fightProgram: any;
  marketProgram: any;
  marketProgramId: any;
} | null = null;

if (solanaKeyRef) {
  try {
    const signer = readKeypair(solanaKeyRef);
    const { connection, fightOracle, goldClobMarket } = createPrograms(signer);
    solanaCtx = {
      connection,
      fightProgram: fightOracle,
      marketProgram: goldClobMarket,
      marketProgramId: goldClobMarket.programId,
    };
    parsers.solana.enabled = true;
  } catch (error) {
    parsers.solana.enabled = false;
    parsers.solana.lastError =
      error instanceof Error
        ? error.message
        : "Failed to initialize Solana parser";
  }
} else {
  parsers.solana.lastError =
    "No BOT_KEYPAIR / ORACLE_AUTHORITY_KEYPAIR / MARKET_MAKER_KEYPAIR configured";
}

async function pollSolanaSnapshot(): Promise<void> {
  if (!solanaCtx) return;
  try {
    // Use raw program account scans/signatures for resilient parsing across
    // account-layout upgrades and IDL drift.
    const [fightAccounts, marketAccounts, recentSignatures] = await Promise.all(
      [
        solanaCtx.connection.getProgramAccounts(
          solanaCtx.fightProgram.programId,
          {
            dataSlice: { offset: 0, length: 0 },
          },
        ),
        solanaCtx.connection.getProgramAccounts(
          solanaCtx.marketProgram.programId,
          {
            dataSlice: { offset: 0, length: 0 },
          },
        ),
        solanaCtx.connection.getSignaturesForAddress(
          solanaCtx.fightProgram.programId,
          { limit: 10 },
        ),
      ],
    );

    const latestFightAccount = fightAccounts[0]?.pubkey?.toBase58?.() ?? null;
    const latestMarketAccount = marketAccounts[0]?.pubkey?.toBase58?.() ?? null;
    const derivedMarketPda =
      fightAccounts[0]?.pubkey != null
        ? findMarketPda(
            solanaCtx.marketProgramId,
            fightAccounts[0]!.pubkey,
          ).toBase58()
        : null;
    const recentSignature =
      recentSignatures.find((entry: any) => entry?.signature)?.signature ??
      null;

    parsers.solana.snapshot = {
      rpc: sanitizeUrlForStatus(solanaCtx.connection.rpcEndpoint),
      fightOracleProgram: solanaCtx.fightProgram.programId.toBase58(),
      marketProgram: solanaCtx.marketProgram.programId.toBase58(),
      fightAccountCount: fightAccounts.length,
      marketAccountCount: marketAccounts.length,
      latestFightAccount,
      latestMarketAccount,
      derivedMarketPda,
      recentSignature,
    };
    parsers.solana.lastSuccessAt = Date.now();
    parsers.solana.lastError = null;
  } catch (error) {
    parsers.solana.lastError =
      error instanceof Error ? error.message : "Solana poll failed";
  }
}

async function pollEvmSnapshot(
  label: "bsc" | "base",
  client: ReturnType<typeof createPublicClient> | null,
  contractAddress: string,
): Promise<void> {
  if (!client || !contractAddress) return;
  const parser = parsers[label];

  try {
    const nextMatchId = (await client.readContract({
      address: contractAddress as Address,
      abi: GOLD_CLOB_READ_ABI,
      functionName: "nextMatchId",
      args: [],
    })) as bigint;

    const currentMatchId = nextMatchId > 0n ? nextMatchId - 1n : 0n;
    const match = (await client.readContract({
      address: contractAddress as Address,
      abi: GOLD_CLOB_READ_ABI,
      functionName: "matches",
      args: [currentMatchId],
    })) as any;

    const status = Array.isArray(match)
      ? Number(match[0] ?? 0)
      : Number(match.status ?? 0);
    const winner = Array.isArray(match)
      ? Number(match[1] ?? 0)
      : Number(match.winner ?? 0);
    const yesPool = Array.isArray(match)
      ? String(match[2] ?? 0n)
      : String(match.yesPool ?? 0n);
    const noPool = Array.isArray(match)
      ? String(match[3] ?? 0n)
      : String(match.noPool ?? 0n);

    parser.snapshot = {
      contractAddress,
      nextMatchId: nextMatchId.toString(),
      currentMatchId: currentMatchId.toString(),
      currentMatch: {
        status,
        winner,
        yesPool,
        noPool,
      },
    };
    parser.lastSuccessAt = Date.now();
    parser.lastError = null;
  } catch (error) {
    parser.lastError =
      error instanceof Error ? error.message : `${label} poll failed`;
  }
}

let contractPollInFlight = false;
async function pollContractParsers(): Promise<void> {
  if (contractPollInFlight) return;
  contractPollInFlight = true;
  try {
    await Promise.all([
      pollSolanaSnapshot(),
      pollEvmSnapshot("bsc", bscClient, bscContractAddress),
      pollEvmSnapshot("base", baseClient, baseContractAddress),
    ]);
  } finally {
    contractPollInFlight = false;
  }
}

function getReferralOwner(
  wallet: string,
): { wallet: string; code: string } | null {
  const normalized = rememberWalletCase(wallet);
  const direct = referredByWallet.get(normalized);
  if (direct) return direct;

  const canonical = ensureIdentity(normalized);
  const members = identityMembers.get(canonical);
  if (!members) return null;
  for (const member of members) {
    const linked = referredByWallet.get(member);
    if (linked) return linked;
  }
  return null;
}

function pointsForWalletResponse(
  wallet: string,
  scope: string | null,
): Record<string, any> {
  const wallets = identityWallets(wallet, scope);
  const aggregate = aggregatePoints(wallets);
  const normalized = rememberWalletCase(wallet);
  const referredBy = getReferralOwner(normalized);

  return {
    wallet: wallet.trim(),
    pointsScope: scope?.toLowerCase() === "linked" ? "LINKED" : "WALLET",
    identityWalletCount: wallets.length,
    totalPoints: totalPoints(aggregate),
    selfPoints: aggregate.selfPoints,
    winPoints: aggregate.winPoints,
    referralPoints: aggregate.referralPoints,
    stakingPoints: aggregate.stakingPoints,
    multiplier: 1,
    goldBalance: null,
    goldHoldDays: 0,
    invitedWalletCount: (
      invitedWalletsByWallet.get(ensureIdentity(normalized)) ?? new Set()
    ).size,
    referredBy: referredBy
      ? {
          wallet: displayWallet(referredBy.wallet),
          code: referredBy.code,
        }
      : null,
  };
}

function leaderboardResponse(
  limit: number,
  offset: number,
  scope: string | null,
): {
  leaderboard: Array<{ rank: number; wallet: string; totalPoints: number }>;
} {
  const useLinked = scope?.toLowerCase() === "linked";

  let rows: Array<{ wallet: string; totalPoints: number }>;
  if (useLinked) {
    rows = [];
    for (const [canonical, members] of identityMembers.entries()) {
      const aggregate = aggregatePoints([...members]);
      rows.push({
        wallet: displayWallet(canonical),
        totalPoints: totalPoints(aggregate),
      });
    }
  } else {
    rows = [...pointsByWallet.entries()].map(([wallet, points]) => ({
      wallet: displayWallet(wallet),
      totalPoints: totalPoints(points),
    }));
  }

  rows.sort((a, b) => b.totalPoints - a.totalPoints);
  const sliced = rows.slice(offset, offset + limit);
  return {
    leaderboard: sliced.map((row, index) => ({
      rank: offset + index + 1,
      wallet: row.wallet,
      totalPoints: row.totalPoints,
    })),
  };
}

async function handleBetRecord(req: Request): Promise<Response> {
  if (!requireWriteAuth(req)) {
    return jsonResponse(req, { error: "Unauthorized write key" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const walletRaw = String(payload.bettorWallet || "").trim();
  if (!walletRaw) {
    return jsonResponse(req, { error: "Missing bettorWallet" }, 400);
  }

  const chain = String(payload.chain || "SOLANA").toUpperCase();
  const chainValue: "SOLANA" | "BSC" | "BASE" =
    chain === "BSC" ? "BSC" : chain === "BASE" ? "BASE" : "SOLANA";

  const sourceAmount = parseNumberInput(payload.sourceAmount, 0);
  const goldAmount = parseNumberInput(payload.goldAmount, sourceAmount);
  const feeBps = Math.max(0, parseNumberInput(payload.feeBps, 0));

  const normalizedWallet = rememberWalletCase(walletRaw);
  ensureIdentity(normalizedWallet);
  const points = ensureWalletPoints(normalizedWallet);
  const pointsAwarded = Math.max(
    1,
    Math.round(Math.max(goldAmount, sourceAmount) * 10),
  );
  points.selfPoints += pointsAwarded;

  const inviteCodeRaw = String(payload.inviteCode || "")
    .trim()
    .toUpperCase();
  if (inviteCodeRaw && !referredByWallet.has(normalizedWallet)) {
    const inviter = walletByInviteCode.get(inviteCodeRaw);
    if (inviter && inviter !== normalizedWallet) {
      referredByWallet.set(normalizedWallet, {
        wallet: inviter,
        code: inviteCodeRaw,
      });
      const invited = invitedWalletsByWallet.get(inviter) ?? new Set<string>();
      invited.add(normalizedWallet);
      invitedWalletsByWallet.set(inviter, invited);
    }
  }

  const referrer = getReferralOwner(normalizedWallet);
  if (referrer && referrer.wallet !== normalizedWallet) {
    const referrerPoints = ensureWalletPoints(referrer.wallet);
    const referralPointsAwarded = Math.max(1, Math.round(pointsAwarded * 0.2));
    referrerPoints.referralPoints += referralPointsAwarded;

    const betFeeGold = (Math.max(goldAmount, 0) * Math.max(feeBps, 0)) / 10_000;
    const referralFeeShare = betFeeGold * 0.5;
    referralFeeShareGoldByWallet.set(
      referrer.wallet,
      (referralFeeShareGoldByWallet.get(referrer.wallet) ?? 0) +
        referralFeeShare,
    );
    treasuryFeesFromReferralsByWallet.set(
      referrer.wallet,
      (treasuryFeesFromReferralsByWallet.get(referrer.wallet) ?? 0) +
        betFeeGold,
    );
  }

  const record: BetRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    bettorWallet: displayWallet(normalizedWallet),
    chain: chainValue,
    sourceAsset: String(payload.sourceAsset || "GOLD"),
    sourceAmount,
    goldAmount,
    feeBps,
    txSignature: String(payload.txSignature || ""),
    marketPda: payload.marketPda ? String(payload.marketPda) : null,
    inviteCode: inviteCodeRaw || null,
    externalBetRef: payload.externalBetRef
      ? String(payload.externalBetRef)
      : null,
    recordedAt: Date.now(),
  };
  bets.unshift(record);
  if (bets.length > BET_STORE_LIMIT) {
    bets.length = BET_STORE_LIMIT;
  }

  return jsonResponse(req, {
    ok: true,
    pointsAwarded,
    wallet: record.bettorWallet,
    totalPoints: totalPoints(aggregatePoints([normalizedWallet])),
  });
}

async function handleInviteRedeem(req: Request): Promise<Response> {
  if (!requireWriteAuth(req)) {
    return jsonResponse(req, { error: "Unauthorized write key" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const walletRaw = String(payload.wallet || "").trim();
  const inviteCode = String(payload.inviteCode || "")
    .trim()
    .toUpperCase();
  if (!walletRaw || !inviteCode) {
    return jsonResponse(
      req,
      { error: "wallet and inviteCode are required" },
      400,
    );
  }

  const wallet = rememberWalletCase(walletRaw);
  ensureIdentity(wallet);

  const inviterWallet = walletByInviteCode.get(inviteCode);
  if (!inviterWallet) {
    return jsonResponse(req, { error: "Invalid invite code" }, 404);
  }
  if (inviterWallet === wallet) {
    return jsonResponse(
      req,
      { error: "Cannot redeem your own invite code" },
      400,
    );
  }

  const existing = referredByWallet.get(wallet);
  if (existing) {
    return jsonResponse(req, {
      result: {
        alreadyLinked: true,
        signupBonus: 0,
      },
    });
  }

  referredByWallet.set(wallet, { wallet: inviterWallet, code: inviteCode });
  const invited =
    invitedWalletsByWallet.get(inviterWallet) ?? new Set<string>();
  invited.add(wallet);
  invitedWalletsByWallet.set(inviterWallet, invited);

  const signupBonus = 50;
  ensureWalletPoints(wallet).selfPoints += signupBonus;

  return jsonResponse(req, {
    result: {
      alreadyLinked: false,
      signupBonus,
    },
  });
}

async function handleWalletLink(req: Request): Promise<Response> {
  if (!requireWriteAuth(req)) {
    return jsonResponse(req, { error: "Unauthorized write key" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const walletRaw = String(payload.wallet || "").trim();
  const linkedWalletRaw = String(payload.linkedWallet || "").trim();
  if (!walletRaw || !linkedWalletRaw) {
    return jsonResponse(
      req,
      { error: "wallet and linkedWallet are required" },
      400,
    );
  }

  const wallet = rememberWalletCase(walletRaw);
  const linkedWallet = rememberWalletCase(linkedWalletRaw);

  const merged = mergeIdentity(wallet, linkedWallet);
  const awardedPoints = merged ? 100 : 0;
  if (merged) {
    ensureWalletPoints(wallet).selfPoints += awardedPoints;
  }

  return jsonResponse(req, {
    result: {
      alreadyLinked: !merged,
      awardedPoints,
    },
  });
}

function inviteSummary(
  walletRaw: string,
  platformView: string,
): Record<string, any> {
  const wallet = rememberWalletCase(walletRaw);
  const code = inviteCodeForWallet(wallet);
  const canonical = ensureIdentity(wallet);
  const invited = invitedWalletsByWallet.get(canonical) ?? new Set<string>();
  const aggregate = aggregatePoints(identityWallets(wallet, "linked"));
  const referredBy = getReferralOwner(wallet);
  const invitedWallets = [...invited].map((entry) => displayWallet(entry));
  const feeShare = referralFeeShareGoldByWallet.get(canonical) ?? 0;
  const treasuryFees = treasuryFeesFromReferralsByWallet.get(canonical) ?? 0;

  return {
    wallet: displayWallet(wallet),
    platformView: platformView || "unknown",
    inviteCode: code,
    invitedWalletCount: invitedWallets.length,
    invitedWallets: invitedWallets.slice(0, 25),
    invitedWalletsTruncated: invitedWallets.length > 25,
    pointsFromReferrals: aggregate.referralPoints,
    feeShareFromReferralsGold: feeShare.toFixed(6),
    treasuryFeesFromReferredBetsGold: treasuryFees.toFixed(6),
    referredByWallet: referredBy ? displayWallet(referredBy.wallet) : null,
    referredByCode: referredBy ? referredBy.code : null,
    activeReferralCount: invitedWallets.length,
    pendingSignupBonuses: 0,
    totalReferralWinPoints: 0,
  };
}

async function handleSolanaRpcProxy(req: Request): Promise<Response> {
  if (!SOLANA_RPC_PROXY_URL) {
    return jsonResponse(
      req,
      { error: "SOLANA_RPC_URL is not configured" },
      503,
    );
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    return jsonResponse(req, { error: "Unable to read request body" }, 400);
  }

  if (!bodyText.trim()) {
    return jsonResponse(req, { error: "Missing JSON-RPC body" }, 400);
  }

  if (bodyText.length > SOLANA_RPC_PROXY_MAX_BODY_BYTES) {
    return jsonResponse(req, { error: "JSON-RPC body too large" }, 413);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return jsonResponse(req, { error: "Invalid JSON-RPC body" }, 400);
  }

  const requests = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
  const hasInvalidRequest = requests.some((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const method = (entry as Record<string, unknown>).method;
    return typeof method !== "string" || method.trim().length === 0;
  });
  if (requests.length === 0 || hasInvalidRequest) {
    return jsonResponse(req, { error: "Invalid JSON-RPC payload" }, 400);
  }

  try {
    const upstream = await fetch(SOLANA_RPC_PROXY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: bodyText,
      cache: "no-store",
    });
    const payload = await upstream.text();
    const headers = new Headers({
      "content-type":
        upstream.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...securityHeaders(),
    });
    applyCors(req, headers);
    return new Response(payload, { status: upstream.status, headers });
  } catch (error) {
    return jsonResponse(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to proxy Solana RPC request",
      },
      502,
    );
  }
}

async function handleBirdeyePrice(req: Request, url: URL): Promise<Response> {
  const address = url.searchParams.get("address")?.trim();
  if (!address) {
    return jsonResponse(req, { error: "Missing address query param" }, 400);
  }
  if (!BIRDEYE_API_KEY) {
    return jsonResponse(
      req,
      { error: "Birdeye API key is not configured" },
      503,
    );
  }

  try {
    const upstream = await fetch(
      `${BIRDEYE_API_BASE}/defi/price?address=${encodeURIComponent(address)}`,
      {
        headers: {
          "x-api-key": BIRDEYE_API_KEY,
        },
      },
    );
    const payload = await upstream.json();
    return jsonResponse(req, payload, upstream.status);
  } catch (error) {
    return jsonResponse(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to proxy Birdeye request",
      },
      502,
    );
  }
}

async function handleItemManifest(
  req: Request,
  fileName: string,
): Promise<Response> {
  const allowed = new Set([
    "weapons.json",
    "ammunition.json",
    "resources.json",
    "tools.json",
    "misc.json",
    "armor.json",
    "runes.json",
    "food.json",
  ]);

  if (!allowed.has(fileName)) {
    return jsonResponse(req, { error: "Unknown manifest file" }, 404);
  }

  const cached = manifestCache.get(fileName);
  if (cached) {
    return jsonResponse(req, cached, 200, {
      "cache-control": "public, max-age=60, stale-while-revalidate=60",
    });
  }

  try {
    const upstream = await fetch(`${ITEM_MANIFEST_BASE_URL}/${fileName}`, {
      cache: "no-store",
    });
    if (upstream.ok) {
      const payload = await upstream.json();
      manifestCache.set(fileName, payload);
      return jsonResponse(req, payload, 200, {
        "cache-control": "public, max-age=60, stale-while-revalidate=60",
      });
    }
  } catch {
    // Fall back below.
  }

  const fallback: any[] = [];
  manifestCache.set(fileName, fallback);
  return jsonResponse(req, fallback, 200, {
    "cache-control": "public, max-age=60, stale-while-revalidate=60",
  });
}

async function handleStreamPublish(req: Request): Promise<Response> {
  if (!requireWriteAuth(req, STREAM_PUBLISH_KEY)) {
    return jsonResponse(req, { error: "Unauthorized stream publish key" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  const nextState = toStreamState(payload);
  if (!nextState) {
    return jsonResponse(req, { error: "Invalid stream payload" }, 400);
  }

  publishStreamState(nextState, "publish");
  return jsonResponse(req, { ok: true, seq: streamState.seq });
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 60,
  development: process.env.NODE_ENV !== "production",
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    const ip = clientIp(req);
    const isWriteRoute =
      req.method === "POST" || url.pathname === "/api/streaming/state/publish";
    const allowed = checkRateLimit(
      ip,
      isWriteRoute ? 120 : 360,
      isWriteRoute ? 60 : 180,
    );
    if (!allowed) {
      return jsonResponse(req, { error: "Rate limit exceeded" }, 429);
    }

    if (req.method === "OPTIONS") {
      const headers = new Headers({ ...securityHeaders() });
      applyCors(req, headers);
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/status") {
      return jsonResponse(req, {
        ok: true,
        service: "gold-betting-demo-backend",
        now: Date.now(),
        stream: {
          seq: streamState.seq,
          cycleId: streamState.cycle?.cycleId ?? null,
          phase: streamState.cycle?.phase ?? null,
          lastUpdatedAt: streamLastUpdatedAt,
          sourceUrl: STREAM_STATE_SOURCE_URL
            ? sanitizeUrlForStatus(STREAM_STATE_SOURCE_URL)
            : null,
          lastSourcePollAt: streamLastSourcePollAt,
          lastSourceError: streamLastSourceError,
          sseClients: connectedSseCount(),
        },
        parsers,
        bot: {
          enabled: ENABLE_KEEPER_BOT,
          running: Boolean(botSubprocess),
          lastExitCode: botExitCode,
          lastExitAt: botLastExitAt,
        },
        stats: {
          trackedBets: bets.length,
          linkedIdentities: identityMembers.size,
          knownWallets: walletDisplay.size,
        },
      });
    }

    if (url.pathname === "/") {
      return textResponse(
        req,
        "gold-betting-demo backend online\n\nUse /status for health.",
      );
    }

    if (req.method === "GET" && url.pathname === "/api/streaming/state") {
      return jsonResponse(req, streamState, 200, {
        "cache-control": "no-store",
      });
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/streaming/state/events"
    ) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          sseClients.add(controller);
          sendSse(controller, "reset", streamState.seq, streamState);
          controller.enqueue(encoder.encode(": connected\n\n"));
        },
        cancel(reason) {
          void reason;
          // The controller that was cancelled is already detached from writes;
          // stale controllers are pruned on keepalive/broadcast write failure.
        },
      });

      const headers = new Headers({
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        connection: "keep-alive",
        ...securityHeaders(),
      });
      applyCors(req, headers);
      return new Response(stream, { status: 200, headers });
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/streaming/state/publish"
    ) {
      return handleStreamPublish(req);
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/arena/bet/record-external"
    ) {
      return handleBetRecord(req);
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/arena/points/leaderboard"
    ) {
      const limit = Math.max(
        1,
        Math.min(200, Number(url.searchParams.get("limit") || 20)),
      );
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
      const payload = leaderboardResponse(
        limit,
        offset,
        url.searchParams.get("scope"),
      );
      return jsonResponse(req, {
        ...payload,
        limit,
        offset,
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/arena/points/")) {
      const wallet = decodeURIComponent(
        url.pathname.replace("/api/arena/points/", ""),
      );
      if (!wallet) {
        return jsonResponse(req, { error: "Wallet is required" }, 400);
      }
      return jsonResponse(
        req,
        pointsForWalletResponse(wallet, url.searchParams.get("scope")),
      );
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/arena/invite/")) {
      const wallet = decodeURIComponent(
        url.pathname.replace("/api/arena/invite/", ""),
      );
      if (!wallet) {
        return jsonResponse(req, { error: "Wallet is required" }, 400);
      }
      return jsonResponse(
        req,
        inviteSummary(wallet, url.searchParams.get("platform") || "unknown"),
      );
    }

    if (req.method === "POST" && url.pathname === "/api/arena/invite/redeem") {
      return handleInviteRedeem(req);
    }

    if (req.method === "POST" && url.pathname === "/api/arena/wallet-link") {
      return handleWalletLink(req);
    }

    if (req.method === "POST" && url.pathname === "/api/proxy/solana/rpc") {
      return handleSolanaRpcProxy(req);
    }

    if (req.method === "GET" && url.pathname === "/api/proxy/birdeye/price") {
      return handleBirdeyePrice(req, url);
    }

    if (
      req.method === "GET" &&
      url.pathname.startsWith("/game-assets/manifests/items/")
    ) {
      const fileName = decodeURIComponent(
        url.pathname.replace("/game-assets/manifests/items/", ""),
      );
      return handleItemManifest(req, fileName);
    }

    return jsonResponse(req, { error: "Not Found" }, 404);
  },
});

console.log(`[${nowIso()}] [backend] listening on http://0.0.0.0:${PORT}`);

setInterval(() => {
  for (const controller of sseClients) {
    try {
      controller.enqueue(encoder.encode(": keepalive\n\n"));
    } catch {
      sseClients.delete(controller);
    }
  }
}, 20_000);

if (STREAM_STATE_SOURCE_URL) {
  console.log(
    `[${nowIso()}] [stream] polling source ${STREAM_STATE_SOURCE_URL}`,
  );
  setInterval(() => {
    void pollStreamStateSource();
  }, STREAM_STATE_POLL_MS);
  void pollStreamStateSource();
}

setInterval(() => {
  void pollContractParsers();
}, CONTRACT_POLL_MS);
void pollContractParsers();

startKeeperBotIfEnabled();

process.on("SIGINT", () => {
  server.stop(true);
  botSubprocess?.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop(true);
  botSubprocess?.kill();
  process.exit(0);
});
