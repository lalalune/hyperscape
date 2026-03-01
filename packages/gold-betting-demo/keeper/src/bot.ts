/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from "bn.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  baseUnitsFromGold,
  createPrograms,
  detectTokenProgramForMint,
  enumIs,
  findAnyTokenAccountForMint,
  findMatchPda,
  findOracleConfigPda,
  readKeypair,
  requireEnv,
} from "./common";
import { simulateFight } from "./fight";

function asNum(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTxSignature(error: unknown): string | null {
  const message = (error as Error)?.message ?? "";
  const match = message.match(/signature\s+([1-9A-HJ-NP-Za-km-z]{32,88})/i);
  return match?.[1] ?? null;
}

function isIgnorableRaceError(error: unknown): boolean {
  const message = (error as Error)?.message ?? "";
  return (
    message.includes("MarketNotOpen") ||
    message.includes("BettingClosed") ||
    message.includes("MarketAlreadyResolved") ||
    message.includes("OracleNotResolved") ||
    message.includes("MatchAlreadyResolved") ||
    message.includes("BetWindowStillOpen") ||
    message.includes("MarketAlreadyHasUserBets") ||
    message.includes("LiquidityAlreadySeeded") ||
    message.includes("SeedWindowNotReached")
  );
}

function isFundingError(error: unknown): boolean {
  const message = ((error as Error)?.message ?? "").toLowerCase();
  return (
    message.includes(
      "attempt to debit an account but found no record of a prior credit",
    ) ||
    message.includes("insufficient funds") ||
    message.includes("insufficient lamports") ||
    message.includes("fee payer")
  );
}

async function waitForTxBySignature(
  connection: any,
  signature: string,
  timeoutMs = 90_000,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statuses.value[0];
    if (status) {
      if (status.err) return false;
      if (status.confirmationStatus) return true;
    }
    await sleep(2_000);
  }
  return false;
}

async function runWithRecovery<T>(
  fn: () => Promise<T>,
  connection: any,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const signature = extractTxSignature(error);
    if (!signature) throw error;
    const ok = await waitForTxBySignature(connection, signature);
    if (!ok) throw error;
    return undefined as T;
  }
}

const args = await yargs(hideBin(process.argv))
  .option("once", {
    type: "boolean",
    default: process.env.BOT_LOOP !== "true",
    describe: "Run one cycle and exit",
  })
  .option("poll-seconds", {
    type: "number",
    default: Number(process.env.BOT_POLL_SECONDS || 5),
    describe: "Delay between loop cycles",
  })
  .option("bet-window-seconds", {
    type: "number",
    default: Number(process.env.BET_WINDOW_SECONDS || 300),
    describe: "Bet window for newly created rounds",
  })
  .option("auto-seed-delay-seconds", {
    type: "number",
    default: Number(process.env.AUTO_SEED_DELAY_SECONDS || 10),
    describe: "Auto-seed delay for new markets",
  })
  .option("seed-gold", {
    type: "number",
    default: Number(process.env.MARKET_MAKER_SEED_GOLD || 1),
    describe: "Target seed GOLD on each side",
  })
  .option("fee-bps", {
    type: "number",
    default: undefined,
    describe: "Legacy total trade fee in basis points (deprecated)",
  })
  .option("trade-treasury-fee-bps", {
    type: "number",
    default: Number(process.env.TRADE_TREASURY_FEE_BPS || 100),
    describe: "Trade fee in basis points routed to treasury wallet",
  })
  .option("trade-market-maker-fee-bps", {
    type: "number",
    default: Number(process.env.TRADE_MARKET_MAKER_FEE_BPS || 100),
    describe: "Trade fee in basis points routed to market maker wallet",
  })
  .option("winnings-market-maker-fee-bps", {
    type: "number",
    default: Number(process.env.WINNINGS_MARKET_MAKER_FEE_BPS || 200),
    describe: "Winnings fee in basis points routed to market maker wallet",
  })
  .option("market-mint", {
    type: "string",
    // Default to native SOL (WSOL) - markets use native token of each chain
    default:
      process.env.MARKET_MINT || "So11111111111111111111111111111111111111112",
    describe: "Token mint for markets (defaults to WSOL/native token)",
  })
  .option("game-url", {
    type: "string",
    default: process.env.GAME_URL || "http://localhost:3000",
    describe: "URL of the Hyperscape game server",
  })
  .strict()
  .parse();

