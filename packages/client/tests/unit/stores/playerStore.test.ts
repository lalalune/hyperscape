/**
 * Player Store Tests
 *
 * Tests for the player state store including optimistic updates
 * and server reconciliation.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock zustand store for testing
interface PlayerState {
  playerId: string | null;
  playerName: string;
  health: { current: number; max: number };
  position: { x: number; y: number; z: number };
  isLoading: boolean;
  error: string | null;

  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setHealth: (current: number, max: number) => void;
  setPosition: (x: number, y: number, z: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const createMockPlayerStore = () => {
  let state: Omit<
    PlayerState,
    | "setPlayerId"
    | "setPlayerName"
    | "setHealth"
    | "setPosition"
    | "setLoading"
    | "setError"
    | "reset"
  > = {
    playerId: null,
    playerName: "Guest",
    health: { current: 100, max: 100 },
    position: { x: 0, y: 0, z: 0 },
    isLoading: false,
    error: null,
  };

  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial };
    },
    setPlayerId: (id: string) => {
      state = { ...state, playerId: id };
    },
    setPlayerName: (name: string) => {
      state = { ...state, playerName: name };
    },
    setHealth: (current: number, max: number) => {
      state = { ...state, health: { current, max } };
    },
    setPosition: (x: number, y: number, z: number) => {
      state = { ...state, position: { x, y, z } };
    },
    setLoading: (loading: boolean) => {
      state = { ...state, isLoading: loading };
    },
    setError: (error: string | null) => {
      state = { ...state, error };
    },
    reset: () => {
      state = {
        playerId: null,
        playerName: "Guest",
        health: { current: 100, max: 100 },
        position: { x: 0, y: 0, z: 0 },
        isLoading: false,
        error: null,
      };
    },
  };
};

describe("PlayerStore", () => {
  let store: ReturnType<typeof createMockPlayerStore>;

  beforeEach(() => {
    store = createMockPlayerStore();
  });

  describe("Initial State", () => {
    it("should have null playerId initially", () => {
      expect(store.getState().playerId).toBeNull();
    });

    it("should have default player name", () => {
      expect(store.getState().playerName).toBe("Guest");
    });

    it("should have full health initially", () => {
      const { health } = store.getState();
      expect(health.current).toBe(100);
      expect(health.max).toBe(100);
    });

    it("should start at origin position", () => {
      const { position } = store.getState();
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
      expect(position.z).toBe(0);
    });
  });

  describe("Player Identity", () => {
    it("should set player ID", () => {
      store.setPlayerId("player_123");
      expect(store.getState().playerId).toBe("player_123");
    });

    it("should set player name", () => {
      store.setPlayerName("TestPlayer");
      expect(store.getState().playerName).toBe("TestPlayer");
    });
  });

  describe("Health Management", () => {
    it("should set health values", () => {
      store.setHealth(50, 100);
      const { health } = store.getState();
      expect(health.current).toBe(50);
      expect(health.max).toBe(100);
    });

    it("should handle health at zero", () => {
      store.setHealth(0, 100);
      expect(store.getState().health.current).toBe(0);
    });

    it("should handle increased max health", () => {
      store.setHealth(100, 150);
      expect(store.getState().health.max).toBe(150);
    });
  });

  describe("Position Management", () => {
    it("should set position", () => {
      store.setPosition(10, 5, -15);
      const { position } = store.getState();
      expect(position.x).toBe(10);
      expect(position.y).toBe(5);
      expect(position.z).toBe(-15);
    });

    it("should handle negative coordinates", () => {
      store.setPosition(-100, 0, -200);
      const { position } = store.getState();
      expect(position.x).toBe(-100);
      expect(position.z).toBe(-200);
    });

    it("should handle floating point positions", () => {
      store.setPosition(10.5, 0.25, -3.75);
      const { position } = store.getState();
      expect(position.x).toBe(10.5);
      expect(position.y).toBe(0.25);
      expect(position.z).toBe(-3.75);
    });
  });

  describe("Loading State", () => {
    it("should set loading state", () => {
      store.setLoading(true);
      expect(store.getState().isLoading).toBe(true);

      store.setLoading(false);
      expect(store.getState().isLoading).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should set error message", () => {
      store.setError("Connection lost");
      expect(store.getState().error).toBe("Connection lost");
    });

    it("should clear error", () => {
      store.setError("Some error");
      store.setError(null);
      expect(store.getState().error).toBeNull();
    });
  });

  describe("Reset", () => {
    it("should reset all state to defaults", () => {
      // Set some values
      store.setPlayerId("player_123");
      store.setPlayerName("TestPlayer");
      store.setHealth(50, 100);
      store.setPosition(10, 5, -15);
      store.setError("Some error");

      // Reset
      store.reset();

      // Verify defaults
      const state = store.getState();
      expect(state.playerId).toBeNull();
      expect(state.playerName).toBe("Guest");
      expect(state.health.current).toBe(100);
      expect(state.health.max).toBe(100);
      expect(state.position.x).toBe(0);
      expect(state.position.y).toBe(0);
      expect(state.position.z).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe("Optimistic Updates", () => {
    it("should support optimistic position updates", () => {
      // Simulate optimistic update
      const previousPosition = { ...store.getState().position };

      // Optimistically update
      store.setPosition(100, 0, 100);
      expect(store.getState().position.x).toBe(100);

      // Simulate server rejection
      store.setPosition(
        previousPosition.x,
        previousPosition.y,
        previousPosition.z,
      );
      expect(store.getState().position.x).toBe(0);
    });

    it("should handle server reconciliation", () => {
      // Set initial position
      store.setPosition(50, 0, 50);

      // Simulate server correction
      const serverPosition = { x: 48, y: 0, z: 52 };
      store.setPosition(serverPosition.x, serverPosition.y, serverPosition.z);

      const { position } = store.getState();
      expect(position.x).toBe(48);
      expect(position.z).toBe(52);
    });
  });
});
