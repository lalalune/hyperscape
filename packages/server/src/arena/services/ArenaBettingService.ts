import { eq } from "drizzle-orm";
import type { ArenaContext } from "../ArenaContext.js";
import {
  normalizeWallet,
  normalizeSide,
  normalizeFeeChain,
  normalizeWalletForChain,
  sha256Hex,
  randomId,
} from "../arena-utils.js";
import {
  parseDecimalToBaseUnits,
  formatBaseUnitsToDecimal,
} from "../amounts.js";
import * as schema from "../../database/schema.js";
import type {
  BetQuoteRequest,
  BetQuoteResponse,
  ClaimBuildRequest,
  ClaimBuildResponse,
  DepositAddressResponse,
  IngestDepositRequest,
  IngestDepositResponse,
  ArenaSide,
  ArenaFeeChain,
  ArenaRoundSnapshot,
  ReferralInfo,
} from "../types.js";

export interface RoundOps {
  getRound(roundId: string): ArenaRoundSnapshot | null;
  getCurrentRound(): ArenaRoundSnapshot | null;
  updateCurrentRoundPool(
    roundId: string,
    side: "A" | "B",
    goldAmount: string,
  ): Promise<void>;
  persistRoundEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}

export interface PointsOps {
  awardPoints(params: {
    wallet: string;
    roundId: string | null;
    roundSeedHex: string | null;
    betId: string;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    goldAmount: string;
    txSignature: string | null;
    side: "A" | "B";
    verifiedForPoints: boolean;
    chain?: ArenaFeeChain;
    referral: ReferralInfo | null;
  }): Promise<void>;
  recordFeeShare(params: {
    roundId: string | null;
    betId: string;
    bettorWallet: string;
    goldAmount: string;
    feeBps: number;
    chain: ArenaFeeChain;
    referral: ReferralInfo | null;
  }): Promise<boolean>;
}

export interface WalletOps {
  resolveReferralForWallet(params: {
    wallet: string;
    betId: string;
    inviteCode: string | null;
  }): Promise<ReferralInfo | null>;
}

export class ArenaBettingService {
  private readonly ctx: ArenaContext;
  private readonly roundOps: RoundOps;
  private readonly pointsOps: PointsOps;
  private readonly walletOps: WalletOps;

  constructor(
    ctx: ArenaContext,
    roundOps: RoundOps,
    pointsOps: PointsOps,
    walletOps: WalletOps,
  ) {
    this.ctx = ctx;
    this.roundOps = roundOps;
    this.pointsOps = pointsOps;
    this.walletOps = walletOps;
  }