import { GameClient } from "./game-client";

import { Program } from "@coral-xyz/anchor";
import { type FightOracle } from "../../anchor/target/types/fight_oracle";
import { type GoldClobMarket } from "../../anchor/target/types/gold_clob_market";
import { type GoldPerpsMarket } from "../../anchor/target/types/gold_perps_market";
import {
  updateRatings,
  calculateSpotIndex,
  createInitialRating,
  type AgentRating,
} from "./trueskill";
import path from "node:path";
import fs_node from "node:fs";

const botKeypair = readKeypair(
  process.env.BOT_KEYPAIR ||
    process.env.ORACLE_AUTHORITY_KEYPAIR ||
    process.env.MARKET_MAKER_KEYPAIR ||
    requireEnv("ORACLE_AUTHORITY_KEYPAIR"),
);
const { connection, fightOracle, goldClobMarket, goldPerpsMarket } =
  createPrograms(botKeypair);
const fightProgram = fightOracle as Program<FightOracle>;
const marketProgram = goldClobMarket as Program<GoldClobMarket>;
const perpsProgram = goldPerpsMarket as Program<GoldPerpsMarket>;

function hasProgramMethod(program: any, method: string): boolean {
  return typeof program?.methods?.[method] === "function";
}

const RATINGS_FILE = path.resolve(__dirname, "agent_ratings.json");
let agentRatings: Record<string, AgentRating> = {};
if (fs_node.existsSync(RATINGS_FILE)) {
  try {
    agentRatings = JSON.parse(fs_node.readFileSync(RATINGS_FILE, "utf8"));
  } catch (e) {
    console.error("Failed to load ratings", e);
  }
}

function saveRatings() {
  fs_node.writeFileSync(RATINGS_FILE, JSON.stringify(agentRatings, null, 2));
}

function getRating(agentId: string): AgentRating {
  if (!agentRatings[agentId]) {
    agentRatings[agentId] = createInitialRating();
  }
  return agentRatings[agentId];
}

// Perps oracle updates are disabled - the Gold Perps Market program is not deployed on devnet
// Set ENABLE_PERPS_ORACLE=true to re-enable once deployed
const PERPS_ORACLE_ENABLED = process.env.ENABLE_PERPS_ORACLE === "true";

async function updatePerpsOracle(agentId: string, rating: AgentRating) {
  // Skip if perps oracle is disabled (program not deployed)
  if (!PERPS_ORACLE_ENABLED) return;

  try {
    const numericAgentId = parseInt(agentId) || 0;
    if (numericAgentId === 0) return;

    const spotIndex = calculateSpotIndex(rating);
    const spotIndexScaled = new BN(Math.floor(spotIndex * 1_000_000));
    const muScaled = new BN(Math.floor(rating.mu * 1_000_000));
    const sigmaScaled = new BN(Math.floor(rating.sigma * 1_000_000));

    const oraclePda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("oracle"),
        new BN(numericAgentId).toArrayLike(Buffer, "le", 4),
      ],
      perpsProgram.programId,
    )[0];

    await runWithRecovery(
      () =>
        perpsProgram.methods
          .updateOracle(numericAgentId, spotIndexScaled, muScaled, sigmaScaled)
          // @ts-ignore - Anchor IDL resolves PDA accounts automatically
          .accounts({
            oracle: oraclePda,
            authority: botKeypair.publicKey,
          })
          .rpc(),
      connection,
    );
    console.log(
      "[Keeper] Updated Perps Oracle for agent",
      agentId,
      "to spot",
      spotIndex,
    );
  } catch (e) {
    console.error("Failed to update perps oracle", e);
  }
}

const missingKeeperMethods: string[] = [];
for (const method of ["initializeOracle", "createMatch", "postResult"]) {
  if (!hasProgramMethod(fightProgram, method)) {
    missingKeeperMethods.push(`fightOracle.${method}`);
  }
}
for (const method of [
  "initializeConfig",
  "initializeMatch",
  "initializeOrderBook",
  "resolveMatch",
]) {
  if (!hasProgramMethod(marketProgram, method)) {
    missingKeeperMethods.push(`goldClobMarket.${method}`);
  }
}

const keeperProgramApiReady = missingKeeperMethods.length === 0;
let warnedMissingKeeperMethods = false;

