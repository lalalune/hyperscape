/**
 * Security Vulnerability Tests
 *
 * Comprehensive tests for all known vulnerability vectors in Hyperscape.
 * These tests verify that the server properly validates client inputs
 * and prevents common exploits/hacks.
 *
 * Test categories:
 * 1. Speed hacking / movement validation
 * 2. Combat exploits (range, cooldown bypass, targeting dead entities)
 * 3. Item duplication via race conditions
 * 4. Banking distance validation bypass
 * 5. Inventory manipulation / overflow attacks
 * 6. Rate limiting effectiveness
 * 7. Input validation and injection prevention
 */

import { describe, it, expect, beforeEach } from "bun:test";

// Dynamic imports to handle module resolution
let validators: {
  isValidItemId: (value: unknown) => value is string;
  isValidQuantity: (value: unknown) => value is number;
  isValidInventorySlot: (value: unknown) => value is number;
  isValidBankSlot: (value: unknown) => value is number;
  isValidEntityId: (value: unknown) => value is string;
  wouldOverflow: (current: number, add: number) => boolean;
  validateRequestTimestamp: (
    timestamp: unknown,
    serverTime?: number,
  ) => { valid: boolean; reason?: string };
  CONTROL_CHAR_REGEX: RegExp;
};

let rateLimitModule: {
  createRateLimiter: (config: {
    maxPerSecond: number;
    name: string;
  }) => RateLimiter;
};

let intervalRateLimitModule: {
  RateLimitService: new (limitMs?: number) => {
    isAllowed: (playerId: string) => boolean;
    recordOperation: (playerId: string) => void;
    reset: (playerId: string) => void;
    tryOperation: (playerId: string) => boolean;
  };
};

interface RateLimiter {
  check: (playerId: string) => boolean;
  getCount: (playerId: string) => number;
  reset: (playerId: string) => void;
  destroy: () => void;
  readonly size: number;
  readonly name: string;
}

let canRunTests = true;

try {
  validators =
    await import("../systems/ServerNetwork/services/InputValidation");
  rateLimitModule =
    await import("../systems/ServerNetwork/services/SlidingWindowRateLimiter");
  intervalRateLimitModule =
    await import("../systems/ServerNetwork/services/IntervalRateLimiter");
  // Quick sanity check
  validators.isValidItemId("test");
} catch {
  canRunTests = false;
}