  public async buildBetQuote(
    request: BetQuoteRequest,
  ): Promise<BetQuoteResponse> {
    const round = this.roundOps.getRound(request.roundId);
    if (!round) {
      throw new Error("Round not found");
    }
    if (!round.market) {
      throw new Error("Market not initialized for round");
    }

    if (round.phase !== "BET_OPEN" && round.phase !== "BET_LOCK") {
      throw new Error("Betting is currently closed");
    }

    const side = normalizeSide(request.side);
    const sourceAsset = request.sourceAsset;
    const sourceAmount = request.sourceAmount.trim();
    if (!sourceAmount || Number(sourceAmount) <= 0) {
      throw new Error("sourceAmount must be > 0");
    }

    if (sourceAsset === "GOLD") {
      const amountGoldUnits = parseDecimalToBaseUnits(sourceAmount, 6);
      if (amountGoldUnits <= 0n) {
        throw new Error("sourceAmount converted to zero");
      }
      return {
        roundId: round.id,
        side,
        sourceAsset,
        sourceAmount,
        expectedGoldAmount: formatBaseUnitsToDecimal(amountGoldUnits, 6),
        minGoldAmount: formatBaseUnitsToDecimal(amountGoldUnits, 6),
        swapQuote: null,
        market: round.market,
      };
    }

    const inputMint =
      sourceAsset === "SOL"
        ? this.ctx.solanaConfig.solMint
        : this.ctx.solanaConfig.usdcMint;
    const decimals = sourceAsset === "SOL" ? 9 : 6;
    const amountRaw = parseDecimalToBaseUnits(sourceAmount, decimals);
    if (amountRaw <= 0n) throw new Error("sourceAmount converted to zero");

    const quoteUrl = new URL(this.ctx.solanaConfig.jupiterQuoteUrl);
    quoteUrl.searchParams.set("inputMint", inputMint);
    quoteUrl.searchParams.set("outputMint", this.ctx.solanaConfig.goldMint);
    quoteUrl.searchParams.set("amount", amountRaw.toString());
    quoteUrl.searchParams.set("slippageBps", "100");

    const response = await fetch(quoteUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.status}`);
    }

    const quote = (await response.json()) as Record<string, unknown> & {
      outAmount?: string;
      otherAmountThreshold?: string;
    };
    const outAmount = BigInt(quote.outAmount ?? "0");
    const minAmount = BigInt(quote.otherAmountThreshold ?? "0");
    if (outAmount <= 0n) {
      throw new Error("No GOLD output available for selected asset");
    }

    return {
      roundId: round.id,
      side,
      sourceAsset,
      sourceAmount,
      expectedGoldAmount: formatBaseUnitsToDecimal(outAmount, 6),
      minGoldAmount: formatBaseUnitsToDecimal(minAmount, 6),
      swapQuote: quote,
      market: round.market,
    };
  }

  public async recordBet(params: {
    roundId: string;
    bettorWallet: string;
    side: ArenaSide;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    sourceAmount: string;
    goldAmount: string;
    txSignature?: string | null;
    quoteJson?: Record<string, unknown> | null;
    skipPoints?: boolean;
    inviteCode?: string | null;
    verifiedForPoints?: boolean;
    chain?: ArenaFeeChain;
  }): Promise<string> {
    const round = this.roundOps.getRound(params.roundId);
    if (!round || !round.market) {
      throw new Error("Round or market not found");
    }
    if (round.phase !== "BET_OPEN" && round.phase !== "BET_LOCK") {
      throw new Error("Betting is currently closed");
    }

    const goldUnits = parseDecimalToBaseUnits(params.goldAmount, 6);
    if (goldUnits <= 0n) {
      throw new Error("goldAmount must be > 0");
    }
    if (
      this.ctx.config.maxBetGoldUnits > 0n &&
      goldUnits > this.ctx.config.maxBetGoldUnits
    ) {
      throw new Error(
        `Bet exceeds maximum allowed (${formatBaseUnitsToDecimal(this.ctx.config.maxBetGoldUnits, 6)} GOLD)`,
      );
    }

    const db = this.ctx.getDb();
    if (!db) return randomId("bet");

    const id = randomId("bet");
    const normalizedSide = normalizeSide(params.side);
    const bettorWallet = normalizeWallet(params.bettorWallet);
    try {
      await db.insert(schema.solanaBets).values({
        id,
        roundId: params.roundId,
        bettorWallet,
        side: normalizedSide,
        sourceAsset: params.sourceAsset,
        sourceAmount: params.sourceAmount,
        goldAmount: params.goldAmount,
        quoteJson: params.quoteJson ?? null,
        txSignature: params.txSignature ?? null,
        status: params.txSignature ? "SUBMITTED" : "PENDING",
      });

      const referral = await this.walletOps.resolveReferralForWallet({
        wallet: bettorWallet,
        betId: id,
        inviteCode: params.inviteCode ?? null,
      });

      await this.roundOps.updateCurrentRoundPool(
        params.roundId,
        normalizedSide,
        params.goldAmount,
      );

      await this.roundOps.persistRoundEvent("BET_RECORDED", {
        roundId: params.roundId,
        betId: id,
        bettorWallet,
        side: normalizedSide,
        sourceAsset: params.sourceAsset,
        sourceAmount: params.sourceAmount,
        goldAmount: params.goldAmount,
        txSignature: params.txSignature ?? null,
        inviteCode: referral?.inviteCode ?? null,
        inviterWallet: referral?.inviterWallet ?? null,
      });

      const feeShareRecorded = await this.pointsOps.recordFeeShare({
        roundId: params.roundId,
        betId: id,
        bettorWallet,
        goldAmount: params.goldAmount,
        feeBps: round.market.feeBps,
        chain: params.chain ?? "SOLANA",
        referral,
      });

      if (!feeShareRecorded) {
        return id;
      }

      if (!params.skipPoints) {
        void this.pointsOps.awardPoints({
          wallet: bettorWallet,
          roundId: params.roundId,
          roundSeedHex: round.roundSeedHex,
          betId: id,
          sourceAsset: params.sourceAsset,
          goldAmount: params.goldAmount,
          txSignature: params.txSignature ?? null,
          side: normalizedSide,
          verifiedForPoints: params.verifiedForPoints === true,
          referral,
        });
      }
    } catch (error) {
      this.ctx.logDbWriteError("record bet", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
    return id;
  }

  public async recordExternalBet(params: {
    bettorWallet: string;
    chain: ArenaFeeChain;
    sourceAsset: "GOLD" | "SOL" | "USDC" | "BNB" | "ETH" | "AVAX";
    sourceAmount: string;
    goldAmount: string;
    feeBps: number;
    txSignature?: string | null;
    inviteCode?: string | null;
    externalBetRef?: string | null;
    marketPda?: string | null;
    skipPoints?: boolean;
  }): Promise<string> {
    const goldUnits = parseDecimalToBaseUnits(params.goldAmount, 6);
    if (goldUnits <= 0n) {
      throw new Error("goldAmount must be > 0");
    }
    if (
      this.ctx.config.maxBetGoldUnits > 0n &&
      goldUnits > this.ctx.config.maxBetGoldUnits
    ) {
      throw new Error(
        `Bet exceeds maximum allowed (${formatBaseUnitsToDecimal(this.ctx.config.maxBetGoldUnits, 6)} GOLD)`,
      );
    }

    const db = this.ctx.getDb();
    if (!db) return randomId("bet");

    const chain = normalizeFeeChain(params.chain);
    const bettorWallet = normalizeWalletForChain(params.bettorWallet, chain);
    const txSignature = params.txSignature?.trim() || null;
    if (!txSignature) {
      throw new Error("txSignature is required for external bet tracking");
    }
    const idempotencyKey = txSignature || params.externalBetRef?.trim() || null;
    const id = idempotencyKey
      ? `bet_ext_${sha256Hex(`external:${chain}:${idempotencyKey}`).slice(0, 24)}`
      : randomId("bet");

    const canAwardExternalPoints = !params.skipPoints && txSignature !== null;
    const queueExternalPointsAward = (
      referral: { inviteCode: string; inviterWallet: string } | null,
    ): void => {
      if (!canAwardExternalPoints) return;
      void (async () => {
        try {
          const existingPoints = await db.query.arenaPoints.findFirst({
            where: eq(schema.arenaPoints.betId, id),
          });
          if (existingPoints) return;
        } catch (error: unknown) {
          this.ctx.logTableMissingError(error);
          return;
        }

        void this.pointsOps
          .awardPoints({
            wallet: bettorWallet,
            roundId: null,
            roundSeedHex: null,
            betId: id,
            sourceAsset: params.sourceAsset,
            goldAmount: params.goldAmount,
            txSignature,
            side: "A",
            verifiedForPoints: false, // MUST inspect EVM transactions on-chain
            chain,
            referral,
          })
          .catch((err) => {
            console.warn(
              `[ArenaService] Failed to award points for external bet ${id}:`,
              err,
            );
          });
      })();
    };

    if (idempotencyKey) {
      const existing = await db.query.arenaFeeShares.findFirst({
        where: eq(schema.arenaFeeShares.betId, id),
      });
      if (existing) {
        queueExternalPointsAward(
          existing.inviteCode && existing.inviterWallet
            ? {
                inviteCode: existing.inviteCode,
                inviterWallet: existing.inviterWallet,
              }
            : null,
        );
        return id;
      }
    }

    try {
      const referral = await this.walletOps.resolveReferralForWallet({
        wallet: bettorWallet,
        betId: id,
        inviteCode: params.inviteCode ?? null,
      });
      const normalizedFeeBps = Math.max(0, Math.floor(params.feeBps));

      const feeShareRecorded = await this.pointsOps.recordFeeShare({
        roundId: null,
        betId: id,
        bettorWallet,
        goldAmount: params.goldAmount,
        feeBps: normalizedFeeBps,
        chain,
        referral,
      });

      if (!feeShareRecorded) {
        return id;
      }

      queueExternalPointsAward(referral);

      return id;
    } catch (error) {
      this.ctx.logDbWriteError("record external bet", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  public buildClaimInfo(request: ClaimBuildRequest): ClaimBuildResponse {
    const round = this.roundOps.getRound(request.roundId);
    if (!round?.market) {
      throw new Error("Round or market not found");
    }
    const positionPda = this.ctx.solanaOperator
      ? this.ctx.solanaOperator.derivePositionPda(
          round.roundSeedHex,
          request.bettorWallet,
        )
      : `position_${sha256Hex(
          `${round.market.marketPda}:${request.bettorWallet}`,
        ).slice(0, 40)}`;
    return {
      roundId: request.roundId,
      roundSeedHex: round.roundSeedHex,
      programId: round.market.programId,
      mint: round.market.mint,
      tokenProgram: round.market.tokenProgram,
      marketPda: round.market.marketPda,
      vaultAta: round.market.vaultAta,
      positionPda,
      winnerSide: round.market.winnerSide,
      bettorWallet: request.bettorWallet,
      manualClaimEnabled: true,
      message:
        "Manual claim is always enabled. Use claim instruction with market/bettor PDAs.",
    };
  }

  public buildDepositAddress(params: {
    roundId: string;
    side: ArenaSide;
  }): DepositAddressResponse {
    const round = this.roundOps.getRound(params.roundId);
    if (!round?.market) {
      throw new Error("Round or market not found");
    }
    const custodyWallet = this.ctx.solanaOperator?.getCustodyWallet();
    const custodyAta = this.ctx.solanaOperator?.getCustodyAta();
    if (!custodyWallet || !custodyAta) {
      throw new Error("Custody wallet is not configured");
    }
    const side = normalizeSide(params.side);
    return {
      roundId: round.id,
      side,
      custodyWallet,
      custodyAta,
      mint: round.market.mint,
      tokenProgram: round.market.tokenProgram,
      memoTemplate: `ARENA:${round.id}:${side}`,
    };
  }

  public async ingestDepositBySignature(
    request: IngestDepositRequest,
  ): Promise<IngestDepositResponse> {
    const round = this.roundOps.getRound(request.roundId);
    if (!round?.market) {
      throw new Error("Round or market not found");
    }
    if (round.phase !== "BET_OPEN" && round.phase !== "BET_LOCK") {
      throw new Error("Betting is currently closed");
    }
    if (!this.ctx.solanaOperator?.isEnabled()) {
      throw new Error("Solana operator is not configured");
    }

    const db = this.ctx.getDb();
    if (db) {
      const existing = await db.query.solanaBets.findFirst({
        where: eq(schema.solanaBets.txSignature, request.txSignature),
      });
      if (existing) {
        const quote = (existing.quoteJson ?? {}) as {
          settleSignature?: string;
          memo?: string | null;
        };
        return {
          roundId: existing.roundId,
          side: existing.side as ArenaSide,
          txSignature: request.txSignature,
          settleSignature: quote.settleSignature ?? request.txSignature,
          bettorWallet: existing.bettorWallet,
          goldAmount: existing.goldAmount,
          betId: existing.id,
        };
      }
    }

    const inspected = await this.ctx.solanaOperator.inspectInboundGoldTransfer(
      request.txSignature,
    );
    if (!inspected) {
      throw new Error("Unable to inspect inbound transfer");
    }
    if (!inspected.fromWallet) {
      throw new Error("Inbound transfer source wallet could not be resolved");
    }
    const side = normalizeSide(request.side);
    const expectedMemo = `ARENA:${round.id}:${side}`;
    if (!inspected.memo) {
      throw new Error(
        `Inbound transfer memo is required. Expected memo: ${expectedMemo}`,
      );
    }
    if (
      inspected.memo !== expectedMemo &&
      !inspected.memo.includes(expectedMemo)
    ) {
      throw new Error(
        `Inbound transfer memo does not match expected value: ${expectedMemo}`,
      );
    }

    const settleSignature = await this.ctx.solanaOperator.placeBetFor({
      roundSeedHex: round.roundSeedHex,
      bettorWallet: inspected.fromWallet,
      side,
      amountGoldBaseUnits: inspected.amountBaseUnits,
    });
    if (!settleSignature) {
      throw new Error("Failed to settle inbound transfer into market");
    }

    const betId = await this.recordBet({
      roundId: round.id,
      bettorWallet: inspected.fromWallet,
      side,
      sourceAsset: "GOLD",
      sourceAmount: inspected.amountGold,
      goldAmount: inspected.amountGold,
      txSignature: request.txSignature,
      verifiedForPoints: true,
      quoteJson: {
        sourceTxSignature: request.txSignature,
        settleSignature,
        memo: inspected.memo,
        sourceWallet: inspected.fromWallet,
        custodyWallet: inspected.toWallet,
      },
    });

    await this.roundOps.persistRoundEvent("DEPOSIT_INGESTED", {
      roundId: round.id,
      side,
      sourceTxSignature: request.txSignature,
      settleSignature,
      bettorWallet: inspected.fromWallet,
      goldAmount: inspected.amountGold,
      memo: inspected.memo,
      betId,
    });

    return {
      roundId: round.id,
      side,
      txSignature: request.txSignature,
      settleSignature,
      bettorWallet: inspected.fromWallet,
      goldAmount: inspected.amountGold,
      betId,
    };
  }
}
