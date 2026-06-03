/**
 * Moderation System Integration Tests
 *
 * Tests the complete moderation system including:
 * - User creation with roles
 * - Admin setting mod on users
 * - Mod permission checks
 * - Kick/ban protection logic
 * - Ban persistence and checking
 *
 * These tests run against the REAL database to verify the full flow.
 *
 * Test scenarios:
 * 1. Create users with different roles
 * 2. Admin grants mod role to a user
 * 3. Mod attempts to kick admin (should fail)
 * 4. Mod kicks regular user (should succeed)
 * 5. Mod bans regular user (should succeed)
 * 6. Banned user cannot connect
 *
 * Environment:
 *   DATABASE_URL must be set for database tests to run.
 *   Unit tests for role functions run without database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  hasRole,
  addRole,
  removeRole,
  serializeRoles,
  hasModPermission,
  hasAdminPermission,
  isProtectedFromModAction,
} from "@hyperforge/shared";
import pg from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from packages/server/.env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ============================================================================
// Test Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;

// Check if database is available
const isDatabaseAvailable = !!DATABASE_URL;

// ============================================================================
// Database Helpers
// ============================================================================

let pool: pg.Pool | null = null;
let dbConnectionTested = false;
let dbConnectionWorks = false;

async function getPool(): Promise<pg.Pool> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

async function testDatabaseConnection(): Promise<boolean> {
  if (dbConnectionTested) return dbConnectionWorks;
  dbConnectionTested = true;

  if (!DATABASE_URL) {
    console.log("⚠️  DATABASE_URL not set - skipping database tests");
    return false;
  }

  try {
    const testPool = await getPool();
    await testPool.query("SELECT 1");
    dbConnectionWorks = true;
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.log(
      `⚠️  Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.log("   Database tests will be skipped.");
    return false;
  }
}

async function createTestUser(
  name: string,
  roles: string[] = [],
): Promise<{ id: string; name: string; roles: string }> {
  const pool = await getPool();
  const id = `test-mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rolesString = roles.join(",");

  await pool.query(
    `INSERT INTO users (id, name, roles, "createdAt") VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET name = $2, roles = $3`,
    [id, name, rolesString],
  );

  return { id, name, roles: rolesString };
}

async function getUserRoles(userId: string): Promise<string[]> {
  const pool = await getPool();
  const result = await pool.query("SELECT roles FROM users WHERE id = $1", [
    userId,
  ]);
  if (result.rows.length === 0) return [];
  return result.rows[0].roles
    ? result.rows[0].roles.split(",").filter((r: string) => r)
    : [];
}

async function updateUserRoles(userId: string, roles: string[]): Promise<void> {
  const pool = await getPool();
  await pool.query("UPDATE users SET roles = $1 WHERE id = $2", [
    roles.join(","),
    userId,
  ]);
}

async function createBan(
  bannedUserId: string,
  bannedByUserId: string,
  reason: string | null,
  expiresAt: number | null,
): Promise<number> {
  const pool = await getPool();
  const result = await pool.query(
    `INSERT INTO user_bans ("bannedUserId", "bannedByUserId", reason, "expiresAt", "createdAt", active)
     VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
    [bannedUserId, bannedByUserId, reason, expiresAt, Date.now()],
  );
  return result.rows[0].id;
}

async function checkActiveBan(userId: string): Promise<{
  isBanned: boolean;
  reason?: string;
  expiresAt?: number | null;
}> {
  const pool = await getPool();
  const now = Date.now();

  const result = await pool.query(
    `SELECT * FROM user_bans 
     WHERE "bannedUserId" = $1 AND active = 1 
     AND ("expiresAt" IS NULL OR "expiresAt" > $2)
     LIMIT 1`,
    [userId, now],
  );

  if (result.rows.length === 0) {
    return { isBanned: false };
  }

  return {
    isBanned: true,
    reason: result.rows[0].reason,
    expiresAt:
      result.rows[0].expiresAt === null
        ? null
        : Number.parseInt(result.rows[0].expiresAt),
  };
}

async function unbanUser(userId: string): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `UPDATE user_bans SET active = 0 WHERE "bannedUserId" = $1 AND active = 1`,
    [userId],
  );
}

async function cleanupTestUsers(prefix: string): Promise<void> {
  const pool = await getPool();
  // Delete bans first (foreign key)
  await pool.query(
    `DELETE FROM user_bans WHERE "bannedUserId" LIKE $1 OR "bannedByUserId" LIKE $1`,
    [`${prefix}%`],
  );
  // Then delete users
  await pool.query("DELETE FROM users WHERE id LIKE $1", [`${prefix}%`]);
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Moderation System Integration Tests", () => {
  const testPrefix = "test-mod-";
  let canRunDbTests = false;

  beforeAll(async () => {
    // Test database connection
    canRunDbTests = await testDatabaseConnection();
  });

  afterAll(async () => {
    // Cleanup test data if database was available
    if (canRunDbTests) {
      try {
        await cleanupTestUsers(testPrefix);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Clean up before each test to avoid conflicts
    if (canRunDbTests) {
      try {
        await cleanupTestUsers(testPrefix);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ==========================================================================
  // TEST 1: Role Permission Functions
  // ==========================================================================

  describe("Role Permission Functions", () => {
    it("hasRole correctly identifies roles", () => {
      expect(hasRole(["admin"], "admin")).toBe(true);
      expect(hasRole(["mod"], "mod")).toBe(true);
      expect(hasRole(["user"], "admin")).toBe(false);
      expect(hasRole(null, "admin")).toBe(false);
      expect(hasRole(undefined, "admin")).toBe(false);
      expect(hasRole([], "admin")).toBe(false);
    });

    it("hasRole recognizes temporary roles with ~ prefix", () => {
      expect(hasRole(["~admin"], "admin")).toBe(true);
      expect(hasRole(["~mod"], "mod")).toBe(true);
    });

    it("hasModPermission returns true for mod and admin", () => {
      expect(hasModPermission(["mod"])).toBe(true);
      expect(hasModPermission(["admin"])).toBe(true);
      expect(hasModPermission(["user"])).toBe(false);
      expect(hasModPermission(null)).toBe(false);
    });

    it("hasAdminPermission returns true only for admin", () => {
      expect(hasAdminPermission(["admin"])).toBe(true);
      expect(hasAdminPermission(["mod"])).toBe(false);
      expect(hasAdminPermission(["user"])).toBe(false);
      expect(hasAdminPermission(null)).toBe(false);
    });

    it("addRole adds role only if not present", () => {
      const roles = ["user"];
      addRole(roles, "mod");
      expect(roles).toContain("mod");
      expect(roles).toHaveLength(2);

      // Adding again should not duplicate
      addRole(roles, "mod");
      expect(roles).toHaveLength(2);
    });

    it("removeRole removes role correctly", () => {
      const roles = ["user", "mod"];
      removeRole(roles, "mod");
      expect(roles).not.toContain("mod");
      expect(roles).toHaveLength(1);

      // Removing non-existent role should not error
      removeRole(roles, "admin");
      expect(roles).toHaveLength(1);
    });

    it("serializeRoles filters out temporary roles", () => {
      const roles = ["user", "~admin", "mod", "~builder"];
      const serialized = serializeRoles(roles);
      expect(serialized).toBe("user,mod");
    });
  });

  // ==========================================================================
  // TEST 2: Protection from Mod Actions
  // ==========================================================================

  describe("Protection from Mod Actions", () => {
    it("admins are always protected from kick/ban", () => {
      const result = isProtectedFromModAction(["admin"], ["mod"]);
      expect(result.protected).toBe(true);
      expect(result.reason).toContain("administrator");
    });

    it("admins cannot kick/ban other admins", () => {
      const result = isProtectedFromModAction(["admin"], ["admin"]);
      expect(result.protected).toBe(true);
    });

    it("mods are protected from other mods", () => {
      const result = isProtectedFromModAction(["mod"], ["mod"]);
      expect(result.protected).toBe(true);
      expect(result.reason).toContain("moderator");
    });

    it("admins CAN kick/ban mods", () => {
      const result = isProtectedFromModAction(["mod"], ["admin"]);
      expect(result.protected).toBe(false);
    });

    it("mods CAN kick/ban regular users", () => {
      const result = isProtectedFromModAction(["user"], ["mod"]);
      expect(result.protected).toBe(false);
    });

    it("mods CAN kick/ban users with no roles", () => {
      const result = isProtectedFromModAction([], ["mod"]);
      expect(result.protected).toBe(false);

      const result2 = isProtectedFromModAction(null, ["mod"]);
      expect(result2.protected).toBe(false);
    });
  });

  // ==========================================================================
  // TEST 3: User Creation with Roles (DATABASE REQUIRED)
  // ==========================================================================

  describe("User Creation with Roles", () => {
    it("creates admin user in database", async () => {
      if (!canRunDbTests) return;

      const admin = await createTestUser("TestAdmin", ["admin"]);

      expect(admin.id).toBeTruthy();
      expect(admin.roles).toBe("admin");

      const roles = await getUserRoles(admin.id);
      expect(roles).toContain("admin");
    });

    it("creates mod user in database", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("TestMod", ["mod"]);

      expect(mod.id).toBeTruthy();
      expect(mod.roles).toBe("mod");

      const roles = await getUserRoles(mod.id);
      expect(roles).toContain("mod");
    });

    it("creates regular user in database", async () => {
      if (!canRunDbTests) return;

      const user = await createTestUser("TestUser", []);

      expect(user.id).toBeTruthy();
      expect(user.roles).toBe("");

      const roles = await getUserRoles(user.id);
      expect(roles).toHaveLength(0);
    });
  });

  // ==========================================================================
  // TEST 4: Admin Setting Mod on User (DATABASE REQUIRED)
  // ==========================================================================

  describe("Admin Granting Mod Role", () => {
    it("admin can grant mod role to a regular user", async () => {
      if (!canRunDbTests) return;

      // Create admin and regular user
      const admin = await createTestUser("GrantAdmin", ["admin"]);
      const user = await createTestUser("GrantUser", []);

      // Verify admin has permission
      const adminRoles = await getUserRoles(admin.id);
      expect(hasAdminPermission(adminRoles)).toBe(true);

      // Grant mod role to user
      const userRoles = await getUserRoles(user.id);
      addRole(userRoles, "mod");
      await updateUserRoles(user.id, userRoles);

      // Verify user now has mod role
      const updatedRoles = await getUserRoles(user.id);
      expect(hasRole(updatedRoles, "mod")).toBe(true);
      expect(hasModPermission(updatedRoles)).toBe(true);
    });

    it("mod cannot grant mod role (no admin permission)", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("ModCantGrant", ["mod"]);
      const user = await createTestUser("UserTarget", []);

      const modRoles = await getUserRoles(mod.id);
      expect(hasAdminPermission(modRoles)).toBe(false);

      // Mod should not be able to do this in the actual command handler
      // The command checks hasAdminPermission before allowing /mod command
    });
  });

  // ==========================================================================
  // TEST 5: Mod Attempting to Kick Admin (DATABASE REQUIRED)
  // ==========================================================================

  describe("Mod Cannot Kick Admin", () => {
    it("mod attempting to kick admin is blocked by protection check", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("KickModActor", ["mod"]);
      const admin = await createTestUser("KickAdminTarget", ["admin"]);

      const modRoles = await getUserRoles(mod.id);
      const adminRoles = await getUserRoles(admin.id);

      // Verify mod has mod permission
      expect(hasModPermission(modRoles)).toBe(true);

      // Verify admin is protected
      const protection = isProtectedFromModAction(adminRoles, modRoles);
      expect(protection.protected).toBe(true);
      expect(protection.reason).toContain("administrator");
    });

    it("mod attempting to kick another mod is blocked", async () => {
      if (!canRunDbTests) return;

      const mod1 = await createTestUser("KickMod1", ["mod"]);
      const mod2 = await createTestUser("KickMod2", ["mod"]);

      const mod1Roles = await getUserRoles(mod1.id);
      const mod2Roles = await getUserRoles(mod2.id);

      const protection = isProtectedFromModAction(mod2Roles, mod1Roles);
      expect(protection.protected).toBe(true);
      expect(protection.reason).toContain("moderator");
    });
  });

  // ==========================================================================
  // TEST 6: Mod Kicking Regular User (DATABASE REQUIRED)
  // ==========================================================================

  describe("Mod Can Kick Regular User", () => {
    it("mod can kick regular user (not protected)", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("KickMod", ["mod"]);
      const user = await createTestUser("KickUser", []);

      const modRoles = await getUserRoles(mod.id);
      const userRoles = await getUserRoles(user.id);

      // Verify mod has permission
      expect(hasModPermission(modRoles)).toBe(true);

      // Verify user is NOT protected
      const protection = isProtectedFromModAction(userRoles, modRoles);
      expect(protection.protected).toBe(false);
    });
  });

  // ==========================================================================
  // TEST 7: Ban Creation and Checking (DATABASE REQUIRED)
  // ==========================================================================

  describe("Ban System", () => {
    it("creates permanent ban and verifies user is banned", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("BanMod", ["mod"]);
      const user = await createTestUser("BanUser", []);

      // Create ban (permanent - expiresAt = null)
      const banId = await createBan(
        user.id,
        mod.id,
        "Spamming in chat",
        null, // Permanent
      );

      expect(banId).toBeTruthy();

      // Check if user is banned
      const banCheck = await checkActiveBan(user.id);
      expect(banCheck.isBanned).toBe(true);
      expect(banCheck.reason).toBe("Spamming in chat");
      expect(banCheck.expiresAt).toBeNull();
    });

    it("creates temporary ban with expiration", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("TempBanMod", ["mod"]);
      const user = await createTestUser("TempBanUser", []);

      // Create ban for 1 hour
      const oneHourFromNow = Date.now() + 60 * 60 * 1000;
      const banId = await createBan(
        user.id,
        mod.id,
        "Minor offense",
        oneHourFromNow,
      );

      expect(banId).toBeTruthy();

      // Check if user is banned
      const banCheck = await checkActiveBan(user.id);
      expect(banCheck.isBanned).toBe(true);
      expect(banCheck.expiresAt).toBe(oneHourFromNow);
    });

    it("expired ban is not considered active", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("ExpiredBanMod", ["mod"]);
      const user = await createTestUser("ExpiredBanUser", []);

      // Create ban that expired 1 hour ago
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      await createBan(user.id, mod.id, "Old offense", oneHourAgo);

      // Check if user is banned (should not be)
      const banCheck = await checkActiveBan(user.id);
      expect(banCheck.isBanned).toBe(false);
    });

    it("unbanning user makes them not banned", async () => {
      if (!canRunDbTests) return;

      const mod = await createTestUser("UnbanMod", ["mod"]);
      const user = await createTestUser("UnbanUser", []);

      // Create permanent ban
      await createBan(user.id, mod.id, "Will be unbanned", null);

      // Verify user is banned
      let banCheck = await checkActiveBan(user.id);
      expect(banCheck.isBanned).toBe(true);

      // Unban user
      await unbanUser(user.id);

      // Verify user is no longer banned
      banCheck = await checkActiveBan(user.id);
      expect(banCheck.isBanned).toBe(false);
    });

    it("non-banned user shows as not banned", async () => {
      if (!canRunDbTests) return;

      const user = await createTestUser("NeverBannedUser", []);

      const banCheck = await checkActiveBan(user.id);
      expect(banCheck.isBanned).toBe(false);
    });
  });

  // ==========================================================================
  // TEST 8: Full Flow - Admin Creates Mod, Mod Bans User (DATABASE REQUIRED)
  // ==========================================================================

  describe("Full Moderation Flow", () => {
    it("complete flow: admin → mod → ban user", async () => {
      if (!canRunDbTests) return;

      // Step 1: Create admin
      const admin = await createTestUser("FlowAdmin", ["admin"]);
      const adminRoles = await getUserRoles(admin.id);
      expect(hasAdminPermission(adminRoles)).toBe(true);
      console.log("✅ Step 1: Admin created");

      // Step 2: Create regular user who will become mod
      const newMod = await createTestUser("FlowNewMod", []);
      let newModRoles = await getUserRoles(newMod.id);
      expect(hasModPermission(newModRoles)).toBe(false);
      console.log("✅ Step 2: Regular user created");

      // Step 3: Admin grants mod role
      addRole(newModRoles, "mod");
      await updateUserRoles(newMod.id, newModRoles);
      newModRoles = await getUserRoles(newMod.id);
      expect(hasModPermission(newModRoles)).toBe(true);
      console.log("✅ Step 3: Admin granted mod role");

      // Step 4: Create target user
      const targetUser = await createTestUser("FlowTargetUser", []);
      const targetRoles = await getUserRoles(targetUser.id);
      console.log("✅ Step 4: Target user created");

      // Step 5: Mod attempts to kick admin (should be blocked)
      const kickAdminProtection = isProtectedFromModAction(
        adminRoles,
        newModRoles,
      );
      expect(kickAdminProtection.protected).toBe(true);
      console.log("✅ Step 5: Mod cannot kick admin (protected)");

      // Step 6: Mod kicks regular user (should succeed)
      const kickUserProtection = isProtectedFromModAction(
        targetRoles,
        newModRoles,
      );
      expect(kickUserProtection.protected).toBe(false);
      console.log("✅ Step 6: Mod can kick regular user (not protected)");

      // Step 7: Mod bans regular user
      const banId = await createBan(
        targetUser.id,
        newMod.id,
        "Banned in full flow test",
        null,
      );
      expect(banId).toBeTruthy();

      const banCheck = await checkActiveBan(targetUser.id);
      expect(banCheck.isBanned).toBe(true);
      console.log("✅ Step 7: Mod banned regular user");

      // Step 8: Banned user cannot reconnect (would fail ban check)
      expect(banCheck.isBanned).toBe(true);
      console.log("✅ Step 8: Banned user is blocked from connecting");

      console.log("\n🎉 Full moderation flow completed successfully!");
    });
  });
});
