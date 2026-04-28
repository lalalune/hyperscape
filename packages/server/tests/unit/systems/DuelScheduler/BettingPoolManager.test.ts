import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock("../../../../src/database/client.js", () => ({
  getDatabase: databaseMock.getDatabase,
}));

import {
  BettingPoolManager,
  __bettingPoolManagerTestInternals as internals,
} from "../../../../src/systems/DuelScheduler/BettingPoolManager.js";

describe("BettingPoolManager input validation", () => {
  beforeEach(() => {
    databaseMock.getDatabase.mockReset();
  });

  it("accepts bounded positive decimal bet amounts", () => {
    expect(internals.isValidPositiveDecimalAmount("1")).toBe(true);
    expect(internals.isValidPositiveDecimalAmount("0.00000001")).toBe(true);
    expect(
      internals.isValidPositiveDecimalAmount("999999999999999999.12345678"),
    ).toBe(true);
  });

  it("rejects zero, negative, over-precision, and oversized bet amounts", () => {
    for (const amount of [
      "0",
      "0.0",
      "-1",
      "1.123456789",
      "1000000000000000000",
      "1e6",
      "NaN",
      "Infinity",
      "",
    ]) {
      expect(internals.isValidPositiveDecimalAmount(amount), amount).toBe(
        false,
      );
    }
  });

  it("validates Solana-style wallet addresses without accepting malformed strings", () => {
    expect(
      internals.isValidSolanaWalletAddress(
        Keypair.generate().publicKey.toBase58(),
      ),
    ).toBe(true);

    for (const wallet of [
      "",
      "0".repeat(32),
      "O".repeat(32),
      "I".repeat(32),
      "l".repeat(32),
      "short",
      "1".repeat(45),
    ]) {
      expect(internals.isValidSolanaWalletAddress(wallet), wallet).toBe(false);
    }
  });
});

describe("BettingPoolManager.placeBet", () => {
  beforeEach(() => {
    databaseMock.getDatabase.mockReset();
  });

  function createManager(walletBetCount: number) {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const insertedBets: unknown[] = [];
    const tx = {
      execute: vi.fn(async () => ({
        rows: [
          {
            id: "round-1",
            bettingClosesAt: Date.now() + 60_000,
            duelEndsAt: null,
            winnerId: null,
          },
        ],
      })),
      select: vi.fn(() => ({
        from: () => ({
          where: async () => [{ count: walletBetCount }],
        }),
      })),
      insert: vi.fn(() => ({
        values: async (value: unknown) => {
          insertedBets.push(value);
        },
      })),
    };
    const db = {
      transaction: vi.fn(async (callback: (txArg: typeof tx) => unknown) =>
        callback(tx),
      ),
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            groupBy: async () => [],
          }),
        }),
      })),
    };
    databaseMock.getDatabase.mockReturnValue(db);
    const world = {
      duelBettingBridge: {
        getMarket: vi.fn(() => ({ status: "betting" })),
      },
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
      },
    };
    const manager = new BettingPoolManager(world as never);
    return { db, emitted, insertedBets, manager, tx };
  }

  it("places a bet inside the locked round transaction and emits a pool update", async () => {
    const { emitted, insertedBets, manager, tx } = createManager(0);
    const walletAddress = Keypair.generate().publicKey.toBase58();

    const result = await manager.placeBet({
      roundId: "round-1",
      side: "A",
      amount: "1.25",
      walletAddress,
    });

    expect(result.success).toBe(true);
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.select).toHaveBeenCalledOnce();
    expect(insertedBets).toHaveLength(1);
    expect(insertedBets[0]).toMatchObject({
      roundId: "round-1",
      bettorWallet: walletAddress,
      side: "A",
      sourceAmount: "1.25",
      goldAmount: "1.25",
      status: "CONFIRMED",
    });
    expect(emitted).toEqual([
      {
        event: "betting:pool:updated",
        payload: {
          roundId: "round-1",
          sideATotal: "0",
          sideBTotal: "0",
          sideACount: 0,
          sideBCount: 0,
        },
      },
    ]);
  });

  it("rejects per-wallet round spam before inserting another bet", async () => {
    const { insertedBets, manager, tx } = createManager(
      internals.MAX_BETS_PER_WALLET_PER_ROUND,
    );

    const result = await manager.placeBet({
      roundId: "round-1",
      side: "A",
      amount: "1",
      walletAddress: Keypair.generate().publicKey.toBase58(),
    });

    expect(result).toEqual({
      success: false,
      error: "Too many bets for this wallet on this round",
    });
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.select).toHaveBeenCalledOnce();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(insertedBets).toHaveLength(0);
  });
});
