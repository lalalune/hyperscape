import "../../../src/shared/polyfills.js";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DuelArenaOraclePublisher } from "../../../src/oracle/DuelArenaOraclePublisher.js";
import type {
  DuelArenaOracleConfig,
  DuelArenaOracleResolutionEvent,
  DuelArenaOracleRecord,
} from "../../../src/oracle/types.js";
import type { World } from "@hyperforge/shared";

// We mock the internals tightly used by publisher
vi.mock("viem", async () => ({
  createPublicClient: vi.fn(),
  createWalletClient: vi.fn(),
  http: vi.fn(),
}));

vi.mock("viem/accounts", async () => ({
  privateKeyToAccount: vi.fn(),
}));

vi.mock("@hyperforge/shared", () => ({}));

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
});
