import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AnchorProvider, BN, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";

import fightOracleIdl from "../../../anchor/target/idl/fight_oracle.json";

type ClusterName = "mainnet-beta" | "testnet";
type PayAsset = "GOLD" | "SOL";
type SignableTx = Transaction | VersionedTransaction;
type AnchorLikeWallet = Wallet & { payer: Keypair };

type SetupState = {
  mode: "public";
  cluster: ClusterName;
  solanaRpcUrl: string;
  authority: string;
  goldMint: string;
  goldTokenProgram: string;
  currentMatchId: number;
  currentMatchPda: string;
  lastResolvedMatchId: number;
  expectedSeedSuccess: boolean;
  canStartNewRound: boolean;
  placeBetPayAsset: PayAsset;
  placeBetAmount: string;
  placeBetSide: "YES" | "NO";
  currentBetWindowSeconds: number;
};

function errorMessage(error: unknown): string {
  return (error as Error)?.message ?? String(error);
}

function containsAny(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function isAlreadyResolvedRace(error: unknown): boolean {
  const message = errorMessage(error);
  return containsAny(message, [
    "MatchAlreadyResolved",
    "MarketAlreadyResolved",
    "already been resolved",
  ]);
}

const MAINNET_GOLD_MINT = "DK9nBUMfdu4XprPRWeh8f6KnQiGWD8Z4xz3yzs9gpump";
const DEFAULT_BET_WINDOW_SECONDS = 120;
const DEFAULT_RESOLVED_WINDOW_SECONDS = 4;
const DEFAULT_AUTO_SEED_DELAY_SECONDS = 10;
const DEFAULT_SEED_GOLD = 1;
const DEFAULT_BET_GOLD = 1;
const DEFAULT_BET_SOL = 0.01;
const DEFAULT_BET_FEE_BPS = 200;

function parseCluster(): ClusterName {
  const argClusterIndex = process.argv.findIndex(
    (value) => value === "--cluster",
  );
  const argCluster =
    argClusterIndex >= 0 ? process.argv[argClusterIndex + 1] : undefined;
  const value = argCluster || process.env.E2E_CLUSTER || "mainnet-beta";
  if (value === "mainnet-beta" || value === "testnet") return value;
  throw new Error(`Unsupported cluster: ${value}`);
}

function parseDotEnv(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    result[key] = value;
  }
  return result;
}

async function loadEnvFile(
  filepath: string,
): Promise<Record<string, string> | null> {
  try {
    const body = await fs.readFile(filepath, "utf8");
    return parseDotEnv(body);
  } catch {
    return null;
  }
}

function expandHome(filepath: string): string {
  if (!filepath.startsWith("~")) return filepath;
  return path.join(process.env.HOME ?? "", filepath.slice(1));
}

function parseSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }
  if (trimmed.includes(",")) {
    return Uint8Array.from(
      trimmed
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value)),
    );
  }
  throw new Error(
    "Unsupported E2E headless secret format (expected JSON array or comma-separated bytes)",
  );
}

async function readKeypairFromPath(filepath: string): Promise<Keypair> {
  const body = await fs.readFile(expandHome(filepath), "utf8");
  const secret = Uint8Array.from(JSON.parse(body) as number[]);
  return Keypair.fromSecretKey(secret);
}

async function resolveAuthority(
  env: Record<string, string>,
): Promise<{ keypair: Keypair; secretCsv: string }> {
  const directSecret =
    env.E2E_HEADLESS_WALLET_SECRET_KEY || env.VITE_HEADLESS_WALLET_SECRET_KEY;
  if (directSecret) {
    const secret = parseSecretKey(directSecret);
    const keypair = Keypair.fromSecretKey(secret);
    return { keypair, secretCsv: Array.from(secret).join(",") };
  }

  const keypairPath =
    env.E2E_HEADLESS_KEYPAIR_PATH ||
    env.E2E_WALLET_KEYPAIR ||
    "~/.config/solana/id.json";
  const keypair = await readKeypairFromPath(keypairPath);
  return { keypair, secretCsv: Array.from(keypair.secretKey).join(",") };
}

