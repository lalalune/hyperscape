import { describe, expect, it, vi } from "vitest";

import { DatabaseSystem } from "../index";

describe("DatabaseSystem player save ordering", () => {
  it("drains an older generic snapshot before an awaited newer snapshot", async () => {
    let releaseOlder!: () => void;
    const olderBlocked = new Promise<void>((resolve) => {
      releaseOlder = resolve;
    });
    const calls: string[] = [];
    const playerRepository = {
      batchSavePlayersAsync: vi.fn(async () => {
        calls.push("older-start");
        await olderBlocked;
        calls.push("older-commit");
      }),
      savePlayerAsync: vi.fn(async () => {
        calls.push("newer-commit");
      }),
    };
    const system = Object.create(DatabaseSystem.prototype) as DatabaseSystem;
    Object.assign(system as object, {
      isDestroying: false,
      pendingOperations: new Set<Promise<unknown>>(),
      pendingSaveBuffer: new Map(),
      saveFlushScheduled: false,
      playerSaveWriteTail: Promise.resolve(),
      playerRepository,
    });

    system.savePlayer("player-1", { health: 3, maxHealth: 10 });
    const newerSave = system.savePlayerAsync("player-1", {
      health: 4,
      maxHealth: 10,
    });

    await vi.waitFor(() => expect(calls).toEqual(["older-start"]));
    expect(playerRepository.savePlayerAsync).not.toHaveBeenCalled();

    releaseOlder();
    await newerSave;

    expect(calls).toEqual(["older-start", "older-commit", "newer-commit"]);
    expect(playerRepository.batchSavePlayersAsync).toHaveBeenCalledWith(
      new Map([["player-1", { health: 3, maxHealth: 10 }]]),
    );
    expect(playerRepository.savePlayerAsync).toHaveBeenCalledWith("player-1", {
      health: 4,
      maxHealth: 10,
    });
  });

  it("flushes a zero-delay player buffer before repositories enter shutdown", async () => {
    const calls: string[] = [];
    const passiveRepository = { markDestroying: vi.fn() };
    const playerRepository = {
      batchSavePlayersAsync: vi.fn(async () => {
        calls.push("write");
      }),
      markDestroying: vi.fn(() => {
        calls.push("destroy");
      }),
    };
    const system = Object.create(DatabaseSystem.prototype) as DatabaseSystem;
    Object.assign(system as object, {
      isDestroying: false,
      pendingOperations: new Set<Promise<unknown>>(),
      pendingSaveBuffer: new Map(),
      saveFlushScheduled: false,
      playerSaveWriteTail: Promise.resolve(),
      playerRepository,
      characterRepository: passiveRepository,
      inventoryRepository: passiveRepository,
      equipmentRepository: passiveRepository,
      sessionRepository: passiveRepository,
      worldChunkRepository: passiveRepository,
      npcKillRepository: passiveRepository,
      deathRepository: passiveRepository,
      templateRepository: passiveRepository,
      questRepository: passiveRepository,
      activityLogRepository: passiveRepository,
      bankRepository: passiveRepository,
    });

    system.savePlayer("player-1", { health: 4, maxHealth: 10 });
    await system.waitForPendingOperations();

    expect(calls).toEqual(["write", "destroy"]);
    expect(playerRepository.batchSavePlayersAsync).toHaveBeenCalledWith(
      new Map([["player-1", { health: 4, maxHealth: 10 }]]),
    );
  });
});
