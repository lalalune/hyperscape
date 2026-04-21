import { describe, expect, it, vi } from "vitest";
import {
  __payoutKeeperTestInternals as internals,
  claimDuePayoutJobIds,
} from "../../../../src/systems/DuelScheduler/PayoutKeeper.js";

function extractSqlText(query: unknown): string {
  if (!query || typeof query !== "object" || !("queryChunks" in query)) {
    return "";
  }

  const chunks = (query as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) {
    return "";
  }

  return chunks
    .flatMap((chunk) => {
      if (!chunk || typeof chunk !== "object" || !("value" in chunk)) {
        return [];
      }
      const value = (chunk as { value?: unknown }).value;
      return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
    })
    .join(" ");
}

describe("claimDuePayoutJobIds", () => {
  it("builds a locking claim query with FOR UPDATE SKIP LOCKED", async () => {
    const capturedQueries: string[] = [];
    const tx = {
      execute: async (query: unknown) => {
        capturedQueries.push(extractSqlText(query));
        return { rows: [{ id: "job-1" }] };
      },
    } as Parameters<typeof claimDuePayoutJobIds>[0];

    const claimed = await claimDuePayoutJobIds(tx, 1_000, 1);

    expect(claimed).toEqual(["job-1"]);
    expect(capturedQueries[0]).toContain("FOR UPDATE SKIP LOCKED");
    expect(capturedQueries[0]).toContain('"solana_payout_jobs"');
  });

  it("does not claim the same pending row twice across workers", async () => {
    const dueJobIds = ["job-1", "job-2"];
    const lockedJobIds = new Set<string>();

    const createTx = (): Parameters<typeof claimDuePayoutJobIds>[0] =>
      ({
        execute: async () => {
          const available = dueJobIds.filter((id) => !lockedJobIds.has(id));
          const claimed = available.slice(0, 1);
          for (const id of claimed) {
            lockedJobIds.add(id);
          }
          return {
            rows: claimed.map((id) => ({ id })),
          };
        },
      }) as Parameters<typeof claimDuePayoutJobIds>[0];

    expect(await claimDuePayoutJobIds(createTx(), 1_000, 1)).toEqual(["job-1"]);
    expect(await claimDuePayoutJobIds(createTx(), 1_000, 1)).toEqual(["job-2"]);
    expect(await claimDuePayoutJobIds(createTx(), 1_000, 1)).toEqual([]);
  });
});

describe("processOneJob", () => {
  function createDb(params: { betSide: "A" | "B"; winnerId: string }): {
    db: Parameters<typeof internals.processOneJob>[0];
    updates: unknown[];
  } {
    let selectCall = 0;
    const updates: unknown[] = [];
    const db = {
      execute: vi.fn(async () => ({
        rows: [{ acquired: true }],
      })),
      select: vi.fn(() => {
        const call = selectCall;
        selectCall += 1;
        if (call === 0) {
          return {
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: "round-1",
                    agentAId: "agent-a",
                    agentBId: "agent-b",
                    winnerId: params.winnerId,
                  },
                ],
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: async () => [
              {
                side: params.betSide,
              },
            ],
          }),
        };
      }),
      update: vi.fn(() => ({
        set: (value: unknown) => {
          updates.push(value);
          return {
            where: () => ({
              returning: async () => [{ id: "job-1" }],
            }),
          };
        },
      })),
    } as Parameters<typeof internals.processOneJob>[0];
    return { db, updates };
  }

  const job = {
    id: "job-1",
    roundId: "round-1",
    bettorWallet: "wallet-1",
    attempts: 0,
  } as Parameters<typeof internals.processOneJob>[1];

  it("marks a winning confirmed bet ready for payout", async () => {
    const { db, updates } = createDb({ betSide: "A", winnerId: "agent-a" });

    await internals.processOneJob(db, job);

    expect(db.execute).toHaveBeenCalledOnce();
    expect(updates).toContainEqual(
      expect.objectContaining({ status: "READY_FOR_PAYOUT" }),
    );
  });

  it("marks losing confirmed bets as no-payout", async () => {
    const { db, updates } = createDb({ betSide: "B", winnerId: "agent-a" });

    await internals.processOneJob(db, job);

    expect(db.execute).toHaveBeenCalledOnce();
    expect(updates).toContainEqual(
      expect.objectContaining({ status: "NO_PAYOUT" }),
    );
  });

  it("skips processing when another worker holds the advisory lock", async () => {
    const { db, updates } = createDb({ betSide: "A", winnerId: "agent-a" });
    db.execute = vi.fn(async () => ({
      rows: [{ acquired: false }],
    })) as typeof db.execute;

    await internals.processOneJob(db, job);

    expect(db.select).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });
});