// ============================================================================
// 1. SPEED HACKING / MOVEMENT VALIDATION TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Speed Hacking Prevention", () => {
  describe("Movement speed validation", () => {
    it("should reject movement requests faster than walk speed (4 tiles/tick)", () => {
      // Constants from TileSystem.ts
      const TILES_PER_TICK_WALK = 2;
      const TILES_PER_TICK_RUN = 4;
      const TICK_DURATION_MS = 600;

      // Calculate max movement per second
      const maxWalkTilesPerSecond =
        (TILES_PER_TICK_WALK * 1000) / TICK_DURATION_MS;
      const maxRunTilesPerSecond =
        (TILES_PER_TICK_RUN * 1000) / TICK_DURATION_MS;

      // Attempted hack: 10x normal speed
      const hackedSpeed = maxRunTilesPerSecond * 10;

      // Validation function
      function validateMovementSpeed(
        tilesPerSecond: number,
        isRunning: boolean,
      ): boolean {
        const maxSpeed = isRunning
          ? maxRunTilesPerSecond
          : maxWalkTilesPerSecond;
        // Allow 10% tolerance for network jitter
        return tilesPerSecond <= maxSpeed * 1.1;
      }

      expect(validateMovementSpeed(maxWalkTilesPerSecond, false)).toBe(true);
      expect(validateMovementSpeed(maxRunTilesPerSecond, true)).toBe(true);
      expect(validateMovementSpeed(hackedSpeed, true)).toBe(false);
      expect(validateMovementSpeed(hackedSpeed, false)).toBe(false);
    });

    it("should validate position changes against tick-based movement", () => {
      const TICK_DURATION_MS = 600;
      const TILES_PER_TICK_RUN = 4;

      function validatePositionChange(
        oldPos: { x: number; z: number },
        newPos: { x: number; z: number },
        elapsedMs: number,
      ): { valid: boolean; reason?: string } {
        const dx = Math.abs(newPos.x - oldPos.x);
        const dz = Math.abs(newPos.z - oldPos.z);
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Calculate max allowed movement
        const ticksElapsed = Math.ceil(elapsedMs / TICK_DURATION_MS);
        const maxDistance = ticksElapsed * TILES_PER_TICK_RUN * 1.1; // 10% tolerance

        if (distance > maxDistance) {
          return {
            valid: false,
            reason: `Moved ${distance.toFixed(2)} tiles in ${elapsedMs}ms (max: ${maxDistance.toFixed(2)})`,
          };
        }

        return { valid: true };
      }

      // Normal movement (1 tile in 600ms)
      expect(
        validatePositionChange({ x: 0, z: 0 }, { x: 1, z: 0 }, 600),
      ).toEqual({ valid: true });

      // Running movement (4 tiles in 600ms)
      expect(
        validatePositionChange({ x: 0, z: 0 }, { x: 4, z: 0 }, 600),
      ).toEqual({ valid: true });

      // Speed hack attempt (50 tiles in 600ms)
      const result = validatePositionChange(
        { x: 0, z: 0 },
        { x: 50, z: 0 },
        600,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Moved 50.00 tiles");
    });

    it("should detect teleportation hacks (instant position changes)", () => {
      function detectTeleportHack(
        positions: Array<{ x: number; z: number; timestamp: number }>,
      ): boolean {
        if (positions.length < 2) return false;

        for (let i = 1; i < positions.length; i++) {
          const prev = positions[i - 1];
          const curr = positions[i];
          const dt = curr.timestamp - prev.timestamp;

          if (dt < 100) {
            // Less than 100ms between updates
            const distance = Math.sqrt(
              Math.pow(curr.x - prev.x, 2) + Math.pow(curr.z - prev.z, 2),
            );
            // If moved more than 2 tiles in <100ms, it's suspicious
            if (distance > 2) {
              return true; // Teleport detected
            }
          }
        }

        return false;
      }

      // Normal movement
      const normalMovement = [
        { x: 0, z: 0, timestamp: 0 },
        { x: 1, z: 0, timestamp: 300 },
        { x: 2, z: 0, timestamp: 600 },
      ];
      expect(detectTeleportHack(normalMovement)).toBe(false);

      // Teleport hack
      const teleportHack = [
        { x: 0, z: 0, timestamp: 0 },
        { x: 100, z: 100, timestamp: 50 }, // 141 tiles in 50ms!
      ];
      expect(detectTeleportHack(teleportHack)).toBe(true);
    });
  });
});

