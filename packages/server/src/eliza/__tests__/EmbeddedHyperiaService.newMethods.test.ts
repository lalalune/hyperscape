import { describe, expect, it, vi } from "vitest";
import { EmbeddedHyperiaService } from "../EmbeddedHyperiaService";

function createMockWorld(overrides?: Record<string, unknown>) {
  const entities = new Map();
  const systems = new Map();

  const world = {
    entities: {
      get: (id: string) => entities.get(id),
      values: () => entities.values(),
      add: vi.fn().mockReturnValue("new-entity-id"),
      items: () => entities.entries(),
      [Symbol.iterator]: () => entities.entries(),
    },
    getSystem: (name: string) => systems.get(name) ?? null,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    isServer: true,
    network: null,
    ...overrides,
  };

  return { world, entities, systems };
}

describe("EmbeddedHyperiaService new methods", () => {
  describe("executeChangeStyle", () => {
    it("rejects invalid styles", async () => {
      const { world, entities } = createMockWorld();
      entities.set("agent-1", { data: {} });

      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executeChangeStyle("invalid_style");
      expect(result).toBe(false);
      expect(world.emit).not.toHaveBeenCalled();
    });

    it("accepts valid styles", async () => {
      const { world, entities } = createMockWorld();
      entities.set("agent-1", { data: {} });

      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executeChangeStyle("aggressive");
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });

    it("returns false when not active", async () => {
      const { world } = createMockWorld();
      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );

      const result = await service.executeChangeStyle("aggressive");
      expect(result).toBe(false);
    });
  });

  describe("executeSetAutocast", () => {
    it("sets a known level-compatible spell on both authoritative views", async () => {
      const player = {
        data: { skills: { magic: { level: 13, xp: 0 } } },
      };
      const { world, entities } = createMockWorld({
        getPlayer: () => player,
      });
      entities.set("agent-1", player);
      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executeSetAutocast("fire_strike");

      expect(result).toBe(true);
      expect(player.data).toMatchObject({ selectedSpell: "fire_strike" });
      expect(world.emit).toHaveBeenCalledWith("player:set_autocast", {
        playerId: "agent-1",
        spellId: "fire_strike",
      });
    });

    it("rejects unknown or level-incompatible spells without changing state", async () => {
      const { world, entities } = createMockWorld();
      entities.set("agent-1", {
        data: {
          selectedSpell: null,
          skills: { magic: { level: 1, xp: 0 } },
        },
      });
      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      expect(await service.executeSetAutocast("fire_strike")).toBe(false);
      expect(await service.executeSetAutocast("unknown_spell")).toBe(false);
      expect(world.emit).not.toHaveBeenCalled();
    });
  });

  describe("executeHomeTeleport", () => {
    it("blocks teleport during combat", async () => {
      const { world, entities } = createMockWorld();
      entities.set("agent-1", { data: { inCombat: true } });

      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executeHomeTeleport();
      expect(result).toBe(false);
      expect(world.emit).not.toHaveBeenCalled();
    });

    it("blocks teleport during duel", async () => {
      const { world, entities } = createMockWorld();
      entities.set("agent-1", { data: { inStreamingDuel: true } });

      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executeHomeTeleport();
      expect(result).toBe(false);
    });

    it("allows teleport when idle", async () => {
      const { world, entities } = createMockWorld();
      entities.set("agent-1", { data: {} });

      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executeHomeTeleport();
      expect(result).toBe(true);
      expect(world.emit).toHaveBeenCalled();
    });
  });

  describe("executePrayerToggle", () => {
    it("rejects empty prayer ID", async () => {
      const { world } = createMockWorld();
      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executePrayerToggle("");
      expect(result).toMatchObject({
        success: false,
        committed: false,
        reason: "invalid_request",
      });
    });

    it("returns false when prayer system unavailable", async () => {
      const { world } = createMockWorld();
      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executePrayerToggle("superhuman_strength");
      expect(result).toMatchObject({
        success: false,
        committed: false,
        reason: "atomic_persistence_unavailable",
      });
    });

    it("calls prayer system when available", async () => {
      const { world, systems } = createMockWorld();
      const mockToggle = vi.fn(
        async (playerId: string, _prayerId: string, operationId: string) => ({
          success: true,
          committed: true,
          playerId,
          operationId,
          replayed: false,
          pointUnits: 4_000_000,
          points: 4,
          maxPoints: 5,
          activePrayers: ["superhuman_strength"],
        }),
      );
      systems.set("prayer", { togglePrayer: mockToggle });

      const service = new EmbeddedHyperiaService(
        world as never,
        "agent-1",
        "account-1",
        "TestAgent",
      );
      (service as unknown as { playerEntityId: string }).playerEntityId =
        "agent-1";
      (service as unknown as { isActive: boolean }).isActive = true;

      const result = await service.executePrayerToggle("superhuman_strength");
      expect(result).toMatchObject({
        success: true,
        committed: true,
        activePrayers: ["superhuman_strength"],
      });
      expect(mockToggle).toHaveBeenCalledWith(
        "agent-1",
        "superhuman_strength",
        expect.stringMatching(/^agent-prayer-toggle:/),
      );
    });
  });
});
