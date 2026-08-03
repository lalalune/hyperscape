/**
 * Agility Persistence Integration Tests
 *
 * Tests the agility skill persistence flow to ensure:
 * - Agility level and XP load correctly from database
 * - Agility XP gains are saved to database
 * - Death resets agility progress (tiles traveled, not XP)
 * - Skill data flows correctly through the system
 *
 * @see AGILITY_IMPLEMENTATION_PLAN.md
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface SkillData {
  level: number;
  xp: number;
}

interface PlayerSkills {
  attack: SkillData;
  strength: SkillData;
  defense: SkillData;
  constitution: SkillData;
  ranged: SkillData;
  prayer: SkillData;
  woodcutting: SkillData;
  mining: SkillData;
  fishing: SkillData;
  firemaking: SkillData;
  cooking: SkillData;
  smithing: SkillData;
  agility: SkillData;
}

interface PlayerRow {
  playerId: string;
  agilityLevel: number;
  agilityXp: number;
  // Other fields omitted for brevity
}

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Simulates database storage
 */
class MockDatabase {
  private players = new Map<string, PlayerRow>();

  setPlayer(playerId: string, data: Partial<PlayerRow>): void {
    const existing = this.players.get(playerId) || {
      playerId,
      agilityLevel: 1,
      agilityXp: 0,
    };
    this.players.set(playerId, { ...existing, ...data });
  }

  getPlayer(playerId: string): PlayerRow | null {
    return this.players.get(playerId) || null;
  }

  clear(): void {
    this.players.clear();
  }
}

/**
 * Simulates SkillsSystem behavior
 */
class MockSkillsSystem {
  private skillData = new Map<string, PlayerSkills>();

  initializePlayer(playerId: string, skills: Partial<PlayerSkills>): void {
    const defaultSkill: SkillData = { level: 1, xp: 0 };
    this.skillData.set(playerId, {
      attack: skills.attack || defaultSkill,
      strength: skills.strength || defaultSkill,
      defense: skills.defense || defaultSkill,
      constitution: skills.constitution || { level: 10, xp: 1154 },
      ranged: skills.ranged || defaultSkill,
      prayer: skills.prayer || defaultSkill,
      woodcutting: skills.woodcutting || defaultSkill,
      mining: skills.mining || defaultSkill,
      fishing: skills.fishing || defaultSkill,
      firemaking: skills.firemaking || defaultSkill,
      cooking: skills.cooking || defaultSkill,
      smithing: skills.smithing || defaultSkill,
      agility: skills.agility || defaultSkill,
    });
  }

  getSkillData(
    playerId: string,
    skill: keyof PlayerSkills,
  ): SkillData | undefined {
    return this.skillData.get(playerId)?.[skill];
  }

  grantXP(
    playerId: string,
    skill: keyof PlayerSkills,
    amount: number,
  ): SkillData {
    const skills = this.skillData.get(playerId);
    if (!skills) {
      throw new Error(`Player ${playerId} not initialized`);
    }

    const currentData = skills[skill];
    const newXp = currentData.xp + amount;
    const newLevel = this.calculateLevel(newXp);

    const newData: SkillData = { level: newLevel, xp: newXp };
    skills[skill] = newData;

    return newData;
  }

  private calculateLevel(xp: number): number {
    // Simplified classic MMORPG XP table (approximation)
    if (xp < 83) return 1;
    if (xp < 174) return 2;
    if (xp < 276) return 3;
    if (xp < 388) return 4;
    if (xp < 512) return 5;
    // ... more levels would go here
    return Math.min(99, Math.floor(Math.sqrt(xp / 10)) + 1);
  }

  clear(): void {
    this.skillData.clear();
  }
}

/**
 * Simulates TileMovementManager's agility tracking
 */
class MockTileMovementManager {
  private tilesTraveledForXP = new Map<string, number>();
  private readonly TILES_PER_GRANT = 100;
  private readonly XP_PER_GRANT = 50;

  recordTilesMoved(playerId: string, tiles: number): number {
    const current = this.tilesTraveledForXP.get(playerId) || 0;
    const newTotal = current + tiles;

    if (newTotal >= this.TILES_PER_GRANT) {
      const grants = Math.floor(newTotal / this.TILES_PER_GRANT);
      const xpToGrant = grants * this.XP_PER_GRANT;
      this.tilesTraveledForXP.set(playerId, newTotal % this.TILES_PER_GRANT);
      return xpToGrant;
    }

    this.tilesTraveledForXP.set(playerId, newTotal);
    return 0;
  }

  getTilesProgress(playerId: string): number {
    return this.tilesTraveledForXP.get(playerId) || 0;
  }

  resetAgilityProgress(playerId: string): void {
    this.tilesTraveledForXP.set(playerId, 0);
  }