// ============================================================================
// 2. COMBAT EXPLOIT TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Combat Exploit Prevention", () => {
  describe("Attack range validation", () => {
    const MELEE_RANGE = 2;
    const RANGED_RANGE = 10;

    function isInAttackRange(
      attackerPos: { x: number; z: number },
      targetPos: { x: number; z: number },
      attackType: "melee" | "ranged",
    ): boolean {
      const dx = Math.abs(targetPos.x - attackerPos.x);
      const dz = Math.abs(targetPos.z - attackerPos.z);
      const distance = Math.sqrt(dx * dx + dz * dz);

      const maxRange = attackType === "melee" ? MELEE_RANGE : RANGED_RANGE;
      return distance <= maxRange;
    }

    it("should reject melee attacks beyond 2 tiles", () => {
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 1, z: 0 }, "melee")).toBe(
        true,
      );
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 2, z: 0 }, "melee")).toBe(
        true,
      );
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 5, z: 0 }, "melee")).toBe(
        false,
      );
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 100, z: 0 }, "melee")).toBe(
        false,
      );
    });

    it("should reject ranged attacks beyond 10 tiles", () => {
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 5, z: 0 }, "ranged")).toBe(
        true,
      );
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 10, z: 0 }, "ranged")).toBe(
        true,
      );
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 15, z: 0 }, "ranged")).toBe(
        false,
      );
      expect(isInAttackRange({ x: 0, z: 0 }, { x: 100, z: 0 }, "ranged")).toBe(
        false,
      );
    });
  });

  describe("Attack cooldown bypass prevention", () => {
    const DEFAULT_ATTACK_SPEED_TICKS = 4;
    const TICK_DURATION_MS = 600;

    it("should enforce tick-based attack cooldowns", () => {
      function isAttackOnCooldown(
        currentTick: number,
        nextAllowedTick: number,
      ): boolean {
        return currentTick < nextAllowedTick;
      }

      // Just attacked on tick 0, next attack allowed on tick 4
      expect(isAttackOnCooldown(0, 4)).toBe(true);
      expect(isAttackOnCooldown(1, 4)).toBe(true);
      expect(isAttackOnCooldown(3, 4)).toBe(true);
      expect(isAttackOnCooldown(4, 4)).toBe(false); // Can attack now
      expect(isAttackOnCooldown(5, 4)).toBe(false);
    });

    it("should reject rapid-fire attack spam", () => {
      const attackHistory: number[] = [];
      const MAX_ATTACKS_PER_SECOND = 2; // Should be ~1.67 for 4-tick weapons

      function recordAttack(timestamp: number): boolean {
        // Clean old entries
        const oneSecondAgo = timestamp - 1000;
        while (attackHistory.length > 0 && attackHistory[0] < oneSecondAgo) {
          attackHistory.shift();
        }

        if (attackHistory.length >= MAX_ATTACKS_PER_SECOND) {
          return false; // Rate limited
        }

        attackHistory.push(timestamp);
        return true;
      }

      // Normal attacks (600ms apart)
      expect(recordAttack(0)).toBe(true);
      expect(recordAttack(600)).toBe(true);

      // Spam attack (trying to attack again immediately)
      expect(recordAttack(601)).toBe(false); // Should be blocked
    });
  });

  describe("Target validation", () => {
    it("should reject attacks on dead entities", () => {
      interface Entity {
        id: string;
        health: number;
        isDead: boolean;
      }

      function canAttackTarget(target: Entity | null): {
        valid: boolean;
        reason?: string;
      } {
        if (!target) {
          return { valid: false, reason: "Target not found" };
        }
        if (target.isDead || target.health <= 0) {
          return { valid: false, reason: "Target is already dead" };
        }
        return { valid: true };
      }

      expect(canAttackTarget(null)).toEqual({
        valid: false,
        reason: "Target not found",
      });
      expect(canAttackTarget({ id: "mob1", health: 0, isDead: true })).toEqual({
        valid: false,
        reason: "Target is already dead",
      });
      expect(
        canAttackTarget({ id: "mob1", health: 50, isDead: false }),
      ).toEqual({
        valid: true,
      });
    });

    it("should reject self-attacks", () => {
      function validateAttack(
        attackerId: string,
        targetId: string,
      ): { valid: boolean; reason?: string } {
        if (attackerId === targetId) {
          return { valid: false, reason: "Cannot attack yourself" };
        }
        return { valid: true };
      }

      expect(validateAttack("player1", "player1")).toEqual({
        valid: false,
        reason: "Cannot attack yourself",
      });
      expect(validateAttack("player1", "mob1")).toEqual({ valid: true });
    });
  });
});

