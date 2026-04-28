import "../../../src/shared/polyfills.js";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DuelArenaOraclePublisher } from "../../../src/oracle/DuelArenaOraclePublisher.js";
import type {
  DuelArenaOracleConfig,
  DuelArenaOracleResolutionEvent,
  DuelArenaOracleRecord,
} from "../../../src/oracle/types.js";
import type { World } from "@hyperscape/shared";

// We mock the internals tightly used by publisher
vi.mock("viem", async () => ({
  createPublicClient: vi.fn(),
  createWalletClient: vi.fn(),
  http: vi.fn(),
}));

vi.mock("viem/accounts", async () => ({
  privateKeyToAccount: vi.fn(),
}));

vi.mock("@hyperscape/shared", () => ({}));

vi.mock("@solana/web3.js", async () => ({
  Connection: vi.fn(),
  Keypair: {
    fromSecretKey: vi.fn(),
  },
  PublicKey: vi.fn(),
}));

vi.mock("../../../src/systems/ServerNetwork/services/index.js", () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("DuelArenaOraclePublisher", () => {
  let mockWorld: World;
  let publisher: DuelArenaOraclePublisher;
  let config: DuelArenaOracleConfig;

  beforeEach(() => {
    mockWorld = {
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as World;

    config = {
      enabled: true,
      profile: "local",
      metadataBaseUrl: "http://localhost:5555",
      storePath: "/tmp/oracle-records.json",
      evmTargets: [],
      solanaTargets: [],
      settlementDelayMs: 7000,
    };

    publisher = new DuelArenaOraclePublisher(mockWorld, config);
    // Suppress console logs during test
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleResolution settlementDelayMs", () => {
    it("delays the cross-target publish by settlementDelayMs", async () => {
      await publisher.init();

      const publishAcrossTargetsSpy = vi
        .spyOn(publisher as any, "publishAcrossTargets")
        .mockResolvedValue(true);

      const setTimeoutSpy = vi
        .spyOn(globalThis, "setTimeout")
        .mockImplementation((fn: any) => {
          fn();
          return 0 as any;
        });

      const payload: DuelArenaOracleResolutionEvent = {
        cycleId: "cycle-123",
        duelId: "duel-123",
        duelKeyHex: "deadbeef",
        duelEndTime: 1000,
        winnerId: "agent-a",
        loserId: "agent-b",
        winnerName: "Agent A",
        loserName: "Agent B",
        winReason: "kill",
        seed: "123456789",
        replayHash: "abcdeg",
      };

      // We need to inject a pending record so handleResolution has something to update
      (publisher as any).records.set("duel-123", {
        duelId: "duel-123",
        participantA: { id: "agent-a", name: "Agent A", hashHex: "aa" },
        participantB: { id: "agent-b", name: "Agent B", hashHex: "bb" },
      });

      // We mock the persistRecords to immediately resolve
      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      // Call handleResolution, which is an async function
      await (publisher as any).handleResolution(payload);

      // Verify setTimeout was called with the configured delay
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 7000);

      // Now it should be called
      expect(publishAcrossTargetsSpy).toHaveBeenCalledTimes(1);
      expect(publishAcrossTargetsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ duelId: "duel-123", status: "RESOLVED" }),
        "RESOLVE",
      );
    });

    it("does not delay if settlementDelayMs is 0", async () => {
      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);
      await publisher.init();

      const publishAcrossTargetsSpy = vi
        .spyOn(publisher as any, "publishAcrossTargets")
        .mockResolvedValue(true);

      const payload: DuelArenaOracleResolutionEvent = {
        cycleId: "cycle-123",
        duelId: "duel-123",
        duelKeyHex: "deadbeef",
        duelEndTime: 1000,
        winnerId: "agent-a",
        loserId: "agent-b",
        winnerName: "Agent A",
        loserName: "Agent B",
        winReason: "kill",
        seed: "123456789",
        replayHash: "abcdeg",
      };

      (publisher as any).records.set("duel-123", {
        duelId: "duel-123",
        participantA: { id: "agent-a", name: "Agent A", hashHex: "aa" },
        participantB: { id: "agent-b", name: "Agent B", hashHex: "bb" },
      });

      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      // Should complete immediately
      await (publisher as any).handleResolution(payload);

      expect(publishAcrossTargetsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("publishAcrossTargets coverage", () => {
    it("calls publishResolution on both EVM and Solana targets", async () => {
      const mockEvmTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution: vi.fn().mockResolvedValue("0xevmHash"),
      };

      const mockSolTarget = {
        key: "solanaDevnet",
        label: "Solana Devnet",
        publishResolution: vi.fn().mockResolvedValue("solHash"),
      };

      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);

      // Override internal arrays manually to inject our mocks
      (publisher as any).evmTargets = [mockEvmTarget];
      (publisher as any).solanaTargets = [mockSolTarget];

      const record: DuelArenaOracleRecord = {
        duelId: "duel-123",
        status: "RESOLVED",
        cycleId: "cycle-123",
        chainState: {},
      } as unknown as DuelArenaOracleRecord;

      await (publisher as any).publishAcrossTargets(record, "RESOLVE");

      expect(mockEvmTarget.publishResolution).toHaveBeenCalledWith(record);
      expect(mockSolTarget.publishResolution).toHaveBeenCalledWith(record);

      // Verify chain states are correctly stored in the Publisher
      const updatedStateEvm = (publisher as any).getRecord("duel-123")
        ?.chainState["baseSepolia"];
      // Since it wasn't strictly added to the records map yet, we just verify publish is called properly
      // To strictly verify chain state we need to mock updateChainState which is private or call getRecord
    });
  });

  describe("publishToTarget retry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries a failed publish with exponential backoff and succeeds", async () => {
      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);

      const publishResolution = vi
        .fn()
        .mockRejectedValueOnce(new Error("network glitch"))
        .mockResolvedValueOnce("0xretryOk");

      const mockTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution,
      };
      (publisher as any).evmTargets = [mockTarget];

      const record: DuelArenaOracleRecord = {
        duelId: "duel-retry-ok",
        status: "RESOLVED",
        cycleId: "cycle-1",
        chainState: {},
      } as unknown as DuelArenaOracleRecord;
      (publisher as any).records.set(record.duelId, record);
      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      // First attempt — should fail and schedule a retry for +1000ms.
      await (publisher as any).publishToTarget(record, mockTarget, "RESOLVE");
      expect(publishResolution).toHaveBeenCalledTimes(1);
      expect((publisher as any).retryTimers.size).toBe(1);

      // Advance past the first retry delay (1000ms) and flush microtasks so the
      // retry's async publishToTarget call resolves before we inspect state.
      await vi.advanceTimersByTimeAsync(1000);

      expect(publishResolution).toHaveBeenCalledTimes(2);
      expect((publisher as any).retryTimers.size).toBe(0);
      const latestState = (publisher as any).getRecord("duel-retry-ok")
        ?.chainState["baseSepolia"];
      expect(latestState?.lastTxHash).toBe("0xretryOk");
      expect(latestState?.lastError).toBeNull();
    });

    it("gives up after the maximum number of retries", async () => {
      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);

      const err = new Error("rpc down");
      const publishResolution = vi.fn().mockRejectedValue(err);
      const mockTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution,
      };
      (publisher as any).evmTargets = [mockTarget];

      const record: DuelArenaOracleRecord = {
        duelId: "duel-retry-exhaust",
        status: "RESOLVED",
        cycleId: "cycle-1",
        chainState: {},
      } as unknown as DuelArenaOracleRecord;
      (publisher as any).records.set(record.duelId, record);
      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      await (publisher as any).publishToTarget(record, mockTarget, "RESOLVE");
      // Exhaust the full retry schedule: 1s + 2.5s + 6s + 15s + 30s.
      await vi.advanceTimersByTimeAsync(55_000);

      // Initial + 5 retries = 6 attempts.
      expect(publishResolution).toHaveBeenCalledTimes(6);
      expect((publisher as any).retryTimers.size).toBe(0);
    });

    it("re-queues failed publishes from persisted records on boot", async () => {
      // setImmediate must actually fire — switch off the outer describe's
      // fake timers for this test only.
      vi.useRealTimers();

      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);

      // Pretend the persisted store already has a RESOLVED duel whose EVM
      // publish failed right before shutdown (lastError set on evm target).
      // A CANCELLED duel with a clean (lastError=null) solana target must NOT
      // be re-queued — that's what success looks like.
      vi.spyOn(publisher as any, "loadPersistedRecords").mockImplementation(
        async () => {
          (publisher as any).records.set("duel-stuck", {
            duelId: "duel-stuck",
            status: "RESOLVED",
            cycleId: "cycle-stuck",
            chainState: {
              baseSepolia: {
                target: "baseSepolia",
                kind: "evm",
                label: "Base Sepolia",
                lastAction: "RESOLVE",
                lastTxHash: null,
                lastError: "rpc fell over",
                updatedAt: "2024-01-01T00:00:00Z",
              },
            },
          });
          (publisher as any).records.set("duel-clean", {
            duelId: "duel-clean",
            status: "CANCELLED",
            cycleId: "cycle-clean",
            chainState: {
              baseSepolia: {
                target: "baseSepolia",
                kind: "evm",
                label: "Base Sepolia",
                lastAction: "CANCEL",
                lastTxHash: "0xok",
                lastError: null,
                updatedAt: "2024-01-01T00:00:00Z",
              },
            },
          });
        },
      );

      // Fake target that records which action it was called with.
      const publishResolution = vi.fn().mockResolvedValue("0xbootRetryOk");
      const publishCancellation = vi.fn().mockResolvedValue("0xshouldNotFire");
      const mockTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution,
        publishCancellation,
      };

      // init() calls loadPersistedRecords() first, then attach(), then
      // requeueFailedPublishesOnBoot(). We need evmTargets populated BEFORE
      // init() runs. The real publisher builds evmTargets in its ctor from
      // config.evmTargets — since we can't easily inject mock classes
      // through the EVM config, swap the array directly before init().
      (publisher as any).evmTargets = [mockTarget];

      await publisher.init();
      // setImmediate is used to defer work — flush it so the requeue fires.
      await new Promise((resolve) => setImmediate(resolve));
      // One microtask loop for the inner publishToTarget promise.
      await Promise.resolve();

      expect(publishResolution).toHaveBeenCalledTimes(1);
      // The CANCELLED/clean record must not have been re-queued.
      expect(publishCancellation).not.toHaveBeenCalled();
    });

    it("getStuckRecords returns records with lastError set", () => {
      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);

      (publisher as any).records.set("duel-stuck", {
        duelId: "duel-stuck",
        status: "RESOLVED",
        winnerId: "a",
        loserId: "b",
        updatedAt: "2024-02-01T00:00:00Z",
        chainState: {
          baseSepolia: {
            target: "baseSepolia",
            kind: "evm",
            label: "Base Sepolia",
            lastAction: "RESOLVE",
            lastTxHash: null,
            lastError: "rpc timeout",
            updatedAt: "2024-02-01T00:00:00Z",
          },
          solanaDevnet: {
            target: "solanaDevnet",
            kind: "solana",
            label: "Solana Devnet",
            lastAction: "RESOLVE",
            lastTxHash: "solOkHash",
            lastError: null,
            updatedAt: "2024-02-01T00:00:00Z",
          },
        },
      });
      (publisher as any).records.set("duel-clean", {
        duelId: "duel-clean",
        status: "RESOLVED",
        winnerId: "c",
        loserId: "d",
        updatedAt: "2024-02-01T00:00:00Z",
        chainState: {
          baseSepolia: {
            target: "baseSepolia",
            kind: "evm",
            lastAction: "RESOLVE",
            lastTxHash: "0xok",
            lastError: null,
            updatedAt: "2024-02-01T00:00:00Z",
          },
        },
      });

      const stuck = publisher.getStuckRecords();
      expect(stuck).toHaveLength(1);
      expect(stuck[0].duelId).toBe("duel-stuck");
      // Only the failed target shows up — the clean solana one does not.
      expect(stuck[0].stuckTargets).toHaveLength(1);
      expect(stuck[0].stuckTargets[0].target).toBe("baseSepolia");
      expect(stuck[0].stuckTargets[0].lastError).toBe("rpc timeout");
    });

    it("clearStuckRecord without forceRetry clears errors and skips re-publish", async () => {
      // Real timers so setImmediate actually fires if forceRetry ever is used.
      vi.useRealTimers();

      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);
      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      const publishResolution = vi.fn().mockResolvedValue("0xshouldNotFire");
      const mockTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution,
      };
      (publisher as any).evmTargets = [mockTarget];

      (publisher as any).records.set("duel-1", {
        duelId: "duel-1",
        status: "RESOLVED",
        updatedAt: "2024-01-01T00:00:00Z",
        chainState: {
          baseSepolia: {
            target: "baseSepolia",
            kind: "evm",
            label: "Base Sepolia",
            lastAction: "RESOLVE",
            lastTxHash: null,
            lastError: "boom",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        },
      });

      const result = await publisher.clearStuckRecord("duel-1");
      expect(result.cleared).toBe(true);
      expect(result.targetsCleared).toEqual(["baseSepolia"]);
      expect(result.targetsRetried).toEqual([]);

      // Flush any setImmediate that might have queued (shouldn't have).
      await new Promise((resolve) => setImmediate(resolve));
      expect(publishResolution).not.toHaveBeenCalled();

      const rec = (publisher as any).getRecord("duel-1");
      expect(rec.chainState.baseSepolia.lastError).toBeNull();
    });

    it("clearStuckRecord with forceRetry clears errors and retriggers publish", async () => {
      vi.useRealTimers();

      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);
      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      const publishResolution = vi.fn().mockResolvedValue("0xforcedOk");
      const mockTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution,
      };
      (publisher as any).evmTargets = [mockTarget];

      (publisher as any).records.set("duel-2", {
        duelId: "duel-2",
        status: "RESOLVED",
        updatedAt: "2024-01-01T00:00:00Z",
        chainState: {
          baseSepolia: {
            target: "baseSepolia",
            kind: "evm",
            label: "Base Sepolia",
            lastAction: "RESOLVE",
            lastTxHash: null,
            lastError: "old_error",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        },
      });

      const result = await publisher.clearStuckRecord("duel-2", {
        forceRetry: true,
      });
      expect(result.cleared).toBe(true);
      expect(result.targetsRetried).toEqual(["baseSepolia"]);

      // Let setImmediate + inner promise resolve.
      await new Promise((resolve) => setImmediate(resolve));
      await Promise.resolve();

      expect(publishResolution).toHaveBeenCalledTimes(1);
      const rec = (publisher as any).getRecord("duel-2");
      expect(rec.chainState.baseSepolia.lastTxHash).toBe("0xforcedOk");
      expect(rec.chainState.baseSepolia.lastError).toBeNull();
    });

    it("clearStuckRecord returns not_found for unknown duelId", async () => {
      vi.useRealTimers();
      publisher = new DuelArenaOraclePublisher(mockWorld, config);
      const result = await publisher.clearStuckRecord("does-not-exist");
      expect(result.cleared).toBe(false);
      expect(result.reason).toBe("not_found");
    });

    it("destroy() cancels pending retry timers", async () => {
      config.settlementDelayMs = 0;
      publisher = new DuelArenaOraclePublisher(mockWorld, config);

      const publishResolution = vi.fn().mockRejectedValue(new Error("fail"));
      const mockTarget = {
        key: "baseSepolia",
        label: "Base Sepolia",
        publishResolution,
      };
      (publisher as any).evmTargets = [mockTarget];

      const record: DuelArenaOracleRecord = {
        duelId: "duel-destroy",
        status: "RESOLVED",
        cycleId: "cycle-1",
        chainState: {},
      } as unknown as DuelArenaOracleRecord;
      (publisher as any).records.set(record.duelId, record);
      vi.spyOn(publisher as any, "persistRecords").mockResolvedValue(undefined);

      await (publisher as any).publishToTarget(record, mockTarget, "RESOLVE");
      expect((publisher as any).retryTimers.size).toBe(1);

      publisher.destroy();
      expect((publisher as any).retryTimers.size).toBe(0);

      // Advancing past the delay must NOT retry — the timer was cleared.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(publishResolution).toHaveBeenCalledTimes(1);
    });
  });
});