  cleanup(playerId: string): void {
    this.tilesTraveledForXP.delete(playerId);
  }

  clear(): void {
    this.tilesTraveledForXP.clear();
  }
}

/**
 * Simulates the full persistence flow
 */
class MockPersistenceManager {
  constructor(
    private db: MockDatabase,
    private skillsSystem: MockSkillsSystem,
    private tileMovement: MockTileMovementManager,
  ) {}

  /**
   * Simulate player connecting and loading from DB
   */
  async loadPlayer(playerId: string): Promise<void> {
    const playerData = this.db.getPlayer(playerId);

    if (playerData) {
      this.skillsSystem.initializePlayer(playerId, {
        agility: {
          level: playerData.agilityLevel,
          xp: playerData.agilityXp,
        },
      });
    } else {
      // New player - use defaults
      this.skillsSystem.initializePlayer(playerId, {});
    }
  }

  /**
   * Simulate saving player data to DB
   */
  async savePlayer(playerId: string): Promise<void> {
    const agility = this.skillsSystem.getSkillData(playerId, "agility");
    if (agility) {
      this.db.setPlayer(playerId, {
        agilityLevel: agility.level,
        agilityXp: agility.xp,
      });
    }
  }

  /**
   * Simulate XP gain from movement
   */
  handleMovement(playerId: string, tilesMoved: number): number {
    const xpToGrant = this.tileMovement.recordTilesMoved(playerId, tilesMoved);

    if (xpToGrant > 0) {
      this.skillsSystem.grantXP(playerId, "agility", xpToGrant);
    }

    return xpToGrant;
  }

