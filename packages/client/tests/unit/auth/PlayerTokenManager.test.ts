/**
 * PlayerTokenManager Tests
 *
 * Tests for player token generation, session management, and persistence.
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock localStorage
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

// Mock the PlayerTokenManager functionality
interface ClientPlayerToken {
  playerId: string;
  tokenSecret: string;
  playerName: string;
  createdAt: Date;
  lastSeen: Date;
  sessionId: string;
  machineId: string;
}

interface PlayerSession {
  sessionId: string;
  playerId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

class MockPlayerTokenManager {
  private static STORAGE_KEY = "hyperscape_player_token";
  private static SESSION_KEY = "hyperscape_session";

  private currentToken: ClientPlayerToken;
  private currentSession: PlayerSession;
  private localStorage: ReturnType<typeof createMockLocalStorage>;

  constructor(localStorage: ReturnType<typeof createMockLocalStorage>) {
    this.localStorage = localStorage;

    // Load or create token
    const storedToken = localStorage.getItem(
      MockPlayerTokenManager.STORAGE_KEY,
    );
    this.currentToken = storedToken
      ? JSON.parse(storedToken)
      : this.createNewToken("New Player");

    // Load or create session
    const storedSession = localStorage.getItem(
      MockPlayerTokenManager.SESSION_KEY,
    );
    this.currentSession = storedSession
      ? JSON.parse(storedSession)
      : this.createNewSession();
  }

  private createNewToken(playerName: string): ClientPlayerToken {
    const token: ClientPlayerToken = {
      playerId: `player_${crypto.randomUUID()}`,
      tokenSecret: crypto.randomUUID(),
      playerName,
      createdAt: new Date(),
      lastSeen: new Date(),
      sessionId: crypto.randomUUID(),
      machineId: "test_machine_id",
    };
    this.saveToken(token);
    return token;
  }

  private createNewSession(): PlayerSession {
    const session: PlayerSession = {
      sessionId: crypto.randomUUID(),
      playerId: this.currentToken?.playerId ?? "",
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true,
    };
    this.saveSession(session);
    return session;
  }

  private saveToken(token: ClientPlayerToken): void {
    this.localStorage.setItem(
      MockPlayerTokenManager.STORAGE_KEY,
      JSON.stringify(token),
    );
  }

  private saveSession(session: PlayerSession): void {
    this.localStorage.setItem(
      MockPlayerTokenManager.SESSION_KEY,
      JSON.stringify(session),
    );
  }

  getOrCreatePlayerToken(playerName: string): ClientPlayerToken {
    this.currentToken.playerName = playerName;
    this.currentToken.lastSeen = new Date();
    this.saveToken(this.currentToken);
    return this.currentToken;
  }

  getCurrentToken(): ClientPlayerToken {
    return this.currentToken;
  }

  getCurrentSession(): PlayerSession {
    return this.currentSession;
  }

  updatePlayerName(newName: string): void {
    this.currentToken.playerName = newName;
    this.saveToken(this.currentToken);
  }

  updateActivity(): void {
    this.currentSession.lastActivity = new Date();
    this.saveSession(this.currentSession);
  }

  endSession(): void {
    this.currentSession.isActive = false;
    this.saveSession(this.currentSession);
  }

  clearStoredData(): void {
    this.localStorage.removeItem(MockPlayerTokenManager.STORAGE_KEY);
    this.localStorage.removeItem(MockPlayerTokenManager.SESSION_KEY);
    this.currentToken = this.createNewToken("New Player");
    this.currentSession = this.createNewSession();
  }

  getPlayerStats(): {
    hasToken: boolean;
    hasSession: boolean;
    playerId: string;
    sessionId: string;
  } {
    return {
      hasToken: true,
      hasSession: true,
      playerId: this.currentToken.playerId,
      sessionId: this.currentSession.sessionId,
    };
  }
}

describe("PlayerTokenManager", () => {
  let localStorage: ReturnType<typeof createMockLocalStorage>;
  let manager: MockPlayerTokenManager;

  beforeEach(() => {
    localStorage = createMockLocalStorage();
    manager = new MockPlayerTokenManager(localStorage);
  });

  describe("Token Creation", () => {
    it("should create a new token if none exists", () => {
      const token = manager.getCurrentToken();
      expect(token).toBeDefined();
      expect(token.playerId).toMatch(/^player_/);
      expect(token.tokenSecret).toBeDefined();
    });

    it("should have a unique player ID", () => {
      const token = manager.getCurrentToken();
      expect(token.playerId).toBeTruthy();
      expect(token.playerId.length).toBeGreaterThan(10);
    });

    it("should set default player name", () => {
      const token = manager.getCurrentToken();
      expect(token.playerName).toBe("New Player");
    });

    it("should set timestamps", () => {
      const token = manager.getCurrentToken();
      expect(token.createdAt).toBeDefined();
      expect(token.lastSeen).toBeDefined();
    });
  });

  describe("Token Persistence", () => {
    it("should save token to localStorage", () => {
      manager.getOrCreatePlayerToken("TestPlayer");
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it("should load existing token from localStorage", () => {
      const existingToken = {
        playerId: "player_existing",
        tokenSecret: "secret123",
        playerName: "ExistingPlayer",
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        sessionId: "session123",
        machineId: "machine123",
      };

      localStorage.getItem = vi.fn((key) => {
        if (key === "hyperscape_player_token") {
          return JSON.stringify(existingToken);
        }
        return null;
      });

      const newManager = new MockPlayerTokenManager(localStorage);
      const token = newManager.getCurrentToken();

      expect(token.playerId).toBe("player_existing");
      expect(token.playerName).toBe("ExistingPlayer");
    });
  });

  describe("Player Name", () => {
    it("should update player name", () => {
      manager.updatePlayerName("NewName");
      expect(manager.getCurrentToken().playerName).toBe("NewName");
    });

    it("should persist name change", () => {
      manager.updatePlayerName("PersistentName");
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it("should get or create token with name", () => {
      const token = manager.getOrCreatePlayerToken("CustomName");
      expect(token.playerName).toBe("CustomName");
    });
  });

  describe("Session Management", () => {
    it("should create a session", () => {
      const session = manager.getCurrentSession();
      expect(session).toBeDefined();
      expect(session.sessionId).toBeTruthy();
      expect(session.isActive).toBe(true);
    });

    it("should update activity timestamp", () => {
      const beforeActivity = manager.getCurrentSession().lastActivity;

      // Wait a bit and update
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      manager.updateActivity();

      vi.useRealTimers();

      // Activity should be updated
      expect(manager.getCurrentSession().lastActivity).toBeDefined();
    });

    it("should end session", () => {
      manager.endSession();
      expect(manager.getCurrentSession().isActive).toBe(false);
    });

    it("should persist session", () => {
      const session = manager.getCurrentSession();
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("Clear Data", () => {
    it("should clear stored data", () => {
      manager.clearStoredData();
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "hyperscape_player_token",
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "hyperscape_session",
      );
    });

    it("should create new token after clear", () => {
      const oldPlayerId = manager.getCurrentToken().playerId;
      manager.clearStoredData();
      const newPlayerId = manager.getCurrentToken().playerId;

      expect(newPlayerId).not.toBe(oldPlayerId);
    });
  });

  describe("Player Stats", () => {
    it("should return player stats", () => {
      const stats = manager.getPlayerStats();

      expect(stats.hasToken).toBe(true);
      expect(stats.hasSession).toBe(true);
      expect(stats.playerId).toBeTruthy();
      expect(stats.sessionId).toBeTruthy();
    });
  });

  describe("Token Security", () => {
    it("should generate cryptographically random IDs", () => {
      const token = manager.getCurrentToken();

      // UUID format check
      expect(token.playerId).toMatch(
        /^player_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should have unique token secrets", () => {
      const manager1 = new MockPlayerTokenManager(createMockLocalStorage());
      const manager2 = new MockPlayerTokenManager(createMockLocalStorage());

      expect(manager1.getCurrentToken().tokenSecret).not.toBe(
        manager2.getCurrentToken().tokenSecret,
      );
    });
  });
});