function warnMissingKeeperMethodsOnce(): void {
  if (keeperProgramApiReady || warnedMissingKeeperMethods) return;
  warnedMissingKeeperMethods = true;
  console.warn(
    `[bot] keeper disabled: IDL/program methods missing (${missingKeeperMethods.join(", ")}).`,
  );
}

const botCluster = (
  process.env.SOLANA_CLUSTER ||
  process.env.CLUSTER ||
  "mainnet-beta"
)
  .toLowerCase()
  .trim();
const minSignerLamports = Math.max(
  5_000,
  Number(process.env.BOT_MIN_BALANCE_LAMPORTS || 100_000),
);
const fundingBackoffMs = Math.max(
  10_000,
  Number(process.env.BOT_FUNDING_CHECK_COOLDOWN_MS || 60_000),
);
const airdropRateLimitCooldownMs = Math.max(
  fundingBackoffMs,
  Number(process.env.BOT_AIRDROP_RATE_LIMIT_COOLDOWN_MS || 15 * 60 * 1000),
);
let fundingBlockedUntil = 0;
let lastFundingWarningAt = 0;
let airdropBlockedUntil = 0;

const oracleConfigPda = findOracleConfigPda(fightOracle.programId);
const marketConfigPda = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  goldClobMarket.programId,
)[0];

// Market mint defaults to WSOL (native token) - always available
const marketMint = new PublicKey(args["market-mint"]);

const legacyFeeBps = Number(args["fee-bps"]);
const tradeTreasuryFeeBps = Number.isFinite(legacyFeeBps)
  ? Math.max(0, Math.floor(legacyFeeBps / 2))
  : Math.max(0, Math.floor(Number(args["trade-treasury-fee-bps"])));
const tradeMarketMakerFeeBps = Number.isFinite(legacyFeeBps)
  ? Math.max(0, Math.ceil(legacyFeeBps / 2))
  : Math.max(0, Math.floor(Number(args["trade-market-maker-fee-bps"])));
const winningsMarketMakerFeeBps = Number.isFinite(legacyFeeBps)
  ? Math.max(0, Math.floor(legacyFeeBps))
  : Math.max(0, Math.floor(Number(args["winnings-market-maker-fee-bps"])));
const configuredTradeTreasuryWallet = process.env.TRADE_TREASURY_WALLET
  ? new PublicKey(process.env.TRADE_TREASURY_WALLET)
  : botKeypair.publicKey;
const configuredTradeMarketMakerWallet = process.env.TRADE_MARKET_MAKER_WALLET
  ? new PublicKey(process.env.TRADE_MARKET_MAKER_WALLET)
  : botKeypair.publicKey;

const canRequestAirdrop =
  botCluster === "testnet" ||
  botCluster === "devnet" ||
  botCluster === "localnet";