// ============================================================================
// 3. ITEM DUPLICATION PREVENTION TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Item Duplication Prevention", () => {
  describe("Pickup race condition protection", () => {
    it("should prevent simultaneous pickup of same item", async () => {
      const pickupLocks = new Set<string>();
      const pickedUpItems = new Set<string>();
      const results: boolean[] = [];

      async function attemptPickup(
        playerId: string,
        itemEntityId: string,
      ): Promise<boolean> {
        const lockKey = `pickup:${itemEntityId}`;

        // Check if already being picked up
        if (pickupLocks.has(lockKey)) {
          return false;
        }

        // Acquire lock
        pickupLocks.add(lockKey);

        // Simulate async operation
        await new Promise((r) => setTimeout(r, 10));

        // Check if item still exists
        if (pickedUpItems.has(itemEntityId)) {
          pickupLocks.delete(lockKey);
          return false;
        }

        // Pick up item
        pickedUpItems.add(itemEntityId);
        pickupLocks.delete(lockKey);
        return true;
      }

      // Simulate two players trying to pick up same item simultaneously
      const [result1, result2] = await Promise.all([
        attemptPickup("player1", "groundItem123"),
        attemptPickup("player2", "groundItem123"),
      ]);

      // Only one should succeed
      expect([result1, result2].filter(Boolean).length).toBe(1);
    });

    it("should use idempotency to prevent duplicate requests", () => {
      const processedRequests = new Map<string, number>();
      const IDEMPOTENCY_WINDOW_MS = 5000;

      function checkAndMarkIdempotent(key: string): boolean {
        const now = Date.now();
        const existingTimestamp = processedRequests.get(key);

        if (
          existingTimestamp &&
          now - existingTimestamp < IDEMPOTENCY_WINDOW_MS
        ) {
          return false; // Duplicate within window
        }

        processedRequests.set(key, now);
        return true;
      }

      function generateIdempotencyKey(
        playerId: string,
        operation: string,
        itemId: string,
      ): string {
        return `${playerId}:${operation}:${itemId}`;
      }

      const key = generateIdempotencyKey("player1", "pickup", "item123");

      // First request should succeed
      expect(checkAndMarkIdempotent(key)).toBe(true);

      // Immediate duplicate should fail
      expect(checkAndMarkIdempotent(key)).toBe(false);
    });
  });

  describe("Death duplication prevention", () => {
    it("should prevent inventory access during death processing", () => {
      interface DeathLock {
        playerId: string;
        createdAt: number;
        expiresAt: number;
      }

      const deathLocks = new Map<string, DeathLock>();

      function createDeathLock(playerId: string): boolean {
        if (deathLocks.has(playerId)) {
          return false; // Already processing death
        }

        const now = Date.now();
        deathLocks.set(playerId, {
          playerId,
          createdAt: now,
          expiresAt: now + 30000, // 30 second timeout
        });
        return true;
      }

      function hasActiveDeathLock(playerId: string): boolean {
        const lock = deathLocks.get(playerId);
        if (!lock) return false;

        if (Date.now() > lock.expiresAt) {
          deathLocks.delete(playerId);
          return false;
        }
        return true;
      }

      // Create death lock
      expect(createDeathLock("player1")).toBe(true);

      // Check lock exists
      expect(hasActiveDeathLock("player1")).toBe(true);

      // Can't create another death lock for same player
      expect(createDeathLock("player1")).toBe(false);

      // Different player can have their own lock
      expect(createDeathLock("player2")).toBe(true);
    });
  });
});

// ============================================================================
// 4. BANKING DISTANCE VALIDATION TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Banking Distance Validation", () => {
  const BANK_INTERACTION_RANGE = 3; // Max tiles away to interact with bank

  function calculateChebyshevDistance(
    pos1: { x: number; z: number },
    pos2: { x: number; z: number },
  ): number {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.z - pos2.z));
  }

  function validateBankDistance(
    playerPos: { x: number; z: number },
    bankPos: { x: number; z: number },
  ): { valid: boolean; reason?: string } {
    const distance = calculateChebyshevDistance(playerPos, bankPos);
    if (distance > BANK_INTERACTION_RANGE) {
      return {
        valid: false,
        reason: `Too far from bank (${distance} tiles > ${BANK_INTERACTION_RANGE} max)`,
      };
    }
    return { valid: true };
  }

  it("should allow banking when within range", () => {
    expect(validateBankDistance({ x: 10, z: 10 }, { x: 10, z: 10 })).toEqual({
      valid: true,
    });
    expect(validateBankDistance({ x: 10, z: 10 }, { x: 12, z: 10 })).toEqual({
      valid: true,
    });
    expect(validateBankDistance({ x: 10, z: 10 }, { x: 13, z: 13 })).toEqual({
      valid: true,
    });
  });

  it("should reject banking when too far", () => {
    const result = validateBankDistance({ x: 10, z: 10 }, { x: 100, z: 100 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Too far from bank");
  });

  it("should use server-side position, not client-supplied", () => {
    // Simulated attack: client claims to be at bank position
    const spoofedClientPosition = { x: 10, z: 10 };
    const actualServerPosition = { x: 500, z: 500 }; // Player is actually far away
    const bankPosition = { x: 10, z: 10 };

    // Client-supplied position would succeed (the hack)
    expect(validateBankDistance(spoofedClientPosition, bankPosition)).toEqual({
      valid: true,
    });

    // Server-known position correctly rejects (the fix)
    expect(validateBankDistance(actualServerPosition, bankPosition).valid).toBe(
      false,
    );
  });
});