function numFromEnv(
  env: Record<string, string>,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toWallet(keypair: Keypair): AnchorLikeWallet {
  const sign = <T extends SignableTx>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([keypair]);
    else tx.partialSign(keypair);
    return tx;
  };

  return {
    payer: keypair,
    publicKey: keypair.publicKey,
    signTransaction: async <T extends SignableTx>(tx: T): Promise<T> =>
      sign(tx),
    signAllTransactions: async <T extends SignableTx[]>(txs: T): Promise<T> => {
      txs.forEach((tx) => sign(tx));
      return txs;
    },
  };
}

function getRpcCandidates(
  cluster: ClusterName,
  env: Record<string, string>,
): string[] {
  const candidates: string[] = [];
  if (env.E2E_RPC_URL) candidates.push(env.E2E_RPC_URL);
  if (env.VITE_SOLANA_RPC_URL) candidates.push(env.VITE_SOLANA_RPC_URL);

  if (cluster === "testnet") {
    candidates.push("https://api.testnet.solana.com");
  } else {
    const heliusApiKey = env.HELIUS_API_KEY;
    if (heliusApiKey) {
      candidates.push(
        `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
      );
    }
    candidates.push("https://api.mainnet-beta.solana.com");
  }

  return [...new Set(candidates)];
}

async function createConnectionWithFallback(
  rpcCandidates: string[],
): Promise<{ connection: Connection; rpcUrl: string }> {
  let lastError: unknown = null;

  for (const rpcUrl of rpcCandidates) {
    try {
      const connection = new Connection(rpcUrl, "confirmed");
      await connection.getLatestBlockhash("confirmed");
      return { connection, rpcUrl };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Could not connect to any RPC endpoint. Last error: ${(lastError as Error)?.message || String(lastError)}`,
  );
}

function getWsUrl(cluster: ClusterName, env: Record<string, string>): string {
  if (env.E2E_WS_URL) return env.E2E_WS_URL;
  if (env.VITE_SOLANA_WS_URL) return env.VITE_SOLANA_WS_URL;
  if (cluster === "testnet") return "wss://api.testnet.solana.com/";
  const heliusApiKey = env.HELIUS_API_KEY;
  if (heliusApiKey) {
    return `wss://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
  }
  return "wss://api.mainnet-beta.solana.com/";
}

function idlWithAddress(idl: Idl, programId: PublicKey): Idl {
  return { ...(idl as any), address: programId.toBase58() } as Idl;
}

async function assertProgramDeployed(
  connection: Connection,
  programId: PublicKey,
  label: string,
  cluster: ClusterName,
): Promise<void> {
  const info = await connection.getAccountInfo(programId, "confirmed");
  if (!info?.executable) {
    throw new Error(
      `${label} program ${programId.toBase58()} is not deployed on ${cluster}. Deploy it first, then rerun e2e.`,
    );
  }
}

function deriveMarketAddresses(
  fightProgramId: PublicKey,
  matchId: number,
): {
  matchPda: PublicKey;
} {
  const [matchPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("match"), new BN(matchId).toArrayLike(Buffer, "le", 8)],
    fightProgramId,
  );
  return {
    matchPda,
  };
}

async function findTokenAccountForMint(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey,
): Promise<PublicKey | null> {
  try {
    const accounts = await connection.getTokenAccountsByOwner(owner, {
      mint,
      programId: tokenProgram,
    });
    return accounts.value[0]?.pubkey ?? null;
  } catch {
    return null;
  }
}

async function findAnyTokenAccountForMint(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<{ tokenAccount: PublicKey | null; tokenProgram: PublicKey | null }> {
  const token2022 = await findTokenAccountForMint(
    connection,
    owner,
    mint,
    TOKEN_2022_PROGRAM_ID,
  );
  if (token2022) {
    return { tokenAccount: token2022, tokenProgram: TOKEN_2022_PROGRAM_ID };
  }

  const tokenLegacy = await findTokenAccountForMint(
    connection,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
  );
  if (tokenLegacy) {
    return { tokenAccount: tokenLegacy, tokenProgram: TOKEN_PROGRAM_ID };
  }

  return { tokenAccount: null, tokenProgram: null };
}

async function main(): Promise<void> {
  const cluster = parseCluster();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(__dirname, "../..");
  const statePath = path.resolve(__dirname, "./state.json");
  const envPath = path.resolve(appDir, ".env.e2e");

  const modeEnv = await loadEnvFile(
    path.resolve(
      appDir,
      `.env.${cluster === "mainnet-beta" ? "mainnet" : "testnet"}`,
    ),
  );
  const mergedEnv = {
    ...(modeEnv ?? {}),
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };

  const { keypair: authority, secretCsv } = await resolveAuthority(mergedEnv);
  const rpcCandidates = getRpcCandidates(cluster, mergedEnv);
  const { connection, rpcUrl } =
    await createConnectionWithFallback(rpcCandidates);
  const wsUrl = getWsUrl(cluster, mergedEnv);
  const provider = new AnchorProvider(connection, toWallet(authority), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  const fightProgramId = new PublicKey(
    mergedEnv.VITE_FIGHT_ORACLE_PROGRAM_ID || fightOracleIdl.address,
  );
  const fightProgram = new Program(
    idlWithAddress(fightOracleIdl as Idl, fightProgramId),
    provider,
  );
  const fight: any = fightProgram;

  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")],
    fightProgram.programId,
  );

  const initializeOracle = async () => {
    await fight.methods
      .initializeOracle()
      .accountsPartial({
        authority: authority.publicKey,
        oracleConfig: oracleConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  };

  await initializeOracle();

  let oracleConfig: any = null;
  for (let i = 0; i < 10; i += 1) {
    oracleConfig = await (
      fightProgram as any
    ).account.oracleConfig.fetchNullable(oracleConfigPda);
    if (oracleConfig) break;
    await sleep(800);
  }
  if (!oracleConfig) {
    await initializeOracle();
    for (let i = 0; i < 10; i += 1) {
      oracleConfig = await (
        fightProgram as any
      ).account.oracleConfig.fetchNullable(oracleConfigPda);
      if (oracleConfig) break;
      await sleep(800);
    }
  }
  if (!oracleConfig) {
    throw new Error(
      `Oracle config ${oracleConfigPda.toBase58()} was not found after initialize`,
    );
  }
  const oracleAuthority = oracleConfig.authority as PublicKey;
  if (!oracleAuthority.equals(authority.publicKey)) {
    throw new Error(
      `Oracle config authority mismatch. Expected ${authority.publicKey.toBase58()}, found ${oracleAuthority.toBase58()}. Use the oracle authority keypair for public e2e.`,
    );
  }

  const goldDecimals = numFromEnv(mergedEnv, "VITE_GOLD_DECIMALS", 6);
  const testnetMintOverride = mergedEnv.E2E_TESTNET_GOLD_MINT;
  let goldMint: PublicKey;
  let goldTokenProgram = TOKEN_2022_PROGRAM_ID;

  if (cluster === "testnet" && !testnetMintOverride) {
    goldMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      goldDecimals,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    const tokenAccount = await createAccount(
      connection,
      authority,
      goldMint,
      authority.publicKey,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    await mintTo(
      connection,
      authority,
      goldMint,
      tokenAccount,
      authority,
      2_000_000_000,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
  } else {
    const configuredMint = new PublicKey(
      testnetMintOverride || mergedEnv.VITE_GOLD_MINT || MAINNET_GOLD_MINT,
    );
    const mintInfo = await connection.getAccountInfo(
      configuredMint,
      "confirmed",
    );
    if (!mintInfo) {
      throw new Error(
        `Configured GOLD mint ${configuredMint.toBase58()} is not available on ${cluster}`,
      );
    }
    if (mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      goldTokenProgram = TOKEN_PROGRAM_ID;
    } else if (mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      goldTokenProgram = TOKEN_2022_PROGRAM_ID;
    } else {
      throw new Error(
        `Configured GOLD mint ${configuredMint.toBase58()} is not owned by SPL token program`,
      );
    }
    goldMint = configuredMint;
  }

  const discoveredTokenAccount = await findAnyTokenAccountForMint(
    connection,
    authority.publicKey,
    goldMint,
  );

  let authorityGoldAta = discoveredTokenAccount.tokenAccount;
  if (!authorityGoldAta && cluster === "testnet") {
    authorityGoldAta = await createAccount(
      connection,
      authority,
      goldMint,
      authority.publicKey,
      undefined,
      undefined,
      goldTokenProgram,
    );
    try {
      await mintTo(
        connection,
        authority,
        goldMint,
        authorityGoldAta,
        authority,
        1_500_000_000,
        [],
        undefined,
        goldTokenProgram,
      );
    } catch {
      // ignore if mint authority differs for a provided testnet mint
    }
  }

  let goldBalanceUi = 0;
  if (authorityGoldAta) {
    try {
      const account = await getAccount(
        connection,
        authorityGoldAta,
        "confirmed",
        goldTokenProgram,
      );
      goldBalanceUi = Number(account.amount) / 10 ** goldDecimals;
    } catch {
      goldBalanceUi = 0;
    }
  }

  const seedGold = numFromEnv(
    mergedEnv,
    "E2E_SEED_GOLD",
    numFromEnv(mergedEnv, "VITE_MARKET_MAKER_SEED_GOLD", DEFAULT_SEED_GOLD),
  );
  const betFeeBps = numFromEnv(
    mergedEnv,
    "VITE_BET_FEE_BPS",
    DEFAULT_BET_FEE_BPS,
  );
  const tradeTreasuryFeeBps = Math.floor(betFeeBps / 2);
  const tradeMarketMakerFeeBps = Math.max(0, betFeeBps - tradeTreasuryFeeBps);
  const winningsMarketMakerFeeBps = betFeeBps;
  const betGoldAmount = numFromEnv(
    mergedEnv,
    "E2E_BET_GOLD_AMOUNT",
    DEFAULT_BET_GOLD,
  );
  const betSolAmount = numFromEnv(
    mergedEnv,
    "E2E_BET_SOL_AMOUNT",
    DEFAULT_BET_SOL,
  );
  const betWindowSeconds = numFromEnv(
    mergedEnv,
    "E2E_BET_WINDOW_SECONDS",
    DEFAULT_BET_WINDOW_SECONDS,
  );
  const resolvedWindowSeconds = numFromEnv(
    mergedEnv,
    "E2E_RESOLVED_WINDOW_SECONDS",
    DEFAULT_RESOLVED_WINDOW_SECONDS,
  );
  const autoSeedDelaySeconds = numFromEnv(
    mergedEnv,
    "VITE_AUTO_SEED_DELAY_SECONDS",
    DEFAULT_AUTO_SEED_DELAY_SECONDS,
  );

  const expectedSeedSuccess = goldBalanceUi >= seedGold * 2 + 0.001;
  let placeBetPayAsset: PayAsset = "GOLD";
  let placeBetAmount = betGoldAmount.toString();
  if (goldBalanceUi < betGoldAmount) {
    const solBalance =
      (await connection.getBalance(authority.publicKey, "confirmed")) /
      LAMPORTS_PER_SOL;
    if (solBalance < betSolAmount + 0.01) {
      throw new Error(
        `Insufficient balances for public e2e. GOLD=${goldBalanceUi.toFixed(6)}, SOL=${solBalance.toFixed(6)}`,
      );
    }
    placeBetPayAsset = "SOL";
    placeBetAmount = betSolAmount.toString();
  }

  const uniqueBase = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const resolvedMatchId = uniqueBase;
  const currentMatchId = uniqueBase + 1;

  const resolved = deriveMarketAddresses(
    fightProgram.programId,
    resolvedMatchId,
  );

  await fight.methods
    .createMatch(
      new BN(resolvedMatchId),
      new BN(resolvedWindowSeconds),
      JSON.stringify({
        agent1: "E2E Resolved Agent A",
        agent2: "E2E Resolved Agent B",
      }),
    )
    .accountsPartial({
      authority: authority.publicKey,
      oracleConfig: oracleConfigPda,
      matchResult: resolved.matchPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await sleep((resolvedWindowSeconds + 3) * 1000);

  try {
    await fight.methods
      .postResult({ yes: {} }, new BN(42), Array.from(new Uint8Array(32)))
      .accountsPartial({
        authority: authority.publicKey,
        oracleConfig: oracleConfigPda,
        matchResult: resolved.matchPda,
      })
      .rpc();
  } catch (error) {
    if (!isAlreadyResolvedRace(error)) throw error;
  }

  const current = deriveMarketAddresses(fightProgram.programId, currentMatchId);
  await fight.methods
    .createMatch(
      new BN(currentMatchId),
      new BN(betWindowSeconds),
      JSON.stringify({
        agent1: "E2E Active Agent A",
        agent2: "E2E Active Agent B",
      }),
    )
    .accountsPartial({
      authority: authority.publicKey,
      oracleConfig: oracleConfigPda,
      matchResult: current.matchPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const envLines = [
    `VITE_SOLANA_CLUSTER=${cluster}`,
    `VITE_SOLANA_RPC_URL=${rpcUrl}`,
    `VITE_SOLANA_WS_URL=${wsUrl}`,

    `VITE_FIGHT_ORACLE_PROGRAM_ID=${fightProgram.programId.toBase58()}`,
    `VITE_GOLD_MINT=${goldMint.toBase58()}`,
    `VITE_ACTIVE_MATCH_ID=${currentMatchId}`,
    `VITE_BET_WINDOW_SECONDS=${betWindowSeconds}`,
    `VITE_NEW_ROUND_BET_WINDOW_SECONDS=${betWindowSeconds}`,
    `VITE_AUTO_SEED_DELAY_SECONDS=${autoSeedDelaySeconds}`,
    `VITE_MARKET_MAKER_SEED_GOLD=${seedGold}`,
    `VITE_BET_FEE_BPS=${betFeeBps}`,
    `VITE_GOLD_DECIMALS=${goldDecimals}`,
    "VITE_REFRESH_INTERVAL_MS=2000",
    "VITE_ENABLE_AUTO_SEED=false",
    `VITE_HEADLESS_WALLET_SECRET_KEY=${secretCsv}`,
    `VITE_HEADLESS_WALLET_NAME=E2E Wallet (${cluster})`,
    "VITE_HEADLESS_WALLET_AUTO_CONNECT=true",
  ];

  await fs.writeFile(envPath, `${envLines.join("\n")}\n`, "utf8");

  const state: SetupState = {
    mode: "public",
    cluster,
    solanaRpcUrl: rpcUrl,
    authority: authority.publicKey.toBase58(),
    goldMint: goldMint.toBase58(),
    goldTokenProgram: goldTokenProgram.toBase58(),
    currentMatchId,
    currentMatchPda: current.matchPda.toBase58(),
    lastResolvedMatchId: resolvedMatchId,
    expectedSeedSuccess,
    canStartNewRound: true,
    placeBetPayAsset,
    placeBetAmount,
    placeBetSide: "YES",
    currentBetWindowSeconds: betWindowSeconds,
  };

  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        cluster,
        rpcUrl,
        authority: authority.publicKey.toBase58(),
        goldMint: goldMint.toBase58(),
        expectedSeedSuccess,
        placeBetPayAsset,
        placeBetAmount,
        currentMatchId,
        lastResolvedMatchId: resolvedMatchId,
      },
      null,
      2,
    ),
  );
}

void main();