async function ensureBotSignerFunding(): Promise<boolean> {
  const now = Date.now();
  if (now < fundingBlockedUntil) {
    return false;
  }

  let lamports = await connection.getBalance(botKeypair.publicKey, "confirmed");
  if (lamports >= minSignerLamports) {
    return true;
  }

  if (canRequestAirdrop && now >= airdropBlockedUntil) {
    try {
      const airdropSig = await connection.requestAirdrop(
        botKeypair.publicKey,
        1 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(airdropSig, "confirmed");
      lamports = await connection.getBalance(botKeypair.publicKey, "confirmed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimited =
        message.includes("429") || /too many requests/i.test(message);
      if (isRateLimited) {
        airdropBlockedUntil = Date.now() + airdropRateLimitCooldownMs;
      }
      if (Date.now() - lastFundingWarningAt > 10_000) {
        console.warn(`[bot] airdrop attempt failed: ${message}`);
        if (isRateLimited) {
          console.warn(
            `[bot] faucet rate-limited; pausing airdrop attempts for ${Math.round(
              airdropRateLimitCooldownMs / 1000,
            )}s`,
          );
        }
        lastFundingWarningAt = Date.now();
      }
    }
  }

  if (lamports >= minSignerLamports) {
    return true;
  }

  if (Date.now() - lastFundingWarningAt > 10_000) {
    console.warn(
      `[bot] bot wallet ${botKeypair.publicKey.toBase58()} has ${(
        lamports / LAMPORTS_PER_SOL
      ).toFixed(
        6,
      )} SOL (< ${(minSignerLamports / LAMPORTS_PER_SOL).toFixed(6)} required). ` +
        `Skipping keeper cycle for ${Math.round(fundingBackoffMs / 1000)}s.`,
    );
    lastFundingWarningAt = Date.now();
  }
  fundingBlockedUntil = Date.now() + fundingBackoffMs;
  return false;
}

const ensureOracleReady = async (): Promise<void> => {
  await runWithRecovery(
    () =>
      fightProgram.methods
        .initializeOracle()
        .accounts({
          authority: botKeypair.publicKey,
        })
        .rpc(),
    connection,
  );

  const config = await fightProgram.account.oracleConfig.fetch(oracleConfigPda);
  if (!(config.authority as PublicKey).equals(botKeypair.publicKey)) {
    throw new Error(
      `Bot wallet ${botKeypair.publicKey.toBase58()} is not oracle authority`,
    );
  }
};

const ensureMarketConfigReady = async (
  tokenMint: PublicKey,
): Promise<PublicKey> => {
  const existingConfig =
    await marketProgram.account.marketConfig.fetchNullable(marketConfigPda);
  if (!existingConfig) {
    const treasuryToken = await findAnyTokenAccountForMint(
      connection,
      configuredTradeTreasuryWallet,
      tokenMint,
    );
    const marketMakerToken = await findAnyTokenAccountForMint(
      connection,
      configuredTradeMarketMakerWallet,
      tokenMint,
    );
    const treasuryTokenAccount =
      treasuryToken.tokenAccount ?? configuredTradeTreasuryWallet;
    const marketMakerTokenAccount =
      marketMakerToken.tokenAccount ?? configuredTradeMarketMakerWallet;

    await runWithRecovery(
      () =>
        marketProgram.methods
          .initializeConfig(
            treasuryTokenAccount,
            marketMakerTokenAccount,
            tradeTreasuryFeeBps,
            tradeMarketMakerFeeBps,
            winningsMarketMakerFeeBps,
          )
          .accounts({
            authority: botKeypair.publicKey,
          })
          .rpc(),
      connection,
    );
    console.log(
      `[bot] CLOB market config initialized at ${marketConfigPda.toBase58()}`,
    );
  } else {
    console.log(
      `[bot] CLOB market config already exists at ${marketConfigPda.toBase58()}`,
    );
  }

  return await detectTokenProgramForMint(connection, tokenMint);
};

async function getMatchState(matchPda: PublicKey): Promise<any | null> {
  return fightProgram.account.matchResult.fetchNullable(matchPda);
}

async function getClobMatchState(
  matchStatePda: PublicKey,
): Promise<any | null> {
  return marketProgram.account.matchState.fetchNullable(matchStatePda);
}

async function createRound(
  _tokenMint: PublicKey, // Market token mint (WSOL by default)
  _tokenProgram: PublicKey,
  matchIdInput: number,
  metadata: string,
): Promise<{
  matchId: number;
  matchPda: PublicKey;
  matchStateKeypair: Keypair;
}> {
  const matchId = matchIdInput;
  const matchPda = findMatchPda(fightOracle.programId, new BN(matchId));

  await runWithRecovery(
    () =>
      fightProgram.methods
        .createMatch(
          new BN(matchId),
          new BN(args["bet-window-seconds"]),
          metadata,
        )
        .accounts({
          authority: botKeypair.publicKey,
          matchResult: matchPda,
        })
        .rpc(),
    connection,
  );

  const matchStateKeypair = Keypair.generate();
  const vaultAuthorityPda = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_auth"), matchStateKeypair.publicKey.toBuffer()],
    goldClobMarket.programId,
  )[0];

  await runWithRecovery(
    () =>
      marketProgram.methods
        .initializeMatch(500)
        .accounts({
          matchState: matchStateKeypair.publicKey,
          user: botKeypair.publicKey,
        })
        .signers([matchStateKeypair])
        .rpc(),
    connection,
  );

  const orderBookKeypair = Keypair.generate();
  await runWithRecovery(
    () =>
      marketProgram.methods
        .initializeOrderBook()
        .accounts({
          user: botKeypair.publicKey,
          matchState: matchStateKeypair.publicKey,
          orderBook: orderBookKeypair.publicKey,
        })
        .signers([orderBookKeypair])
        .rpc(),
    connection,
  );

  console.log(
    `[bot] CLOB match: ${matchStateKeypair.publicKey.toBase58()}, book: ${orderBookKeypair.publicKey.toBase58()}`,
  );
  return { matchId, matchPda, matchStateKeypair };
}

async function maybeSeedMarket(
  _marketPda: PublicKey,
  _market: any,
): Promise<void> {
  // CLOB markets don't need seeding — users place limit orders directly
  return;
}

async function maybeResolveMatch(
  matchPda: PublicKey,
  matchState: any,
): Promise<void> {
  if (!enumIs(matchState.status, "open")) return;
  const now = Math.floor(Date.now() / 1000);
  if (now < asNum(matchState.betCloseTs)) return;

  const fight = simulateFight(BigInt(Date.now()));
  try {
    await runWithRecovery(
      () =>
        fightProgram.methods
          .postResult(
            fight.winner === "A" ? ({ yes: {} } as any) : ({ no: {} } as any),
            new BN(fight.seed.toString()),
            Array.from(fight.replayHash),
          )
          .accounts({
            authority: botKeypair.publicKey,
            matchResult: matchPda,
          })
          .rpc(),
      connection,
    );
  } catch (error) {
    if (isIgnorableRaceError(error)) return;
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        action: "oracle_posted",
        match: matchPda.toBase58(),
      },
      null,
      2,
    ),
  );
}