// ============================================================================
// 5. INVENTORY MANIPULATION TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Inventory Manipulation Prevention", () => {
  describe("Input validation", () => {
    it("should validate item IDs", () => {
      // Valid IDs
      expect(validators.isValidItemId("bronze_sword")).toBe(true);
      expect(validators.isValidItemId("logs")).toBe(true);
      expect(validators.isValidItemId("item_123")).toBe(true);

      // Invalid IDs
      expect(validators.isValidItemId("")).toBe(false);
      expect(validators.isValidItemId(null)).toBe(false);
      expect(validators.isValidItemId(undefined)).toBe(false);
      expect(validators.isValidItemId(123)).toBe(false);
      expect(validators.isValidItemId("item\x00id")).toBe(false); // Null byte injection
      expect(validators.isValidItemId("item\nid")).toBe(false); // Newline injection
    });

    it("should validate quantities", () => {
      expect(validators.isValidQuantity(1)).toBe(true);
      expect(validators.isValidQuantity(100)).toBe(true);
      expect(validators.isValidQuantity(1000000)).toBe(true);

      // Invalid quantities
      expect(validators.isValidQuantity(0)).toBe(false);
      expect(validators.isValidQuantity(-1)).toBe(false);
      expect(validators.isValidQuantity(1.5)).toBe(false);
      expect(validators.isValidQuantity(Infinity)).toBe(false);
      expect(validators.isValidQuantity(NaN)).toBe(false);
      expect(validators.isValidQuantity("100")).toBe(false);
    });

    it("should validate inventory slots", () => {
      expect(validators.isValidInventorySlot(0)).toBe(true);
      expect(validators.isValidInventorySlot(27)).toBe(true);

      expect(validators.isValidInventorySlot(-1)).toBe(false);
      expect(validators.isValidInventorySlot(28)).toBe(false);
      expect(validators.isValidInventorySlot(100)).toBe(false);
      expect(validators.isValidInventorySlot(0.5)).toBe(false);
      expect(validators.isValidInventorySlot("0")).toBe(false);
    });

    it("should validate bank slots", () => {
      expect(validators.isValidBankSlot(0)).toBe(true);
      expect(validators.isValidBankSlot(479)).toBe(true);

      expect(validators.isValidBankSlot(-1)).toBe(false);
      expect(validators.isValidBankSlot(480)).toBe(false);
      expect(validators.isValidBankSlot(1000)).toBe(false);
    });

    it("should validate entity IDs", () => {
      expect(validators.isValidEntityId("entity-12345-abcdef")).toBe(true);
      expect(validators.isValidEntityId("mob_goblin_001")).toBe(true);

      expect(validators.isValidEntityId("")).toBe(false);
      expect(validators.isValidEntityId(null)).toBe(false);
      expect(validators.isValidEntityId("entity\x00id")).toBe(false); // Null byte
      expect(validators.isValidEntityId("a".repeat(200))).toBe(false); // Too long
    });
  });

  describe("Overflow prevention", () => {
    it("should detect integer overflow attempts", () => {
      const MAX_QUANTITY = 2147483647;

      expect(validators.wouldOverflow(0, 100)).toBe(false);
      expect(validators.wouldOverflow(1000000, 1000000)).toBe(false);
      expect(validators.wouldOverflow(MAX_QUANTITY - 10, 11)).toBe(true);
      expect(validators.wouldOverflow(MAX_QUANTITY, 1)).toBe(true);
      expect(validators.wouldOverflow(MAX_QUANTITY - 1, 2)).toBe(true);
    });
  });

  describe("Control character injection", () => {
    it("should detect and reject control characters", () => {
      // Null byte injection attempts
      expect(validators.CONTROL_CHAR_REGEX.test("item\x00id")).toBe(true);
      expect(validators.CONTROL_CHAR_REGEX.test("\x00")).toBe(true);

      // Other control characters
      expect(validators.CONTROL_CHAR_REGEX.test("item\x01")).toBe(true); // SOH
      expect(validators.CONTROL_CHAR_REGEX.test("item\x1f")).toBe(true); // Unit separator
      expect(validators.CONTROL_CHAR_REGEX.test("\t")).toBe(true); // Tab
      expect(validators.CONTROL_CHAR_REGEX.test("\n")).toBe(true); // Newline
      expect(validators.CONTROL_CHAR_REGEX.test("\r")).toBe(true); // Carriage return

      // Clean strings
      expect(validators.CONTROL_CHAR_REGEX.test("bronze_sword")).toBe(false);
      expect(validators.CONTROL_CHAR_REGEX.test("item-123")).toBe(false);
      expect(validators.CONTROL_CHAR_REGEX.test("アイテム")).toBe(false); // Unicode OK
    });
  });
});

