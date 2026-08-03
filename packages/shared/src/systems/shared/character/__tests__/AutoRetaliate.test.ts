/**
 * Auto-Retaliate Unit Tests
 *
 * Tests for classic MMORPG-style auto-retaliate functionality:
 * - State initialization (default ON)
 * - Toggle behavior with rate limiting
 * - Event emission on state change
 * - Cleanup on player leave
 * - Server handler input validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventType } from "../../../../types/events";

/**
 * Mock World for testing auto-retaliate state management
 */
function createMockWorld() {
  const eventHandlers = new Map<string, Function[]>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  return {
    isServer: true,
    currentTick: 100,
    on: (event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(handler);
    },
    off: vi.fn(),
    emit: vi.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((h) => h(data));
    }),
    getEventHandlers: () => eventHandlers,
    getEmittedEvents: () => emittedEvents,
    clearEmittedEvents: () => {
      emittedEvents.length = 0;
    },
    getSystem: () => null,
    getPlayer: () => null,
    entities: {
      players: new Map(),
    },
  };
}

/**
 * Simple AutoRetaliateManager that mimics PlayerSystem's auto-retaliate logic
 * (Extracted for isolated unit testing without full PlayerSystem dependencies)
 */
class AutoRetaliateManager {
  private playerAutoRetaliate = new Map<string, boolean>();
  private autoRetaliateLastToggle = new Map<string, number>();
  private readonly AUTO_RETALIATE_COOLDOWN_MS = 500;
  private world: ReturnType<typeof createMockWorld>;

  constructor(world: ReturnType<typeof createMockWorld>) {
    this.world = world;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.world.on(EventType.UI_AUTO_RETALIATE_UPDATE, (data: unknown) => {
      this.handleAutoRetaliateToggle(
        data as { playerId: string; enabled: boolean },
      );
    });

    this.world.on(EventType.UI_AUTO_RETALIATE_GET, (data: unknown) => {
      this.handleGetAutoRetaliate(
        data as { playerId: string; callback?: (enabled: boolean) => void },
      );
    });
  }

  initializePlayer(playerId: string, enabled: boolean = true) {
    this.playerAutoRetaliate.set(playerId, enabled);
    this.autoRetaliateLastToggle.set(playerId, 0);
  }

  cleanupPlayer(playerId: string) {
    this.playerAutoRetaliate.delete(playerId);
    this.autoRetaliateLastToggle.delete(playerId);
  }

  getAutoRetaliate(playerId: string): boolean {
    return this.playerAutoRetaliate.get(playerId) ?? true;
  }

  private handleAutoRetaliateToggle(data: {
    playerId: string;
    enabled: boolean;
  }) {
    const { playerId, enabled } = data;

    // Input validation: enabled must be boolean
    if (typeof enabled !== "boolean") {
      console.warn(
        `[AutoRetaliate] Invalid enabled value for player ${playerId}: ${typeof enabled}`,
      );
      return;
    }

    // Check player exists
    if (!this.playerAutoRetaliate.has(playerId)) {
      console.warn(
        `[AutoRetaliate] Player ${playerId} not found in auto-retaliate state`,
      );
      return;
    }

    // Rate limiting (500ms cooldown)
    const now = Date.now();
    const lastToggle = this.autoRetaliateLastToggle.get(playerId) ?? 0;
    if (now - lastToggle < this.AUTO_RETALIATE_COOLDOWN_MS) {
      console.warn(
        `[AutoRetaliate] Rate limited toggle for player ${playerId}`,
      );
      return;
    }

    // Update state
    this.playerAutoRetaliate.set(playerId, enabled);
    this.autoRetaliateLastToggle.set(playerId, now);

    // Emit change event
    this.world.emit(EventType.UI_AUTO_RETALIATE_CHANGED, {
      playerId,
      enabled,
    });
  }

  private handleGetAutoRetaliate(data: {
    playerId: string;
    callback?: (enabled: boolean) => void;
  }) {
    const { playerId, callback } = data;
    const enabled = this.getAutoRetaliate(playerId);
    callback?.(enabled);
  }
}

