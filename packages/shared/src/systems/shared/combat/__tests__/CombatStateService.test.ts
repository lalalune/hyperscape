/**
 * CombatStateService Unit Tests
 *
 * Tests for combat state management:
 * - Combat state creation and tracking
 * - State queries (isInCombat, getCombatData)
 * - State sync to entities
 * - Reusable buffer optimization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CombatStateService, CombatData } from "../CombatStateService";
import { createEntityID, EntityID } from "../../../../utils/IdentifierUtils";

// Mock World
function createMockWorld() {
  const players = new Map<string, any>();

  return {
    isServer: true,
    network: {
      send: vi.fn(),
    },
    getPlayer: (id: string) => players.get(id),
    players,
  };
}

// Helper to add mock player to world
function addMockPlayer(world: any, id: string) {
  const player = {
    id,
    combat: { inCombat: false, combatTarget: null },
    data: { c: false, ct: null },
    markNetworkDirty: vi.fn(),
  };
  world.players.set(id, player);
  return player;
}

describe("CombatStateService", () => {
  let stateService: CombatStateService;
  let mockWorld: ReturnType<typeof createMockWorld>;

  beforeEach(() => {
    mockWorld = createMockWorld();
    stateService = new CombatStateService(mockWorld as any);
  });

  describe("createAttackerState", () => {
    it("creates combat state for attacker", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      expect(stateService.isInCombat("player1")).toBe(true);
    });

    it("stores correct target ID", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      const data = stateService.getCombatData("player1");
      expect(String(data?.targetId)).toBe("mob1");
    });

    it("stores correct entity types", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      const data = stateService.getCombatData("player1");
      expect(data?.attackerType).toBe("player");
      expect(data?.targetType).toBe("mob");
    });

    it("stores attack speed in ticks", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        6,
      );

      const data = stateService.getCombatData("player1");
      expect(data?.attackSpeedTicks).toBe(6);
    });

    it("calculates correct next attack tick", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");
      const currentTick = 100;
      const attackSpeed = 4;

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        currentTick,
        attackSpeed,
      );

      const data = stateService.getCombatData("player1");
      expect(data?.nextAttackTick).toBe(currentTick + attackSpeed);
    });

    it("calculates correct combat end tick", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");
      const currentTick = 100;

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        currentTick,
        4,
      );

      const data = stateService.getCombatData("player1");
      // Combat timeout is 8 ticks (COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS)
      expect(data?.combatEndTick).toBe(currentTick + 8);
    });

    it("sets inCombat to true", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      const state = stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      expect(state.inCombat).toBe(true);
    });
  });

  describe("createRetaliatorState", () => {
    it("creates combat state for retaliator", () => {
      const targetId = createEntityID("mob1");
      const attackerId = createEntityID("player1");

      stateService.createRetaliatorState(
        targetId,
        attackerId,
        "mob",
        "player",
        100,
        2, // retaliation delay
        4, // attack speed
      );

      expect(stateService.isInCombat("mob1")).toBe(true);
    });

    it("swaps attacker and target correctly", () => {
      const targetId = createEntityID("mob1");
      const attackerId = createEntityID("player1");

      stateService.createRetaliatorState(
        targetId,
        attackerId,
        "mob",
        "player",
        100,
        2,
        4,
      );

      const data = stateService.getCombatData("mob1");
      // The mob is now the attacker, player is target
      expect(String(data?.attackerId)).toBe("mob1");
      expect(String(data?.targetId)).toBe("player1");
      expect(data?.attackerType).toBe("mob");
      expect(data?.targetType).toBe("player");
    });

    it("uses retaliation delay for next attack tick", () => {
      const targetId = createEntityID("mob1");
      const attackerId = createEntityID("player1");
      const currentTick = 100;
      const retaliationDelay = 3;

      stateService.createRetaliatorState(
        targetId,
        attackerId,
        "mob",
        "player",
        currentTick,
        retaliationDelay,
        4,
      );

      const data = stateService.getCombatData("mob1");
      expect(data?.nextAttackTick).toBe(currentTick + retaliationDelay);
    });
  });

  describe("isInCombat", () => {
    it("returns false for entity not in combat", () => {
      expect(stateService.isInCombat("player1")).toBe(false);
    });

    it("returns true for entity in combat", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      expect(stateService.isInCombat("player1")).toBe(true);
    });
  });

  describe("getCombatData", () => {
    it("returns null for entity not in combat", () => {
      expect(stateService.getCombatData("nonexistent")).toBeNull();
    });

    it("returns complete combat data", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        150,
        5,
      );

      const data = stateService.getCombatData("player1");
      expect(data).not.toBeNull();
      expect(data?.inCombat).toBe(true);
      expect(data?.attackSpeedTicks).toBe(5);
      expect(data?.lastAttackTick).toBe(150);
    });
  });

  describe("setCombatState / removeCombatState", () => {
    it("setCombatState adds state directly", () => {
      const attackerId = createEntityID("player1");
      const state: CombatData = {
        attackerId,
        targetId: createEntityID("mob1"),
        attackerType: "player",
        targetType: "mob",
        weaponType: 0 as any,
        inCombat: true,
        lastAttackTick: 100,
        nextAttackTick: 104,
        combatEndTick: 108,
        attackSpeedTicks: 4,
      };

      stateService.setCombatState(attackerId, state);

      expect(stateService.isInCombat("player1")).toBe(true);
    });

    it("removeCombatState removes entity from combat", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );
      expect(stateService.isInCombat("player1")).toBe(true);

      stateService.removeCombatState(attackerId);
      expect(stateService.isInCombat("player1")).toBe(false);
    });

    it("removeCombatState handles nonexistent entity", () => {
      expect(() => {
        stateService.removeCombatState(createEntityID("nonexistent"));
      }).not.toThrow();
    });
  });

  describe("extendCombatTimer", () => {
    it("extends combat end tick", () => {
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      // Original combatEndTick: 100 + 8 = 108
      expect(stateService.getCombatData("player1")?.combatEndTick).toBe(108);

      // Extend from tick 105
      stateService.extendCombatTimer(attackerId, 105);

      // New combatEndTick: 105 + 8 = 113
      expect(stateService.getCombatData("player1")?.combatEndTick).toBe(113);
    });

    it("does nothing for entity not in combat", () => {
      expect(() => {
        stateService.extendCombatTimer(createEntityID("nonexistent"), 100);
      }).not.toThrow();
    });
  });

  describe("getAllCombatStates", () => {
    it("returns empty array when no combat states", () => {
      const states = stateService.getAllCombatStates();
      expect(states).toEqual([]);
    });

    it("returns all combat states as tuples", () => {
      const player1 = createEntityID("player1");
      const player2 = createEntityID("player2");
      const mob1 = createEntityID("mob1");
      const mob2 = createEntityID("mob2");

      stateService.createAttackerState(player1, mob1, "player", "mob", 100, 4);
      stateService.createAttackerState(player2, mob2, "player", "mob", 100, 4);

      const states = stateService.getAllCombatStates();
      expect(states.length).toBe(2);

      // States are tuples of [EntityID, CombatData]
      expect(states[0]).toHaveLength(2);
      expect(typeof states[0][0]).toBe("string");
      expect(states[0][1]).toHaveProperty("targetId");
    });

    it("reuses internal buffer (optimization check)", () => {
      const player1 = createEntityID("player1");
      const mob1 = createEntityID("mob1");

      stateService.createAttackerState(player1, mob1, "player", "mob", 100, 4);

      const states1 = stateService.getAllCombatStates();
      const states2 = stateService.getAllCombatStates();

      // Should return the same buffer reference
      expect(states1).toBe(states2);
    });
  });

  describe("getCombatStatesMap", () => {
    it("returns the underlying Map", () => {
      const map = stateService.getCombatStatesMap();
      expect(map instanceof Map).toBe(true);
    });

    it("returns live reference (mutations affect service)", () => {
      const map = stateService.getCombatStatesMap();
      const attackerId = createEntityID("player1");
      const targetId = createEntityID("mob1");

      stateService.createAttackerState(
        attackerId,
        targetId,
        "player",
        "mob",
        100,
        4,
      );

      expect(map.size).toBe(1);
    });
  });

  describe("syncCombatStateToEntity", () => {
    it("syncs combat state to player entity", () => {
      const player = addMockPlayer(mockWorld, "player1");

      stateService.syncCombatStateToEntity("player1", "mob1", "player");

      expect(player.combat.inCombat).toBe(true);
      expect(player.combat.combatTarget).toBe("mob1");
      expect(player.data.c).toBe(true);
      expect(player.data.ct).toBe("mob1");
    });

    it("sends network update on server", () => {
      addMockPlayer(mockWorld, "player1");

      stateService.syncCombatStateToEntity("player1", "mob1", "player");

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "entityModified",
        expect.objectContaining({
          id: "player1",
          c: true,
          ct: "mob1",
        }),
      );
    });

    it("marks entity network dirty", () => {
      const player = addMockPlayer(mockWorld, "player1");

      stateService.syncCombatStateToEntity("player1", "mob1", "player");

      expect(player.markNetworkDirty).toHaveBeenCalled();
    });

    it("does nothing for mob entities", () => {
      // No player in world
      expect(() => {
        stateService.syncCombatStateToEntity("mob1", "player1", "mob");
      }).not.toThrow();

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });

    it("handles missing player gracefully", () => {
      expect(() => {
        stateService.syncCombatStateToEntity("nonexistent", "mob1", "player");
      }).not.toThrow();
    });
  });

  describe("clearCombatStateFromEntity", () => {
    it("clears combat state from player entity", () => {
      const player = addMockPlayer(mockWorld, "player1");
      player.combat.inCombat = true;
      player.combat.combatTarget = "mob1";
      player.data.c = true;
      player.data.ct = "mob1";

      stateService.clearCombatStateFromEntity("player1", "player");

      expect(player.combat.inCombat).toBe(false);
      expect(player.combat.combatTarget).toBeNull();
      expect(player.data.c).toBe(false);
      expect(player.data.ct).toBeNull();
    });

    it("sends network update on server", () => {
      addMockPlayer(mockWorld, "player1");

      stateService.clearCombatStateFromEntity("player1", "player");

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "entityModified",
        expect.objectContaining({
          id: "player1",
          c: false,
          ct: null,
        }),
      );
    });

    it("does nothing for mob entities", () => {
      expect(() => {
        stateService.clearCombatStateFromEntity("mob1", "mob");
      }).not.toThrow();

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });
  });

  describe("getAttackersTargeting", () => {
    it("returns empty array when no attackers", () => {
      const attackers = stateService.getAttackersTargeting("player1");
      expect(attackers).toEqual([]);
    });

    it("returns all attackers targeting an entity", () => {
      const mob1 = createEntityID("mob1");
      const mob2 = createEntityID("mob2");
      const player1 = createEntityID("player1");

      stateService.createAttackerState(mob1, player1, "mob", "player", 100, 4);
      stateService.createAttackerState(mob2, player1, "mob", "player", 100, 4);

      const attackers = stateService.getAttackersTargeting("player1");
      expect(attackers.length).toBe(2);
      expect(attackers).toContain("mob1");
      expect(attackers).toContain("mob2");
    });

    it("does not include attackers targeting other entities", () => {
      const mob1 = createEntityID("mob1");
      const mob2 = createEntityID("mob2");
      const player1 = createEntityID("player1");
      const player2 = createEntityID("player2");

      stateService.createAttackerState(mob1, player1, "mob", "player", 100, 4);
      stateService.createAttackerState(mob2, player2, "mob", "player", 100, 4);

      const attackers = stateService.getAttackersTargeting("player1");
      expect(attackers.length).toBe(1);
      expect(attackers).toContain("mob1");
      expect(attackers).not.toContain("mob2");
    });
  });

  describe("destroy", () => {
    it("clears all combat states", () => {
      const player1 = createEntityID("player1");
      const player2 = createEntityID("player2");
      const mob1 = createEntityID("mob1");
      const mob2 = createEntityID("mob2");

      stateService.createAttackerState(player1, mob1, "player", "mob", 100, 4);
      stateService.createAttackerState(player2, mob2, "player", "mob", 100, 4);

      expect(stateService.getCombatStatesMap().size).toBe(2);

      stateService.destroy();

      expect(stateService.getCombatStatesMap().size).toBe(0);
      expect(stateService.getAllCombatStates()).toEqual([]);
    });
  });

  describe("mob vs player combat scenarios", () => {
    it("tracks mob attacking player", () => {
      const mobId = createEntityID("mob1");
      const playerId = createEntityID("player1");

      stateService.createAttackerState(
        mobId,
        playerId,
        "mob",
        "player",
        100,
        4,
      );

      const data = stateService.getCombatData("mob1");
      expect(data?.attackerType).toBe("mob");
      expect(data?.targetType).toBe("player");
    });

    it("tracks player attacking player (PvP)", () => {
      const player1 = createEntityID("player1");
      const player2 = createEntityID("player2");

      stateService.createAttackerState(
        player1,
        player2,
        "player",
        "player",
        100,
        4,
      );

      const data = stateService.getCombatData("player1");
      expect(data?.attackerType).toBe("player");
      expect(data?.targetType).toBe("player");
    });

    it("tracks mutual combat (player and mob fighting each other)", () => {
      const player1 = createEntityID("player1");
      const mob1 = createEntityID("mob1");

      // Player attacks mob
      stateService.createAttackerState(player1, mob1, "player", "mob", 100, 4);

      // Mob retaliates
      stateService.createRetaliatorState(
        mob1,
        player1,
        "mob",
        "player",
        100,
        2,
        4,
      );

      expect(stateService.isInCombat("player1")).toBe(true);
      expect(stateService.isInCombat("mob1")).toBe(true);

      const playerData = stateService.getCombatData("player1");
      const mobData = stateService.getCombatData("mob1");

      expect(String(playerData?.targetId)).toBe("mob1");
      expect(String(mobData?.targetId)).toBe("player1");
    });
  });
});