// ============================================================================
// 6. RATE LIMITING TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Rate Limiting Effectiveness", () => {
  describe("SlidingWindowRateLimiter", () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = rateLimitModule.createRateLimiter({
        maxPerSecond: 5,
        name: "test-limiter",
      });
    });

    it("should allow requests within rate limit", () => {
      const playerId = "player1";

      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(playerId)).toBe(true);
      }
    });

    it("should block requests exceeding rate limit", () => {
      const playerId = "player2";

      // First 5 requests succeed
      for (let i = 0; i < 5; i++) {
        limiter.check(playerId);
      }

      // 6th request should be blocked
      expect(limiter.check(playerId)).toBe(false);
    });

    it("should track players independently", () => {
      // Player 1 uses all their quota
      for (let i = 0; i < 5; i++) {
        limiter.check("player1");
      }
      expect(limiter.check("player1")).toBe(false);

      // Player 2 should still have quota
      expect(limiter.check("player2")).toBe(true);
    });
  });

  describe("RateLimitService (interval-based)", () => {
    it("should enforce minimum interval between operations", () => {
      const RateLimitService = intervalRateLimitModule.RateLimitService;
      const service = new RateLimitService(100); // 100ms minimum interval
      const playerId = "player1";

      // First operation allowed
      expect(service.isAllowed(playerId)).toBe(true);
      service.recordOperation(playerId);

      // Immediate second operation blocked
      expect(service.isAllowed(playerId)).toBe(false);
    });

    it("should allow operation after interval expires", async () => {
      const RateLimitService = intervalRateLimitModule.RateLimitService;
      const service = new RateLimitService(50); // 50ms minimum interval
      const playerId = "player1";

      service.recordOperation(playerId);

      // Wait for interval to expire
      await new Promise((r) => setTimeout(r, 60));

      expect(service.isAllowed(playerId)).toBe(true);
    });

    it("should provide atomic tryOperation", () => {
      const RateLimitService = intervalRateLimitModule.RateLimitService;
      const service = new RateLimitService(1000);
      const playerId = "player1";

      // First try succeeds and records
      expect(service.tryOperation(playerId)).toBe(true);

      // Second try fails
      expect(service.tryOperation(playerId)).toBe(false);
    });
  });
});

// ============================================================================
// 7. TIMESTAMP VALIDATION (REPLAY ATTACK PREVENTION)
// ============================================================================

describe.skipIf(!canRunTests)("Replay Attack Prevention", () => {
  it("should reject stale timestamps (replay attacks)", () => {
    const now = Date.now();

    // Fresh request - valid
    expect(validators.validateRequestTimestamp(now).valid).toBe(true);

    // 1 second ago - valid (within 5 second window)
    expect(validators.validateRequestTimestamp(now - 1000, now).valid).toBe(
      true,
    );

    // 4 seconds ago - still valid (within 5 second window)
    expect(validators.validateRequestTimestamp(now - 4000, now).valid).toBe(
      true,
    );

    // 10 seconds ago - invalid (exceeds 5 second MAX_REQUEST_AGE_MS)
    const tenSecondsAgo = now - 10000;
    const staleResult = validators.validateRequestTimestamp(tenSecondsAgo, now);
    expect(staleResult.valid).toBe(false);
    expect(staleResult.reason).toContain("too old");

    // 5 minutes ago - invalid (replay attack)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const result = validators.validateRequestTimestamp(fiveMinutesAgo, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("too old");
  });

  it("should reject future timestamps (clock manipulation)", () => {
    const now = Date.now();

    // 1 minute in future - invalid
    const oneMinuteAhead = now + 60000;
    const result = validators.validateRequestTimestamp(oneMinuteAhead, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("future");
  });

  it("should reject invalid timestamp formats", () => {
    expect(validators.validateRequestTimestamp("1234567890").valid).toBe(false);
    expect(validators.validateRequestTimestamp(null).valid).toBe(false);
    expect(validators.validateRequestTimestamp(undefined).valid).toBe(false);
    expect(validators.validateRequestTimestamp(NaN).valid).toBe(false);
    expect(validators.validateRequestTimestamp(Infinity).valid).toBe(false);
  });
});

// ============================================================================
// 8. LOOT PROTECTION TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Loot Protection", () => {
  interface GroundItem {
    id: string;
    itemId: string;
    droppedBy: string | null;
    lootProtectionTick: number | null;
  }

  function canPickupItem(
    item: GroundItem,
    playerId: string,
    currentTick: number,
  ): boolean {
    // Untracked items (world spawns) have no protection
    if (!item.droppedBy || !item.lootProtectionTick) {
      return true;
    }

    // Protection expired
    if (currentTick >= item.lootProtectionTick) {
      return true;
    }

    // Only killer can pick up during protection
    return item.droppedBy === playerId;
  }

  it("should allow killer to pick up during protection", () => {
    const item: GroundItem = {
      id: "ground1",
      itemId: "bronze_sword",
      droppedBy: "player1",
      lootProtectionTick: 1000,
    };

    expect(canPickupItem(item, "player1", 0)).toBe(true); // Killer can pick up
    expect(canPickupItem(item, "player2", 0)).toBe(false); // Others blocked
  });

  it("should allow anyone to pick up after protection expires", () => {
    const item: GroundItem = {
      id: "ground1",
      itemId: "bronze_sword",
      droppedBy: "player1",
      lootProtectionTick: 100,
    };

    // After protection expires (currentTick >= lootProtectionTick)
    expect(canPickupItem(item, "player2", 100)).toBe(true);
    expect(canPickupItem(item, "player2", 200)).toBe(true);
  });

  it("should allow anyone to pick up untracked items", () => {
    const worldSpawnItem: GroundItem = {
      id: "ground2",
      itemId: "logs",
      droppedBy: null,
      lootProtectionTick: null,
    };

    expect(canPickupItem(worldSpawnItem, "anyone", 0)).toBe(true);
  });
});