const activeClobMatches = new Map<number, PublicKey>();

async function maybeResolveMarket(
  matchPda: PublicKey,
  duelId?: number,
): Promise<void> {
  if (!duelId) return;
  const matchStatePubkey = activeClobMatches.get(duelId);
  if (!matchStatePubkey) return;

  const clobMatch = await getClobMatchState(matchStatePubkey);
  if (!clobMatch || !clobMatch.isOpen) return;

  const oracleMatch = await getMatchState(matchPda);
  if (!oracleMatch || !enumIs(oracleMatch.status, "resolved")) return;

  const winner = enumIs(oracleMatch.result, "yes") ? 1 : 2;

  try {
    await runWithRecovery(
      () =>
        marketProgram.methods
          .resolveMatch(
            winner === 1 ? ({ yes: {} } as any) : ({ no: {} } as any),
          )
          .accounts({
            matchState: matchStatePubkey,
            authority: botKeypair.publicKey,
          })
          .rpc(),
      connection,
    );
  } catch (error) {
    if (isIgnorableRaceError(error)) return;
    throw error;
  }

  activeClobMatches.delete(duelId);
  console.log(
    JSON.stringify(
      {
        action: "clob_resolved",
        matchState: matchStatePubkey.toBase58(),
        winner,
      },
      null,
      2,
    ),
  );
}

// Event-driven Logic
const gameClient = new GameClient(args["game-url"]);

gameClient.onDuelStart(async (data: any) => {
  if (!keeperProgramApiReady) {
    warnMissingKeeperMethodsOnce();
    return;
  }

  if (!(await ensureBotSignerFunding())) {
    console.warn(
      "[bot] Skipping duel-start market creation because bot signer funding is below threshold.",
    );
    return;
  }

  console.log("Duel Started:", data);
  try {
    // The game server now outputs strict numeric IDs that map natively to u64
    const numericMatchId = asNum(data.duelId);
    if (!numericMatchId) {
      console.warn(
        "Skipping market creation: received non-numeric or empty duelId:",
        data.duelId,
      );
      return;
    }

    const metadata = JSON.stringify({
      agent1: data.agent1?.name || "Agent A",
      agent2: data.agent2?.name || "Agent B",
    });

    // Markets use native token (WSOL on Solana)
    const tokenProgram = await ensureMarketConfigReady(marketMint);
    const result = await createRound(
      marketMint,
      tokenProgram,
      numericMatchId,
      metadata,
    );
    activeClobMatches.set(numericMatchId, result.matchStateKeypair.publicKey);
    console.log(`Created CLOB market for duel ${numericMatchId}`);
  } catch (err) {
    console.error("Failed to create market for duel:", err);
  }
});