  /**
   * Simulate player death
   */
  handleDeath(playerId: string): void {
    this.tileMovement.resetAgilityProgress(playerId);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe("AgilityPersistence", () => {
  let db: MockDatabase;
  let skillsSystem: MockSkillsSystem;
  let tileMovement: MockTileMovementManager;
  let persistence: MockPersistenceManager;

  beforeEach(() => {
    db = new MockDatabase();
    skillsSystem = new MockSkillsSystem();
    tileMovement = new MockTileMovementManager();
    persistence = new MockPersistenceManager(db, skillsSystem, tileMovement);
  });

  describe("Loading from Database", () => {
    it("loads agility level and XP for existing player", async () => {
      const playerId = "player-123";

      // Set up existing player in DB
      db.setPlayer(playerId, {
        agilityLevel: 25,
        agilityXp: 8740,
      });

      // Load player
      await persistence.loadPlayer(playerId);

      // Verify skills loaded correctly
      const agility = skillsSystem.getSkillData(playerId, "agility");
      expect(agility).toBeDefined();
      expect(agility?.level).toBe(25);
      expect(agility?.xp).toBe(8740);
    });

    it("uses default values for new player", async () => {
      const playerId = "new-player";

      // Load player (no existing data)
      await persistence.loadPlayer(playerId);

      // Verify default values
      const agility = skillsSystem.getSkillData(playerId, "agility");
      expect(agility).toBeDefined();
      expect(agility?.level).toBe(1);
      expect(agility?.xp).toBe(0);
    });

    it("handles level 99 player correctly", async () => {
      const playerId = "maxed-player";

      db.setPlayer(playerId, {
        agilityLevel: 99,
        agilityXp: 13034431, // Max XP for level 99
      });

      await persistence.loadPlayer(playerId);

      const agility = skillsSystem.getSkillData(playerId, "agility");
      expect(agility?.level).toBe(99);
      expect(agility?.xp).toBe(13034431);
    });
  });

  describe("Saving to Database", () => {
    it("saves agility progress to database", async () => {
      const playerId = "player-123";

      // Initialize and grant some XP
      await persistence.loadPlayer(playerId);
      skillsSystem.grantXP(playerId, "agility", 500);

      // Save to DB
      await persistence.savePlayer(playerId);

      // Verify DB was updated
      const saved = db.getPlayer(playerId);
      expect(saved?.agilityXp).toBe(500);
    });

    it("persists level ups correctly", async () => {
      const playerId = "player-123";

      await persistence.loadPlayer(playerId);

      // Grant enough XP to level up
      skillsSystem.grantXP(playerId, "agility", 200);

      await persistence.savePlayer(playerId);

      const saved = db.getPlayer(playerId);
      expect(saved?.agilityXp).toBe(200);
      expect(saved?.agilityLevel).toBeGreaterThan(1);
    });
  });

  describe("Movement XP Tracking", () => {
    it("accumulates tiles toward XP threshold", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Move 50 tiles (not enough for XP)
      const xp1 = persistence.handleMovement(playerId, 50);
      expect(xp1).toBe(0);
      expect(tileMovement.getTilesProgress(playerId)).toBe(50);

      // Move 30 more tiles (still not enough)
      const xp2 = persistence.handleMovement(playerId, 30);
      expect(xp2).toBe(0);
      expect(tileMovement.getTilesProgress(playerId)).toBe(80);
    });

    it("grants XP when reaching 100 tiles", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Move exactly 100 tiles
      const xp = persistence.handleMovement(playerId, 100);
      expect(xp).toBe(50);
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);

      // Verify XP was added to skill
      const agility = skillsSystem.getSkillData(playerId, "agility");
      expect(agility?.xp).toBe(50);
    });

    it("handles multiple XP grants in one movement", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Move 250 tiles (2 full grants + 50 remaining)
      const xp = persistence.handleMovement(playerId, 250);
      expect(xp).toBe(100); // 2 grants * 50 XP
      expect(tileMovement.getTilesProgress(playerId)).toBe(50);

      const agility = skillsSystem.getSkillData(playerId, "agility");
      expect(agility?.xp).toBe(100);
    });

    it("preserves partial progress across movements", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Move 75 tiles
      persistence.handleMovement(playerId, 75);
      expect(tileMovement.getTilesProgress(playerId)).toBe(75);

      // Move 50 more (total 125 = 1 grant + 25 remaining)
      const xp = persistence.handleMovement(playerId, 50);
      expect(xp).toBe(50);
      expect(tileMovement.getTilesProgress(playerId)).toBe(25);
    });
  });

  describe("Death Reset", () => {
    it("resets tile progress on death", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Accumulate some tiles
      persistence.handleMovement(playerId, 75);
      expect(tileMovement.getTilesProgress(playerId)).toBe(75);

      // Die
      persistence.handleDeath(playerId);

      // Progress should be reset
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);
    });

    it("does NOT reset earned XP on death", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Earn some XP
      persistence.handleMovement(playerId, 100);
      const agilityBefore = skillsSystem.getSkillData(playerId, "agility");
      expect(agilityBefore?.xp).toBe(50);

      // Die
      persistence.handleDeath(playerId);

      // XP should remain
      const agilityAfter = skillsSystem.getSkillData(playerId, "agility");
      expect(agilityAfter?.xp).toBe(50);
    });

    it("only loses partial progress on death, not full 100 tiles worth", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Move 175 tiles (1 grant + 75 partial)
      persistence.handleMovement(playerId, 175);
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(50);
      expect(tileMovement.getTilesProgress(playerId)).toBe(75);

      // Die - only lose the 75 partial tiles, not the 50 XP already earned
      persistence.handleDeath(playerId);

      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(50);
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);
    });
  });

  describe("Full Session Simulation", () => {
    it("simulates a complete play session with persistence", async () => {
      const playerId = "player-123";

      // === Session 1: New player starts ===
      await persistence.loadPlayer(playerId);
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(0);

      // Walk around, gain some XP
      persistence.handleMovement(playerId, 350); // 3 grants = 150 XP, 50 remaining
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(150);
      expect(tileMovement.getTilesProgress(playerId)).toBe(50);

      // Die (lose 50 tile progress, keep 150 XP)
      persistence.handleDeath(playerId);
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(150);
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);

      // Walk more after respawn
      persistence.handleMovement(playerId, 100); // 1 grant = 50 XP
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(200);

      // Save and disconnect
      await persistence.savePlayer(playerId);
      tileMovement.cleanup(playerId);

      // === Session 2: Player reconnects ===
      skillsSystem.clear();

      await persistence.loadPlayer(playerId);

      // Should have 200 XP from previous session
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(200);

      // Tile progress is NOT persisted (starts at 0)
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);

      // Continue playing
      persistence.handleMovement(playerId, 100);
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(250);
    });
  });

  describe("Edge Cases", () => {
    it("handles very large movement in single tick", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Teleport across map (hypothetical large movement)
      const xp = persistence.handleMovement(playerId, 1000);
      expect(xp).toBe(500); // 10 grants
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);
    });

    it("handles zero tile movement", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      const xp = persistence.handleMovement(playerId, 0);
      expect(xp).toBe(0);
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);
    });

    it("handles rapid movement and death cycle", async () => {
      const playerId = "player-123";
      await persistence.loadPlayer(playerId);

      // Walk, die, walk, die repeatedly
      persistence.handleMovement(playerId, 75);
      persistence.handleDeath(playerId);
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);

      persistence.handleMovement(playerId, 50);
      persistence.handleDeath(playerId);
      expect(tileMovement.getTilesProgress(playerId)).toBe(0);

      // No XP should be earned (never hit 100 tiles)
      expect(skillsSystem.getSkillData(playerId, "agility")?.xp).toBe(0);
    });
  });
});