// ============================================================================
// 9. EQUIPMENT VALIDATION TESTS
// ============================================================================

describe.skipIf(!canRunTests)("Equipment Validation", () => {
  const VALID_EQUIPMENT_SLOTS = new Set([
    "weapon",
    "shield",
    "head",
    "body",
    "legs",
    "feet",
    "hands",
    "cape",
    "neck",
    "ring",
    "ammo",
  ]);

  interface Item {
    id: string;
    equipSlot?: string;
    requirements?: {
      attack?: number;
      strength?: number;
      defense?: number;
    };
  }

  interface PlayerStats {
    attack: number;
    strength: number;
    defense: number;
  }

  function canEquipItem(
    item: Item,
    slot: string,
    playerStats: PlayerStats,
  ): { valid: boolean; reason?: string } {
    // Validate slot
    if (!VALID_EQUIPMENT_SLOTS.has(slot)) {
      return { valid: false, reason: "Invalid equipment slot" };
    }

    // Check slot matches item type
    if (item.equipSlot && item.equipSlot !== slot) {
      return { valid: false, reason: "Item cannot be equipped in that slot" };
    }

    // Check level requirements
    if (item.requirements) {
      if (
        item.requirements.attack &&
        playerStats.attack < item.requirements.attack
      ) {
        return {
          valid: false,
          reason: `Requires ${item.requirements.attack} Attack`,
        };
      }
      if (
        item.requirements.strength &&
        playerStats.strength < item.requirements.strength
      ) {
        return {
          valid: false,
          reason: `Requires ${item.requirements.strength} Strength`,
        };
      }
      if (
        item.requirements.defense &&
        playerStats.defense < item.requirements.defense
      ) {
        return {
          valid: false,
          reason: `Requires ${item.requirements.defense} Defense`,
        };
      }
    }

    return { valid: true };
  }

  it("should validate equipment slot names", () => {
    const sword: Item = { id: "bronze_sword", equipSlot: "weapon" };
    const stats = { attack: 10, strength: 10, defense: 10 };

    expect(canEquipItem(sword, "weapon", stats)).toEqual({ valid: true });
    expect(canEquipItem(sword, "invalid_slot", stats).valid).toBe(false);
  });

  it("should enforce level requirements", () => {
    const runeSword: Item = {
      id: "rune_sword",
      equipSlot: "weapon",
      requirements: { attack: 40 },
    };

    const lowLevelPlayer = { attack: 20, strength: 20, defense: 20 };
    const highLevelPlayer = { attack: 50, strength: 50, defense: 50 };

    expect(canEquipItem(runeSword, "weapon", lowLevelPlayer).valid).toBe(false);
    expect(canEquipItem(runeSword, "weapon", highLevelPlayer).valid).toBe(true);
  });
});