gameClient.onDuelEnd(async (data: any) => {
  if (!keeperProgramApiReady) {
    warnMissingKeeperMethodsOnce();
    return;
  }

  if (!(await ensureBotSignerFunding())) {
    console.warn(
      "[bot] Skipping duel-end resolution because bot signer funding is below threshold.",
    );
    return;
  }

  console.log("Duel Ended:", data);
  try {
    const numericMatchId = asNum(data.duelId); // Must match creation ID
    if (!numericMatchId) return;

    const matchPda = findMatchPda(
      fightOracle.programId,
      new BN(numericMatchId),
    );
    // We need to resolve it.
    // postResult takes winner, seed, replayHash.
    // We need these from data.
    // data.winner should be "agent1" or "agent2" or ID.

    const winnerId = data.winnerId;
    const isAgent1 = winnerId === data.agent1?.id;
    const winnerSide = isAgent1 ? "A" : "B";

    // Update TrueSkill Ratings
    if (data.agent1?.id && data.agent2?.id) {
      const uA1 = getRating(data.agent1.id.toString());
      const uA2 = getRating(data.agent2.id.toString());

      const { winner, loser } = updateRatings(
        isAgent1 ? uA1 : uA2,
        isAgent1 ? uA2 : uA1,
      );

      agentRatings[data.agent1.id.toString()] = isAgent1 ? winner : loser;
      agentRatings[data.agent2.id.toString()] = isAgent1 ? loser : winner;
      saveRatings();

      // Push to Solana Perps Oracle
      await updatePerpsOracle(
        data.agent1.id.toString(),
        agentRatings[data.agent1.id.toString()],
      );
      await updatePerpsOracle(
        data.agent2.id.toString(),
        agentRatings[data.agent2.id.toString()],
      );
    }

    // Use cryptographically secure oracle data emitted by the Game Server
    if (!data.seed || !data.replayHash) {
      console.warn(
        `[Keeper] Warning: duel:completed event for ${numericMatchId} is missing seed or replayHash!`,
      );
    }

    const seed = data.seed ? new BN(data.seed) : new BN(Date.now());
    const replayHash = data.replayHash
      ? Buffer.from(data.replayHash, "hex")
      : Buffer.alloc(32);

    console.log(
      `[Keeper] Waiting 15s before posting result for duel ${numericMatchId} to sync with stream...`,
    );
    await sleep(15000);

    await runWithRecovery(
      () =>
        fightProgram.methods
          .postResult(
            winnerSide === "A" ? ({ yes: {} } as any) : ({ no: {} } as any),
            seed,
            Array.from(replayHash),
          )
          .accounts({
            authority: botKeypair.publicKey,
            matchResult: matchPda,
          })
          .rpc(),
      connection,
    );

    await maybeResolveMarket(matchPda, numericMatchId);
    console.log(`Resolved market for duel ${numericMatchId}`);
  } catch (err) {
    console.error("Failed to resolve market:", err);
  }
});

gameClient.connect();

// Maintenance Loop (Seeding & Cleanup)
async function runMaintenance(): Promise<void> {
  if (!keeperProgramApiReady) {
    warnMissingKeeperMethodsOnce();
    return;
  }

  if (!(await ensureBotSignerFunding())) {
    return;
  }
  await ensureOracleReady();
  // ... (simplified loop for seeing liquidity and resolving old markets)

  const now = Math.floor(Date.now() / 1000);

  // Poll only the actively tracked CLOB matches we created
  for (const [
    numericMatchId,
    matchStatePubkey,
  ] of activeClobMatches.entries()) {
    const matchPda = findMatchPda(
      fightOracle.programId,
      new BN(numericMatchId),
    );

    // First Ensure oracle is resolved (which will then resolve CLOB)
    const oracleMatch = await getMatchState(matchPda);
    if (!oracleMatch) continue;

    if (enumIs(oracleMatch.status, "open")) {
      await maybeResolveMatch(matchPda, oracleMatch);
    } else if (enumIs(oracleMatch.status, "resolved")) {
      await maybeResolveMarket(matchPda, numericMatchId);
    }
  }

  // NOTE: We do NOT create new rounds here anymore.
}

for (;;) {
  try {
    await runMaintenance();
  } catch (error) {
    if (isFundingError(error)) {
      fundingBlockedUntil = Date.now() + fundingBackoffMs;
    }
    console.error(`[bot] cycle failed: ${(error as Error).message}`);
  }

  if (args.once) break;
  await sleep(args["poll-seconds"] * 1_000);
}