describe("AutoRetaliate", () => {
  let manager: AutoRetaliateManager;
  let mockWorld: ReturnType<typeof createMockWorld>;

  beforeEach(() => {
    mockWorld = createMockWorld();
    manager = new AutoRetaliateManager(mockWorld);
  });

  describe("initialization", () => {
    it("defaults to ON (true) for new players", () => {
      manager.initializePlayer("player1");
      expect(manager.getAutoRetaliate("player1")).toBe(true);
    });

    it("can initialize with custom value", () => {
      manager.initializePlayer("player1", false);
      expect(manager.getAutoRetaliate("player1")).toBe(false);
    });

    it("returns true for unknown players (safe default)", () => {
      expect(manager.getAutoRetaliate("unknown")).toBe(true);
    });
  });

  describe("toggle behavior", () => {
    beforeEach(() => {
      manager.initializePlayer("player1", true);
      mockWorld.clearEmittedEvents();
    });

    it("toggles from ON to OFF", () => {
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: false,
      });

      expect(manager.getAutoRetaliate("player1")).toBe(false);
    });

    it("toggles from OFF to ON", () => {
      manager.initializePlayer("player2", false);
      mockWorld.clearEmittedEvents();

      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player2",
        enabled: true,
      });

      expect(manager.getAutoRetaliate("player2")).toBe(true);
    });

    it("emits UI_AUTO_RETALIATE_CHANGED event on toggle", () => {
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: false,
      });

      const emittedEvents = mockWorld.getEmittedEvents();
      const changedEvent = emittedEvents.find(
        (e) => e.event === EventType.UI_AUTO_RETALIATE_CHANGED,
      );

      expect(changedEvent).toBeDefined();
      expect(changedEvent?.data).toEqual({
        playerId: "player1",
        enabled: false,
      });
    });
  });

  describe("rate limiting", () => {
    beforeEach(() => {
      manager.initializePlayer("player1", true);
      mockWorld.clearEmittedEvents();
    });

    it("blocks rapid toggles within 500ms cooldown", () => {
      // First toggle should work
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: false,
      });
      expect(manager.getAutoRetaliate("player1")).toBe(false);

      // Second toggle immediately after should be blocked
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: true,
      });
      expect(manager.getAutoRetaliate("player1")).toBe(false); // Still false
    });

    it("allows toggle after cooldown expires", async () => {
      // First toggle
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: false,
      });

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 510));

      // Second toggle should work
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: true,
      });
      expect(manager.getAutoRetaliate("player1")).toBe(true);
    });
  });

  describe("input validation", () => {
    beforeEach(() => {
      manager.initializePlayer("player1", true);
      mockWorld.clearEmittedEvents();
    });

    it("rejects non-boolean enabled values", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "player1",
        enabled: "true" as unknown as boolean, // String instead of boolean
      });

      expect(manager.getAutoRetaliate("player1")).toBe(true); // Unchanged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("rejects toggle for non-existent player", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockWorld.emit(EventType.UI_AUTO_RETALIATE_UPDATE, {
        playerId: "nonexistent",
        enabled: false,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("cleanup", () => {
    it("removes player state on cleanup", () => {
      manager.initializePlayer("player1", false);
      expect(manager.getAutoRetaliate("player1")).toBe(false);

      manager.cleanupPlayer("player1");

      // After cleanup, returns default (true)
      expect(manager.getAutoRetaliate("player1")).toBe(true);
    });
  });

  describe("getAutoRetaliate callback", () => {
    it("calls callback with current value", () => {
      manager.initializePlayer("player1", false);

      let callbackValue: boolean | undefined;
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_GET, {
        playerId: "player1",
        callback: (enabled: boolean) => {
          callbackValue = enabled;
        },
      });

      expect(callbackValue).toBe(false);
    });

    it("returns true for unknown player via callback", () => {
      let callbackValue: boolean | undefined;
      mockWorld.emit(EventType.UI_AUTO_RETALIATE_GET, {
        playerId: "unknown",
        callback: (enabled: boolean) => {
          callbackValue = enabled;
        },
      });

      expect(callbackValue).toBe(true);
    });
  });
});

describe("Server Handler Input Validation", () => {
  /**
   * Simulates the server handler validation logic from combat.ts
   */
  function validateSetAutoRetaliateRequest(data: unknown): {
    valid: boolean;
    error?: string;
  } {
    // Validate request structure
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Invalid request format" };
    }

    const payload = data as Record<string, unknown>;

    // Validate enabled field is a boolean
    if (typeof payload.enabled !== "boolean") {
      return { valid: false, error: "Invalid enabled value type" };
    }

    return { valid: true };
  }

  it("accepts valid boolean true", () => {
    const result = validateSetAutoRetaliateRequest({ enabled: true });
    expect(result.valid).toBe(true);
  });

  it("accepts valid boolean false", () => {
    const result = validateSetAutoRetaliateRequest({ enabled: false });
    expect(result.valid).toBe(true);
  });

  it("rejects string 'true'", () => {
    const result = validateSetAutoRetaliateRequest({ enabled: "true" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid enabled value type");
  });

  it("rejects number 1", () => {
    const result = validateSetAutoRetaliateRequest({ enabled: 1 });
    expect(result.valid).toBe(false);
  });

  it("rejects null", () => {
    const result = validateSetAutoRetaliateRequest(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid request format");
  });

  it("rejects undefined", () => {
    const result = validateSetAutoRetaliateRequest(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects missing enabled field", () => {
    const result = validateSetAutoRetaliateRequest({ playerId: "test" });
    expect(result.valid).toBe(false);
  });
});
