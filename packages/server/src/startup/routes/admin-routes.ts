/**
 * Admin Routes - User management, activity tracking, and combat debugging
 * Protected by x-admin-code header authentication with rate limiting.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { World } from "@hyperscape/shared";
import { bfsPool, tilePool, quaternionPool } from "@hyperscape/shared";
import type { ServerConfig } from "../config.js";
import type { DatabaseSystem } from "../../systems/DatabaseSystem/index.js";
import { eq, like, sql, desc, and, type SQL } from "drizzle-orm";
import * as schema from "../../database/schema.js";
import { timingSafeEqual } from "crypto";
import {
  enterMaintenanceMode,
  exitMaintenanceMode,
  getMaintenanceStatus,
} from "../maintenance-mode.js";

/**
 * Rate limiter for admin authentication attempts.
 * Tracks failed attempts per IP address.
 */
interface AdminAuthAttempt {
  failures: number;
  lastAttempt: number;
  blockedUntil: number;
}

const adminAuthAttempts = new Map<string, AdminAuthAttempt>();

// Rate limit config: 5 attempts per minute, 5 minute lockout
const ADMIN_AUTH_MAX_ATTEMPTS = 5;
const ADMIN_AUTH_WINDOW_MS = 60 * 1000; // 1 minute
const ADMIN_AUTH_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Returns true if strings are equal.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time, but will fail
    const buf = Buffer.alloc(b.length);
    timingSafeEqual(buf, Buffer.from(b, "utf8"));
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Check if IP is rate limited for admin auth.
 * Returns remaining lockout time in ms, or 0 if not locked.
 */
function checkAdminRateLimit(ip: string): number {
  const now = Date.now();
  const attempt = adminAuthAttempts.get(ip);

  if (!attempt) return 0;

  // Check if currently blocked
  if (attempt.blockedUntil > now) {
    return attempt.blockedUntil - now;
  }

  // Reset if window expired
  if (now - attempt.lastAttempt > ADMIN_AUTH_WINDOW_MS) {
    adminAuthAttempts.delete(ip);
    return 0;
  }

  return 0;
}

/**
 * Record a failed admin auth attempt.
 * Returns true if the IP is now blocked.
 */
function recordFailedAttempt(ip: string): boolean {
  const now = Date.now();
  const attempt = adminAuthAttempts.get(ip);

  if (!attempt) {
    adminAuthAttempts.set(ip, {
      failures: 1,
      lastAttempt: now,
      blockedUntil: 0,
    });
    return false;
  }

  // Reset if window expired
  if (now - attempt.lastAttempt > ADMIN_AUTH_WINDOW_MS) {
    attempt.failures = 1;
    attempt.lastAttempt = now;
    return false;
  }

  attempt.failures++;
  attempt.lastAttempt = now;

  if (attempt.failures >= ADMIN_AUTH_MAX_ATTEMPTS) {
    attempt.blockedUntil = now + ADMIN_AUTH_LOCKOUT_MS;
    console.warn(
      `[AdminAuth] IP ${ip} blocked for ${ADMIN_AUTH_LOCKOUT_MS / 1000}s after ${attempt.failures} failed attempts`,
    );
    return true;
  }

  return false;
}

/**
 * Clear rate limit state for an IP on successful auth.
 */
function clearRateLimit(ip: string): void {
  adminAuthAttempts.delete(ip);
}

/** Safely parse int with NaN protection */
function safeParseInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/** Parse optional timestamp - returns undefined if missing/invalid */
function parseOptionalTimestamp(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Parse pagination params with bounds and NaN protection */
function parsePagination(
  query: { page?: string; limit?: string },
  maxLimit = 100,
  defaultLimit = 50,
) {
  const page = Math.max(1, safeParseInt(query.page, 1));
  const limit = Math.min(
    maxLimit,
    Math.max(1, safeParseInt(query.limit, defaultLimit)),
  );
  return { page, limit, offset: (page - 1) * limit };
}

export function registerAdminRoutes(
  fastify: FastifyInstance,
  world: World,
  config: ServerConfig,
): void {
  // SECURITY: Validate ADMIN_CODE is set in production
  if (process.env.NODE_ENV === "production" && !config.adminCode) {
    console.warn(
      "[AdminRoutes] WARNING: ADMIN_CODE not set in production. Admin panel disabled.",
    );
  }

  const requireAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    // Get client IP for rate limiting
    const clientIp =
      request.ip || request.headers["x-forwarded-for"] || "unknown";
    const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp;

    // SECURITY: Check rate limit before any other validation
    const lockoutRemaining = checkAdminRateLimit(ip);
    if (lockoutRemaining > 0) {
      const secondsRemaining = Math.ceil(lockoutRemaining / 1000);
      return reply.code(429).send({
        error: "Too many failed attempts",
        retryAfter: secondsRemaining,
      });
    }

    // Always require admin code - if not configured, admin panel is disabled
    if (!config.adminCode) {
      return reply.code(403).send({ error: "Admin panel not configured" });
    }

    const providedCode = request.headers["x-admin-code"];
    if (typeof providedCode !== "string") {
      recordFailedAttempt(ip);
      return reply.code(403).send({ error: "Unauthorized" });
    }

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    if (!safeCompare(providedCode, config.adminCode)) {
      const blocked = recordFailedAttempt(ip);
      if (blocked) {
        return reply.code(429).send({
          error: "Too many failed attempts",
          retryAfter: ADMIN_AUTH_LOCKOUT_MS / 1000,
        });
      }
      return reply.code(403).send({ error: "Unauthorized" });
    }

    // Successful auth - clear any rate limit state
    clearRateLimit(ip);
  };

  /** Get database system or return error response */
  const getDb = (reply: FastifyReply) => {
    const dbSystem = world.getSystem<DatabaseSystem>("database");
    if (!dbSystem) {
      reply.code(500).send({ error: "DatabaseSystem not found" });
      return null;
    }
    const db = dbSystem.getDb();
    if (!db) {
      reply.code(500).send({ error: "Database not initialized" });
      return null;
    }
    return { dbSystem, db };
  };

  /**
   * GET /admin/combat/stats
   * Get EventStore statistics
   */
  fastify.get(
    "/admin/combat/stats",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const combatSystem = world.getSystem("combat");
      if (!combatSystem) {
        return reply.code(500).send({ error: "CombatSystem not found" });
      }

      // Access event store stats directly via public eventStore
      const eventStore = combatSystem.eventStore;
      const stats = {
        eventCount: eventStore.getEventCount(),
        snapshotCount: eventStore.getSnapshotCount(),
        oldestTick: eventStore.getOldestEventTick(),
        newestTick: eventStore.getNewestEventTick(),
      };
      // Access anti-cheat stats directly via public antiCheat
      const antiCheatStats = combatSystem.antiCheat.getStats();

      return reply.send({
        eventStore: stats,
        antiCheat: antiCheatStats,
        currentTick: world.currentTick,
      });
    },
  );

  /**
   * GET /admin/pools/stats
   * Get object pool utilization metrics
   */
  fastify.get(
    "/admin/pools/stats",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const bfsStats = bfsPool.getStats();
      const tileStats = tilePool.getStats();
      const quaternionStats = quaternionPool.getStats();

      return reply.send({
        bfs: {
          ...bfsStats,
          utilization:
            bfsStats.poolSize > 0
              ? Math.round((bfsStats.inUse / bfsStats.poolSize) * 100)
              : 0,
        },
        tile: tileStats,
        quaternion: quaternionStats,
      });
    },
  );

  /**
   * GET /admin/combat/:playerId
   * Get raw combat events for a player
   *
   * Query params:
   * - startTick: Start of range (default: currentTick - 500)
   * - endTick: End of range (default: currentTick)
   */
  fastify.get<{
    Params: { playerId: string };
    Querystring: { startTick?: string; endTick?: string };
  }>(
    "/admin/combat/:playerId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { playerId } = request.params;
      const startTick = safeParseInt(
        request.query.startTick,
        world.currentTick - 500,
      );
      const endTick = safeParseInt(request.query.endTick, world.currentTick);

      const combatSystem = world.getSystem("combat");
      if (!combatSystem) {
        return reply.code(500).send({ error: "CombatSystem not found" });
      }

      // Access event store directly via public eventStore
      const events = combatSystem.eventStore.getEntityEvents(
        playerId,
        startTick,
        endTick,
      );

      return reply.send({
        playerId,
        tickRange: { startTick, endTick },
        eventCount: events.length,
        events,
      });
    },
  );

  /**
   * GET /admin/combat/:playerId/report
   * Get full investigation report with suspicious event detection
   *
   * Query params:
   * - startTick: Start of range (default: currentTick - 500)
   * - endTick: End of range (default: currentTick)
   * - maxDamage: Threshold for suspicious damage (default: 50)
   */
  fastify.get<{
    Params: { playerId: string };
    Querystring: {
      startTick?: string;
      endTick?: string;
      maxDamage?: string;
    };
  }>(
    "/admin/combat/:playerId/report",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { playerId } = request.params;
      const startTick = safeParseInt(
        request.query.startTick,
        world.currentTick - 500,
      );
      const endTick = safeParseInt(request.query.endTick, world.currentTick);
      const maxDamage = safeParseInt(request.query.maxDamage, 50);

      const combatSystem = world.getSystem("combat");
      if (!combatSystem) {
        return reply.code(500).send({ error: "CombatSystem not found" });
      }

      // Access event store directly via public eventStore
      const events = combatSystem.eventStore.getEntityEvents(
        playerId,
        startTick,
        endTick,
      );

      // Build a simple report from the events
      let totalDamageDealt = 0;
      let totalDamageTaken = 0;
      let maxDamageDealt = 0;
      let hitCount = 0;
      const suspiciousEvents: Array<{
        tick: number;
        reason: string;
        damage?: number;
        entityId: string;
      }> = [];

      for (const event of events) {
        const payload = event.payload as {
          damage?: number;
          targetId?: string;
        };

        if (event.type === "COMBAT_DAMAGE") {
          const damage = payload.damage ?? 0;

          if (event.entityId === playerId) {
            // Player dealt damage
            totalDamageDealt += damage;
            maxDamageDealt = Math.max(maxDamageDealt, damage);
            hitCount++;
          } else if (payload.targetId === playerId) {
            // Player took damage
            totalDamageTaken += damage;
          }

          // Check for suspicious damage
          if (damage > maxDamage) {
            suspiciousEvents.push({
              tick: event.tick,
              reason: `Damage ${damage} exceeds threshold ${maxDamage}`,
              damage,
              entityId: event.entityId,
            });
          }
        }
      }

      return reply.send({
        playerId,
        tickRange: { startTick, endTick },
        stats: {
          totalDamageDealt,
          totalDamageTaken,
          maxDamageDealt,
          hitCount,
          averageDamagePerHit: hitCount > 0 ? totalDamageDealt / hitCount : 0,
        },
        suspiciousEvents,
        eventCount: events.length,
      });
    },
  );

  /**
   * GET /admin/combat/range/:startTick/:endTick
   * Get all combat events in a tick range (for investigating specific incidents)
   */
  fastify.get<{
    Params: { startTick: string; endTick: string };
  }>(
    "/admin/combat/range/:startTick/:endTick",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const startTick = parseInt(request.params.startTick, 10);
      const endTick = parseInt(request.params.endTick, 10);

      if (Number.isNaN(startTick) || Number.isNaN(endTick)) {
        return reply.code(400).send({
          error: "Invalid tick range - startTick and endTick must be numbers",
        });
      }

      const combatSystem = world.getSystem("combat");
      if (!combatSystem) {
        return reply.code(500).send({ error: "CombatSystem not found" });
      }

      const events = combatSystem.eventStore.getCombatEvents(
        startTick,
        endTick,
      );

      return reply.send({
        tickRange: { startTick, endTick },
        eventCount: events.length,
        events,
      });
    },
  );

  /**
   * GET /admin/anticheat/flagged
   * Get players flagged by anti-cheat system
   */
  fastify.get(
    "/admin/anticheat/flagged",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const combatSystem = world.getSystem("combat");
      if (!combatSystem) {
        return reply.code(500).send({ error: "CombatSystem not found" });
      }

      const flaggedPlayers = combatSystem.antiCheat.getPlayersRequiringReview();
      const reports = flaggedPlayers.map((playerId: string) => ({
        playerId,
        ...combatSystem.antiCheat.getPlayerReport(playerId),
      }));

      return reply.send({
        flaggedCount: flaggedPlayers.length,
        players: reports,
      });
    },
  );

  /**
   * GET /admin/anticheat/history
   * Paginated violation history from database (persisted across restarts)
   *
   * Query params:
   * - playerId: Filter by player ID (optional)
   * - severity: Filter by severity level (optional)
   * - limit: Results per page (default: 50, max: 100)
   * - page: Page number (default: 1)
   */
  fastify.get<{
    Querystring: {
      playerId?: string;
      severity?: string;
      page?: string;
      limit?: string;
    };
  }>(
    "/admin/anticheat/history",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { db } = ctx;

      const { page, limit, offset } = parsePagination(request.query, 100, 50);
      const { playerId, severity } = request.query;

      const conditions: SQL<unknown>[] = [];
      if (playerId)
        conditions.push(eq(schema.antiCheatViolations.playerId, playerId));
      if (severity)
        conditions.push(eq(schema.antiCheatViolations.severity, severity));

      let countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.antiCheatViolations);
      if (conditions.length)
        countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      const total = (await countQuery)[0]?.count ?? 0;

      let violationsQuery = db
        .select()
        .from(schema.antiCheatViolations)
        .orderBy(desc(schema.antiCheatViolations.timestamp))
        .limit(limit)
        .offset(offset);
      if (conditions.length)
        violationsQuery = violationsQuery.where(
          and(...conditions),
        ) as typeof violationsQuery;

      return reply.send({
        violations: await violationsQuery,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // ============================================================================
  // ADMIN PANEL ENDPOINTS
  // ============================================================================

  /** GET /admin/users - List users with search/pagination */
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      role?: string;
    };
  }>("/admin/users", { preHandler: requireAdmin }, async (request, reply) => {
    const ctx = getDb(reply);
    if (!ctx) return;
    const { db } = ctx;

    const { page, limit, offset } = parsePagination(request.query, 100, 50);
    const { search, role: roleFilter } = request.query;

    const conditions: SQL<unknown>[] = [];
    if (search) conditions.push(like(schema.users.name, `%${search}%`));
    if (roleFilter)
      conditions.push(like(schema.users.roles, `%${roleFilter}%`));

    let countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users);
    if (conditions.length)
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    const total = (await countQuery)[0]?.count ?? 0;

    let usersQuery = db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        roles: schema.users.roles,
        createdAt: schema.users.createdAt,
        avatar: schema.users.avatar,
        wallet: schema.users.wallet,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length)
      usersQuery = usersQuery.where(and(...conditions)) as typeof usersQuery;

    return reply.send({
      users: await usersQuery,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  /** GET /admin/users/:userId - User details with characters */
  fastify.get<{ Params: { userId: string } }>(
    "/admin/users/:userId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { db } = ctx;
      const { userId } = request.params;

      const userResult = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (userResult.length === 0)
        return reply.code(404).send({ error: "User not found" });

      let user: (typeof userResult)[0];
      let characters: Array<{
        id: string;
        name: string;
        combatLevel: number | null;
        createdAt: number | null;
        lastLogin: number | null;
        isAgent: number;
        avatar: string | null;
      }>;
      let activeBan: Array<typeof schema.userBans.$inferSelect>;
      try {
        [user, characters, activeBan] = await Promise.all([
          Promise.resolve(userResult[0]),
          db
            .select({
              id: schema.characters.id,
              name: schema.characters.name,
              combatLevel: schema.characters.combatLevel,
              createdAt: schema.characters.createdAt,
              lastLogin: schema.characters.lastLogin,
              isAgent: schema.characters.isAgent,
              avatar: schema.characters.avatar,
            })
            .from(schema.characters)
            .where(eq(schema.characters.accountId, userId)),
          db
            .select()
            .from(schema.userBans)
            .where(
              and(
                eq(schema.userBans.bannedUserId, userId),
                eq(schema.userBans.active, 1),
              ),
            )
            .limit(1),
        ]);
      } catch (err) {
        request.log.error(
          err,
          `[AdminRoutes] Failed to load user details for ${userId}`,
        );
        return reply.code(500).send({ error: "Failed to load user details" });
      }

      return reply.send({
        user: { ...user, roles: (user.roles ?? "").split(",").filter(Boolean) },
        characters,
        ban: activeBan[0] ?? null,
      });
    },
  );

  /** GET /admin/players/:playerId - Full player details */
  fastify.get<{ Params: { playerId: string } }>(
    "/admin/players/:playerId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { db } = ctx;
      const { playerId } = request.params;

      const charResult = await db
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.id, playerId))
        .limit(1);
      if (charResult.length === 0)
        return reply.code(404).send({ error: "Player not found" });
      const character = charResult[0];

      // Parallel fetch all related data
      let inventory: Array<typeof schema.inventory.$inferSelect>;
      let equipment: Array<typeof schema.equipment.$inferSelect>;
      let bank: Array<typeof schema.bankStorage.$inferSelect>;
      let npcKills: Array<typeof schema.npcKills.$inferSelect>;
      let sessions: Array<typeof schema.playerSessions.$inferSelect>;
      let accountResult: Array<{
        id: string;
        name: string;
        roles: string | null;
      }>;
      try {
        [inventory, equipment, bank, npcKills, sessions, accountResult] =
          await Promise.all([
            db
              .select()
              .from(schema.inventory)
              .where(eq(schema.inventory.playerId, playerId))
              .orderBy(schema.inventory.slotIndex),
            db
              .select()
              .from(schema.equipment)
              .where(eq(schema.equipment.playerId, playerId)),
            db
              .select()
              .from(schema.bankStorage)
              .where(eq(schema.bankStorage.playerId, playerId))
              .orderBy(schema.bankStorage.tabIndex, schema.bankStorage.slot),
            db
              .select()
              .from(schema.npcKills)
              .where(eq(schema.npcKills.playerId, playerId)),
            db
              .select()
              .from(schema.playerSessions)
              .where(eq(schema.playerSessions.playerId, playerId))
              .orderBy(desc(schema.playerSessions.sessionStart))
              .limit(10),
            db
              .select({
                id: schema.users.id,
                name: schema.users.name,
                roles: schema.users.roles,
              })
              .from(schema.users)
              .where(eq(schema.users.id, character.accountId))
              .limit(1),
          ]);
      } catch (err) {
        request.log.error(
          err,
          `[AdminRoutes] Failed to load player details for ${playerId}`,
        );
        return reply.code(500).send({ error: "Failed to load player details" });
      }

      // Build skills from character columns
      const skillDef = (
        lvl: number | null,
        xp: number | null,
        defaultLvl = 1,
        defaultXp = 0,
      ) => ({
        level: lvl ?? defaultLvl,
        xp: xp ?? defaultXp,
      });

      return reply.send({
        player: {
          id: character.id,
          name: character.name,
          accountId: character.accountId,
          combatLevel: character.combatLevel,
          health: character.health,
          maxHealth: character.maxHealth,
          coins: character.coins,
          position: {
            x: character.positionX,
            y: character.positionY,
            z: character.positionZ,
          },
          attackStyle: character.attackStyle,
          autoRetaliate: character.autoRetaliate === 1,
          isAgent: character.isAgent === 1,
          createdAt: character.createdAt,
          lastLogin: character.lastLogin,
        },
        account: accountResult[0] ?? null,
        skills: {
          attack: skillDef(character.attackLevel, character.attackXp),
          strength: skillDef(character.strengthLevel, character.strengthXp),
          defense: skillDef(character.defenseLevel, character.defenseXp),
          constitution: skillDef(
            character.constitutionLevel,
            character.constitutionXp,
            10,
            1154,
          ),
          ranged: skillDef(character.rangedLevel, character.rangedXp),
          prayer: skillDef(character.prayerLevel, character.prayerXp),
          magic: skillDef(character.magicLevel, character.magicXp),
          woodcutting: skillDef(
            character.woodcuttingLevel,
            character.woodcuttingXp,
          ),
          mining: skillDef(character.miningLevel, character.miningXp),
          fishing: skillDef(character.fishingLevel, character.fishingXp),
          firemaking: skillDef(
            character.firemakingLevel,
            character.firemakingXp,
          ),
          cooking: skillDef(character.cookingLevel, character.cookingXp),
          smithing: skillDef(character.smithingLevel, character.smithingXp),
        },
        inventory: inventory.map((i) => {
          let metadata = null;
          if (i.metadata) {
            try {
              metadata = JSON.parse(i.metadata);
            } catch {
              /* invalid JSON, leave as null */
            }
          }
          return {
            itemId: i.itemId,
            quantity: i.quantity,
            slotIndex: i.slotIndex,
            metadata,
          };
        }),
        equipment: equipment.map((e) => ({
          slotType: e.slotType,
          itemId: e.itemId,
          quantity: e.quantity,
        })),
        bank: bank.map((b) => ({
          itemId: b.itemId,
          quantity: b.quantity,
          slot: b.slot,
          tabIndex: b.tabIndex,
        })),
        npcKills: npcKills.map((k) => ({
          npcId: k.npcId,
          killCount: k.killCount,
        })),
        sessions: sessions.map((s) => ({
          id: s.id,
          sessionStart: s.sessionStart,
          sessionEnd: s.sessionEnd,
          playtimeMinutes: s.playtimeMinutes,
          reason: s.reason,
        })),
      });
    },
  );

  /** GET /admin/players/:playerId/activity - Player activity history */
  fastify.get<{
    Params: { playerId: string };
    Querystring: {
      page?: string;
      limit?: string;
      eventType?: string;
      from?: string;
      to?: string;
    };
  }>(
    "/admin/players/:playerId/activity",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { dbSystem } = ctx;

      const { page, limit, offset } = parsePagination(request.query);
      const options = {
        playerId: request.params.playerId,
        eventType: request.query.eventType,
        fromTimestamp: parseOptionalTimestamp(request.query.from),
        toTimestamp: parseOptionalTimestamp(request.query.to),
        limit,
        offset,
      };

      let activities: Awaited<ReturnType<typeof dbSystem.queryActivitiesAsync>>;
      let total: Awaited<ReturnType<typeof dbSystem.countActivitiesAsync>>;
      try {
        [activities, total] = await Promise.all([
          dbSystem.queryActivitiesAsync(options),
          dbSystem.countActivitiesAsync(options),
        ]);
      } catch (err) {
        request.log.error(
          err,
          `[AdminRoutes] Failed to load activity for ${options.playerId}`,
        );
        return reply.code(500).send({ error: "Failed to load activity logs" });
      }

      return reply.send({
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /** GET /admin/players/:playerId/trades - Player trade history */
  fastify.get<{
    Params: { playerId: string };
    Querystring: { page?: string; limit?: string; from?: string; to?: string };
  }>(
    "/admin/players/:playerId/trades",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { dbSystem } = ctx;

      const { page, limit, offset } = parsePagination(request.query);
      const options = {
        playerId: request.params.playerId,
        fromTimestamp: parseOptionalTimestamp(request.query.from),
        toTimestamp: parseOptionalTimestamp(request.query.to),
        limit,
        offset,
      };

      let trades: Awaited<ReturnType<typeof dbSystem.queryTradesAsync>>;
      let total: Awaited<ReturnType<typeof dbSystem.countTradesAsync>>;
      try {
        [trades, total] = await Promise.all([
          dbSystem.queryTradesAsync(options),
          dbSystem.countTradesAsync(options),
        ]);
      } catch (err) {
        request.log.error(
          err,
          `[AdminRoutes] Failed to load trades for ${options.playerId}`,
        );
        return reply.code(500).send({ error: "Failed to load trade history" });
      }

      return reply.send({
        trades,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /** GET /admin/activity - Query all activity logs */
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      eventType?: string;
      from?: string;
      to?: string;
    };
  }>(
    "/admin/activity",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { dbSystem } = ctx;

      const { page, limit, offset } = parsePagination(request.query);
      const options = {
        eventTypes: request.query.eventType?.split(",").filter(Boolean),
        fromTimestamp: parseOptionalTimestamp(request.query.from),
        toTimestamp: parseOptionalTimestamp(request.query.to),
        limit,
        offset,
      };

      let activities: Awaited<ReturnType<typeof dbSystem.queryActivitiesAsync>>;
      let total: Awaited<ReturnType<typeof dbSystem.countActivitiesAsync>>;
      try {
        [activities, total] = await Promise.all([
          dbSystem.queryActivitiesAsync(options),
          dbSystem.countActivitiesAsync(options),
        ]);
      } catch (err) {
        request.log.error(err, "[AdminRoutes] Failed to load activity logs");
        return reply.code(500).send({ error: "Failed to load activity logs" });
      }

      return reply.send({
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /** GET /admin/activity/types - Event types for filter dropdown */
  fastify.get(
    "/admin/activity/types",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      return reply.send({
        eventTypes: await ctx.dbSystem.getActivityEventTypesAsync(),
      });
    },
  );

  /**
   * GET /admin/agents/monitor
   * Real-time agent monitoring data (all in-memory, zero DB queries)
   * Merges both embedded agents (AgentManager) and model agents (ModelAgentSpawner)
   */
  fastify.get(
    "/admin/agents/monitor",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { getAgentManager, getRunningAgents } =
          await import("../../eliza/index.js");
        const { ServerNetwork } =
          await import("../../systems/ServerNetwork/index.js");
        const agentManager = getAgentManager();

        // Get ECS systems for inventory/equipment/skills/quests lookup
        const inventorySystem = world.getSystem("inventory") as {
          getInventory?: (entityId: string) => {
            items: Array<{
              slot: number;
              itemId: string;
              quantity: number;
            }>;
          } | null;
        } | null;
        const equipmentSystem = world.getSystem("equipment") as {
          getPlayerEquipment?: (
            entityId: string,
          ) => Record<
            string,
            string | { itemId?: string | null; slot?: string } | null
          > | null;
        } | null;
        const skillsSystem = world.getSystem("skills") as {
          getSkills?: (
            entityId: string,
          ) => Record<string, { level: number; xp: number }> | undefined;
        } | null;
        const questSystem = world.getSystem("quest") as {
          getActiveQuests?: (playerId: string) => Array<{
            questId: string;
            status: string;
            currentStage: string;
            stageProgress: Record<string, number>;
            startedAt?: number;
            completedAt?: number;
          }>;
          getQuestStatus?: (playerId: string, questId: string) => string;
          getQuestDefinition?: (questId: string) =>
            | {
                id: string;
                name: string;
                description: string;
                difficulty: string;
                startNpc: string;
                stages: Array<{
                  id: string;
                  type: string;
                  description: string;
                  target?: string;
                  count?: number;
                }>;
              }
            | undefined;
          getAllQuestDefinitions?: () => Array<{
            id: string;
            name: string;
            description: string;
            difficulty: string;
          }>;
          hasCompletedQuest?: (playerId: string, questId: string) => boolean;
          getQuestPoints?: (playerId: string) => number;
        } | null;
        // Bank data: read from database (BankingSystem in-memory cache is not populated from DB)
        const dbSystem = world.getSystem<DatabaseSystem>("database");
        const bankRepo = dbSystem?.getBankRepository() ?? null;

        // Helper: build monitor data for an agent given its characterId
        const buildAgentData = async (
          characterId: string,
          name: string,
          state: string,
          startedAt: number,
          lastActivity: number,
          scriptedRole?: string,
          error?: string,
        ) => {
          // Try to get game state from embedded service first
          const service = agentManager?.getAgentService(characterId);
          const gameState = service?.getGameState() ?? null;

          // World entity data (works for both embedded and model agents)
          const entity = world.entities.get(characterId);
          const entityData = entity
            ? (entity.data as Record<string, unknown>)
            : null;

          // Get goal from ServerNetwork (synced by agent plugins)
          const goal =
            (ServerNetwork.agentGoals.get(characterId) as {
              type?: string;
              description?: string;
              progress?: number;
              target?: number;
              location?: string;
              targetSkill?: string;
              startedAt?: number;
              locked?: boolean;
            } | null) ?? null;
          const goalsPaused =
            ServerNetwork.agentGoalsPaused.get(characterId) ?? false;

          // Get thoughts from ServerNetwork
          const rawThoughts =
            ServerNetwork.agentThoughts.get(characterId) ?? [];
          const recentThoughts = rawThoughts.slice(0, 10).map((t) => ({
            id: t.id,
            type: t.type,
            content: t.content,
            timestamp: t.timestamp,
          }));

          // Skills: gameState > SkillsSystem > entity.data.skills
          let skills: Record<string, { level: number; xp: number }> = {};
          if (gameState?.skills && Object.keys(gameState.skills).length > 0) {
            skills = gameState.skills;
          } else if (skillsSystem?.getSkills) {
            try {
              const sysSkills = skillsSystem.getSkills(characterId);
              if (sysSkills && Object.keys(sysSkills).length > 0) {
                skills = sysSkills;
              }
            } catch {
              /* entity may not have skills */
            }
          }
          if (Object.keys(skills).length === 0 && entityData?.skills) {
            skills = entityData.skills as Record<
              string,
              { level: number; xp: number }
            >;
          }
          let totalLevel = 0;
          let combatLevel = 0;
          const combatSkillNames = [
            "attack",
            "strength",
            "defense",
            "constitution",
            "ranged",
          ];
          for (const [skillName, skill] of Object.entries(skills)) {
            totalLevel += skill.level;
            if (combatSkillNames.includes(skillName)) {
              combatLevel += skill.level;
            }
          }
          combatLevel = Math.floor(combatLevel / 5);

          // Inventory: gameState > InventorySystem
          let inventory: Array<{
            slot: number;
            itemId: string;
            quantity: number;
          }> = [];
          if (gameState?.inventory && gameState.inventory.length > 0) {
            inventory = gameState.inventory;
          } else if (inventorySystem?.getInventory) {
            try {
              const inv = inventorySystem.getInventory(characterId);
              if (inv?.items) {
                inventory = inv.items
                  .filter(
                    (i: { itemId: string }) => i.itemId && i.itemId !== "",
                  )
                  .map(
                    (i: {
                      slot: number;
                      itemId: string;
                      quantity: number;
                    }) => ({
                      slot: i.slot,
                      itemId: i.itemId,
                      quantity: i.quantity,
                    }),
                  );
              }
            } catch {
              /* entity may not have inventory */
            }
          }
          const inventoryUsed = inventory.filter(
            (i) => i.itemId && i.itemId !== "",
          ).length;

          // Equipment: gameState > EquipmentSystem
          const equipment: Record<string, string> = {};
          if (gameState?.equipment) {
            for (const [slot, eq] of Object.entries(gameState.equipment)) {
              if (eq?.itemId) {
                equipment[slot] = eq.itemId;
              }
            }
          } else if (equipmentSystem?.getPlayerEquipment) {
            try {
              const eq = equipmentSystem.getPlayerEquipment(characterId);
              if (eq) {
                for (const [slot, value] of Object.entries(eq)) {
                  // Skip non-slot keys like "playerId", "totalStats"
                  if (slot === "playerId" || slot === "totalStats" || !value)
                    continue;
                  // value can be a string itemId or an object {itemId: string}
                  if (typeof value === "string") {
                    equipment[slot] = value;
                  } else if (
                    typeof value === "object" &&
                    "itemId" in value &&
                    value.itemId
                  ) {
                    equipment[slot] = value.itemId as string;
                  }
                }
              }
            } catch {
              /* entity may not have equipment */
            }
          }

          // Position: gameState > entity
          let position: [number, number, number] | null =
            gameState?.position ?? null;
          if (!position && entity) {
            const pos = entity.position;
            if (pos) {
              position = [pos.x ?? 0, pos.y ?? 0, pos.z ?? 0] as [
                number,
                number,
                number,
              ];
            }
          }

          // Health
          const health =
            gameState?.health ?? (entityData?.health as number) ?? 0;
          const maxHealth =
            gameState?.maxHealth ?? (entityData?.maxHealth as number) ?? 10;

          // Coins
          const coins = (entityData?.coins as number) ?? 0;

          // Quests: active, completed, and available
          let quests: Array<{
            questId: string;
            name: string;
            status: string;
            currentStage?: string;
            stageDescription?: string;
            stageProgress?: Record<string, number>;
          }> = [];
          let questPoints = 0;
          if (questSystem) {
            try {
              // Get all quest definitions and build status for each
              const allDefs = questSystem.getAllQuestDefinitions?.() ?? [];
              questPoints = questSystem.getQuestPoints?.(characterId) ?? 0;

              for (const def of allDefs) {
                const status =
                  questSystem.getQuestStatus?.(characterId, def.id) ??
                  "not_started";
                const quest: {
                  questId: string;
                  name: string;
                  status: string;
                  currentStage?: string;
                  stageDescription?: string;
                  stageProgress?: Record<string, number>;
                } = {
                  questId: def.id,
                  name: def.name,
                  status,
                };

                // Add progress details for active quests
                if (
                  status === "in_progress" ||
                  status === "ready_to_complete"
                ) {
                  const activeQuests =
                    questSystem.getActiveQuests?.(characterId) ?? [];
                  const active = activeQuests.find((q) => q.questId === def.id);
                  if (active) {
                    quest.currentStage = active.currentStage;
                    quest.stageProgress = active.stageProgress;
                    // Get stage description from definition
                    const fullDef = questSystem.getQuestDefinition?.(def.id);
                    const stage = fullDef?.stages.find(
                      (s) => s.id === active.currentStage,
                    );
                    quest.stageDescription = stage?.description;
                  }
                }

                // Only include quests that aren't not_started
                if (status !== "not_started") {
                  quests.push(quest);
                }
              }

              // Sort: in_progress first, then ready_to_complete, then completed
              const statusOrder: Record<string, number> = {
                in_progress: 0,
                ready_to_complete: 1,
                completed: 2,
              };
              quests.sort(
                (a, b) =>
                  (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3),
              );
            } catch {
              /* quest system may not be ready */
            }
          }

          // Bank data: query database directly (BankingSystem in-memory cache is not DB-backed)
          let bankItems: Array<{
            itemId: string;
            quantity: number;
            slot: number;
            tabIndex: number;
          }> = [];
          if (bankRepo) {
            try {
              bankItems = await bankRepo.getPlayerBank(characterId);
            } catch {
              /* database may not be ready */
            }
          }

          return {
            characterId,
            name,
            state,
            scriptedRole,
            startedAt,
            lastActivity,
            error,

            entityId: gameState?.playerId ?? (entity ? characterId : null),
            position,
            health,
            maxHealth,
            alive: gameState?.alive ?? entityData?.alive !== false,
            inCombat:
              gameState?.inCombat ??
              !!(entityData?.inCombat || entityData?.combatTarget),
            combatTarget:
              gameState?.currentTarget ??
              (entityData?.combatTarget as string) ??
              null,

            goal: goal
              ? {
                  type: goal.type ?? "idle",
                  description: goal.description ?? "",
                  progress: goal.progress ?? 0,
                  target: goal.target ?? 0,
                  location: goal.location,
                  targetSkill: goal.targetSkill,
                  startedAt: goal.startedAt ?? 0,
                  locked: goal.locked ?? false,
                }
              : null,
            goalsPaused,

            skills,
            combatLevel,
            totalLevel,

            inventory: inventory.map((i) => ({
              slot: i.slot,
              itemId: i.itemId,
              quantity: i.quantity,
            })),
            inventoryUsed,
            inventoryMax: 28,
            coins,
            equipment,

            recentThoughts,

            quests,
            questPoints,

            bankItems: bankItems.map((i) => ({
              itemId: i.itemId,
              quantity: i.quantity,
              slot: i.slot,
              tabIndex: i.tabIndex,
            })),
          };
        };

        // Collect all agents by characterId (deduped)
        const agentPromises = new Map<
          string,
          Promise<Awaited<ReturnType<typeof buildAgentData>>>
        >();

        // 1. Embedded agents from AgentManager
        if (agentManager) {
          for (const agent of agentManager.getAllAgents()) {
            agentPromises.set(
              agent.characterId,
              buildAgentData(
                agent.characterId,
                agent.name,
                agent.state,
                agent.startedAt,
                agent.lastActivity,
                agent.scriptedRole,
                agent.error,
              ),
            );
          }
        }

        // 2. Model agents from ModelAgentSpawner
        const runningModelAgents = getRunningAgents() as Map<
          string,
          {
            characterId: string;
            accountId: string;
            config: { displayName: string };
          }
        >;
        for (const modelAgent of runningModelAgents.values()) {
          if (!agentPromises.has(modelAgent.characterId)) {
            agentPromises.set(
              modelAgent.characterId,
              buildAgentData(
                modelAgent.characterId,
                modelAgent.config.displayName,
                "running",
                Date.now(),
                Date.now(),
              ),
            );
          }
        }

        const agents = await Promise.all(agentPromises.values());

        return reply.send({
          timestamp: Date.now(),
          agentCount: agents.length,
          agents,
        });
      } catch (err) {
        console.error("[AdminRoutes] Agent monitor error:", err);
        return reply.code(500).send({ error: "Failed to load agent monitor" });
      }
    },
  );

  /**
   * POST /admin/players/:playerId/reset
   * Reset an agent's character to fresh-start state without tearing down the
   * ElizaOS runtime.  This avoids the [PLUGIN:SQL] "Database is shutting down"
   * errors that occur when runtime.stop() races against PGLite's async teardown.
   *
   * Approach: disconnect the game-facing service (WebSocket / entity), delete
   * the character row (CASCADE clears all related tables atomically), insert a
   * fresh row with schema defaults, then reconnect the service so the server
   * loads the pristine data.  The ElizaOS runtime and PGLite stay untouched.
   */
  fastify.post<{ Params: { playerId: string } }>(
    "/admin/players/:playerId/reset",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { db } = ctx;

      const { playerId } = request.params;

      // Verify character exists and grab identity fields we need to recreate it
      const [character] = await db
        .select({
          id: schema.characters.id,
          name: schema.characters.name,
          accountId: schema.characters.accountId,
          isAgent: schema.characters.isAgent,
        })
        .from(schema.characters)
        .where(eq(schema.characters.id, playerId))
        .limit(1);

      if (!character) {
        return reply.code(404).send({ error: "Character not found" });
      }

      const {
        getAgentManager,
        getRunningAgents,
        getAgentRuntimeByCharacterId,
      } = await import("../../eliza/index.js");

      // ── Identify agent type ───────────────────────────────────────
      let agentType: "model" | "embedded" | "none" = "none";

      const runningModelAgents = getRunningAgents() as Map<
        string,
        {
          characterId: string;
          config: { provider: string; model: string; displayName: string };
        }
      >;
      for (const [, agent] of runningModelAgents) {
        if (agent.characterId === playerId) {
          agentType = "model";
          break;
        }
      }

      const agentManager = getAgentManager();
      if (agentType === "none" && agentManager?.hasAgent(playerId)) {
        agentType = "embedded";
      }

      try {
        // ── Step 1: Disconnect from the game world ──────────────────
        // For model agents we only disconnect the HyperscapeService
        // (behavior loop + WebSocket) while leaving the ElizaOS runtime
        // and its PGLite database completely untouched.  This eliminates
        // the [PLUGIN:SQL] shutdown race entirely.
        if (agentType === "model") {
          console.log(
            `[AdminRoutes] Disconnecting model agent "${character.name}" for reset (runtime stays alive)...`,
          );
          const runtime = getAgentRuntimeByCharacterId(playerId);
          if (runtime) {
            try {
              const service = runtime.getService("hyperscapeService") as {
                stopAutonomousBehavior?: () => void;
                disconnect?: () => Promise<void>;
                connect?: (url: string) => Promise<void>;
                startAutonomousBehavior?: () => void;
                serverUrl?: string;
              } | null;
              // Stop LLM decision loop first, then disconnect WebSocket.
              service?.stopAutonomousBehavior?.();
              if (service?.disconnect) {
                await service.disconnect();
              }
            } catch {
              /* service may not exist or already disconnected */
            }
          }
        } else if (agentType === "embedded") {
          console.log(
            `[AdminRoutes] Stopping embedded agent "${character.name}" for reset...`,
          );
          await agentManager!.stopAgent(playerId);
        }

        // Explicitly remove the entity from the world.  On disconnect
        // the SocketManager starts a 30s reconnect grace period that
        // keeps the OLD entity (with stale skills/inventory) alive.
        // If the agent reconnects within that window, tryReconnect()
        // reuses the old entity — so the DB reset is invisible.
        // Removing it here forces a fresh entity + DB load on reconnect.
        if (world.entities?.remove) {
          world.entities.remove(playerId);
        }

        // ── Step 2: Delete and recreate the character ───────────────
        //
        // Entity removal triggers fire-and-forget async saves in several
        // ECS systems (InventorySystem.cleanupInventory, CoinPouchSystem.
        // cleanupPlayerCoins, EquipmentSystem PLAYER_LEFT handler).  These
        // do `getPlayerAsync(id).then(row => save(...))` without awaiting.
        //
        // If we DELETE + INSERT atomically the async saves can race: they
        // start before the DELETE, find no old row, then the INSERT runs,
        // and the saves' .then() resolves against the NEW row — writing
        // stale inventory/equipment/coins back.
        //
        // Fix: DELETE first so the async saves either fail (no row) or
        // write to a row that's about to be gone.  Wait for them to
        // drain, then INSERT the pristine row.
        await db
          .delete(schema.characters)
          .where(eq(schema.characters.id, playerId));

        // Let fire-and-forget saves from ECS cleanup handlers settle.
        // They'll fail with "character not found" since the row is gone.
        await new Promise((r) => setTimeout(r, 500));

        await db.insert(schema.characters).values({
          id: playerId,
          accountId: character.accountId,
          name: character.name,
          isAgent: character.isAgent,
          createdAt: Date.now(),
        });

        console.log(
          `[AdminRoutes] Reset account for character "${character.name}" (${playerId}) — DELETE + INSERT`,
        );

        // ── Step 3: Reconnect to the game world ─────────────────────
        // The server reloads all data from DB on connection (getPlayerAsync),
        // so the agent will pick up the pristine character state.
        if (agentType === "model") {
          console.log(
            `[AdminRoutes] Reconnecting model agent "${character.name}"...`,
          );
          const runtime = getAgentRuntimeByCharacterId(playerId);
          if (runtime) {
            try {
              const service = runtime.getService("hyperscapeService") as {
                connect?: (url: string) => Promise<void>;
                startAutonomousBehavior?: () => void;
                serverUrl?: string;
              } | null;
              if (service?.connect && service.serverUrl) {
                await service.connect(service.serverUrl);
              }
              // Wait for the server to finish the spawn flow (load fresh
              // data from DB, create entity, register with SkillsSystem).
              // connect() resolves when the WebSocket opens, but the full
              // character-selection handshake is async after that.
              await new Promise((r) => setTimeout(r, 1500));
              service?.startAutonomousBehavior?.();
            } catch (reconnectErr) {
              console.error(
                `[AdminRoutes] Failed to reconnect model agent "${character.name}":`,
                reconnectErr,
              );
            }
          }
        } else if (agentType === "embedded") {
          console.log(
            `[AdminRoutes] Respawning embedded agent "${character.name}"...`,
          );
          await agentManager!.startAgent(playerId).catch((err: unknown) => {
            console.error(
              `[AdminRoutes] Failed to respawn embedded agent "${character.name}":`,
              err,
            );
          });
          await new Promise((r) => setTimeout(r, 1000));
        }

        return reply.send({ success: true, name: character.name });
      } catch (err) {
        console.error("[AdminRoutes] Reset account error:", err);
        return reply.code(500).send({ error: "Failed to reset account" });
      }
    },
  );

  /** GET /admin/stats - Dashboard statistics */
  fastify.get(
    "/admin/stats",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { db } = ctx;

      let users: Array<{ count: number }>;
      let characters: Array<{ count: number }>;
      let active: Array<{ count: number }>;
      let banned: Array<{ count: number }>;
      try {
        [users, characters, active, banned] = await Promise.all([
          db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.characters),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.playerSessions)
            .where(sql`${schema.playerSessions.sessionEnd} IS NULL`),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.userBans)
            .where(eq(schema.userBans.active, 1)),
        ]);
      } catch (err) {
        reply.log.error(err, "[AdminRoutes] Failed to load admin stats");
        return reply.code(500).send({ error: "Failed to load admin stats" });
      }

      return reply.send({
        totalUsers: users[0]?.count ?? 0,
        totalCharacters: characters[0]?.count ?? 0,
        activeSessions: active[0]?.count ?? 0,
        bannedUsers: banned[0]?.count ?? 0,
      });
    },
  );

  // ============================================================================
  // MAINTENANCE MODE ENDPOINTS
  // ============================================================================

  /**
   * GET /admin/maintenance/status
   * Get current maintenance mode status
   */
  fastify.get(
    "/admin/maintenance/status",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(getMaintenanceStatus());
    },
  );

  /**
   * POST /admin/maintenance/enter
   * Enter maintenance mode - pauses new duel cycles and waits for safe deploy state
   *
   * Body params:
   * - reason: string (optional) - Reason for maintenance
   * - timeoutMs: number (optional) - Max time to wait for safe state (default: 5 minutes)
   */
  fastify.post<{
    Body: { reason?: string; timeoutMs?: number };
  }>(
    "/admin/maintenance/enter",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const reason = request.body?.reason || "deployment";
      const timeoutMs = request.body?.timeoutMs || 5 * 60 * 1000;

      try {
        const status = await enterMaintenanceMode(reason, timeoutMs);
        return reply.send({
          success: true,
          status,
        });
      } catch (error) {
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : "Failed to enter maintenance mode",
        });
      }
    },
  );

  /**
   * POST /admin/maintenance/exit
   * Exit maintenance mode - resumes duel scheduling and betting
   */
  fastify.post(
    "/admin/maintenance/exit",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = exitMaintenanceMode();
        return reply.send({
          success: true,
          status,
        });
      } catch (error) {
        return reply.code(500).send({
          error:
            error instanceof Error
              ? error.message
              : "Failed to exit maintenance mode",
        });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Duel & Agent Control Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /admin/duels/status
   * Live duel cycle, leaderboard, and recent duels for the duel dashboard.
   */
  fastify.get(
    "/admin/duels/status",
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { getStreamingDuelScheduler } =
          await import("../../systems/StreamingDuelScheduler/index.js");
        const scheduler = getStreamingDuelScheduler();

        if (!scheduler) {
          return reply.send({
            currentCycle: null,
            leaderboard: [],
            recentDuels: [],
            streamHealth: null,
          });
        }

        const cycle = scheduler.getCurrentCycle();
        const leaderboard = scheduler.getLeaderboard();
        const recentDuels = scheduler.getRecentDuels(20);

        // Stream health: read from external RTMP status file if configured
        let streamHealth: {
          rtmpConnected: boolean;
          viewerCount: number;
        } | null = null;
        const rtmpStatusFile = (process.env.RTMP_STATUS_FILE || "").trim();
        if (rtmpStatusFile) {
          try {
            const fs = await import("fs");
            const raw = fs.readFileSync(rtmpStatusFile, "utf8").trim();
            if (raw) {
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              if (
                parsed &&
                typeof parsed === "object" &&
                Array.isArray(parsed.destinations)
              ) {
                const stats = parsed.stats as Record<string, unknown> | null;
                streamHealth = {
                  rtmpConnected: parsed.destinations.length > 0,
                  viewerCount:
                    typeof stats?.viewerCount === "number"
                      ? stats.viewerCount
                      : 0,
                };
              }
            }
          } catch {
            /* RTMP status file not available */
          }
        }

        // Map cycle to a simpler response shape
        let currentCycle: {
          phase: string;
          contestants: Array<{
            characterId: string;
            name: string;
            combatLevel: number;
            currentHp: number;
            maxHp: number;
          }>;
          startedAt: number;
          phaseStartedAt: number;
          winner: { characterId: string; name: string } | null;
          winReason: string | null;
        } | null = null;

        if (cycle) {
          const contestants: Array<{
            characterId: string;
            name: string;
            combatLevel: number;
            currentHp: number;
            maxHp: number;
          }> = [];
          if (cycle.agent1) {
            contestants.push({
              characterId: cycle.agent1.characterId,
              name: cycle.agent1.name,
              combatLevel: cycle.agent1.combatLevel,
              currentHp: cycle.agent1.currentHp,
              maxHp: cycle.agent1.maxHp,
            });
          }
          if (cycle.agent2) {
            contestants.push({
              characterId: cycle.agent2.characterId,
              name: cycle.agent2.name,
              combatLevel: cycle.agent2.combatLevel,
              currentHp: cycle.agent2.currentHp,
              maxHp: cycle.agent2.maxHp,
            });
          }

          let winner: { characterId: string; name: string } | null = null;
          if (cycle.winnerId) {
            const winnerAgent =
              cycle.agent1?.characterId === cycle.winnerId
                ? cycle.agent1
                : cycle.agent2;
            if (winnerAgent) {
              winner = {
                characterId: winnerAgent.characterId,
                name: winnerAgent.name,
              };
            }
          }

          currentCycle = {
            phase: cycle.phase,
            contestants,
            startedAt: cycle.cycleStartTime,
            phaseStartedAt: cycle.phaseStartTime,
            winner,
            winReason: cycle.winReason,
          };
        }

        return reply.send({
          currentCycle,
          leaderboard,
          recentDuels,
          streamHealth,
        });
      } catch (err) {
        console.error("[AdminRoutes] Duel status error:", err);
        return reply.code(500).send({ error: "Failed to fetch duel status" });
      }
    },
  );

  /**
   * Helper: find agent type and stop info for a characterId.
   * Returns { agentType, modelProvider, modelModel, agentManager }.
   */
  async function resolveAgentType(characterId: string) {
    const { getAgentManager, getRunningAgents } =
      await import("../../eliza/index.js");

    let agentType: "model" | "embedded" | "none" = "none";
    let modelProvider: string | null = null;
    let modelModel: string | null = null;

    const runningModelAgents = getRunningAgents() as Map<
      string,
      {
        characterId: string;
        config: { provider: string; model: string; displayName: string };
      }
    >;
    for (const [, agent] of runningModelAgents) {
      if (agent.characterId === characterId) {
        agentType = "model";
        modelProvider = agent.config.provider;
        modelModel = agent.config.model;
        break;
      }
    }

    const agentManager = getAgentManager();
    if (agentType === "none" && agentManager?.hasAgent(characterId)) {
      agentType = "embedded";
    }

    return { agentType, modelProvider, modelModel, agentManager };
  }

  /**
   * POST /admin/agents/:characterId/pause
   * Pause an agent's autonomous behavior without stopping the runtime.
   */
  fastify.post<{ Params: { characterId: string } }>(
    "/admin/agents/:characterId/pause",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { characterId } = request.params;

      try {
        const { agentType, agentManager } = await resolveAgentType(characterId);

        if (agentType === "none") {
          return reply.code(404).send({ error: "Agent not found" });
        }

        if (agentType === "model") {
          const { getAgentRuntimeByCharacterId } =
            await import("../../eliza/index.js");
          const runtime = getAgentRuntimeByCharacterId(characterId);
          if (runtime) {
            const service = runtime.getService("hyperscapeService") as {
              stopAutonomousBehavior?: () => void;
            } | null;
            service?.stopAutonomousBehavior?.();
          }
        } else if (agentType === "embedded" && agentManager) {
          await agentManager.pauseAgent(characterId);
        }

        console.log(`[AdminRoutes] Paused agent ${characterId}`);
        return reply.send({ success: true });
      } catch (err) {
        console.error("[AdminRoutes] Pause agent error:", err);
        return reply.code(500).send({ error: "Failed to pause agent" });
      }
    },
  );

  /**
   * POST /admin/agents/:characterId/resume
   * Resume a paused agent's autonomous behavior.
   */
  fastify.post<{ Params: { characterId: string } }>(
    "/admin/agents/:characterId/resume",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { characterId } = request.params;

      try {
        const { agentType, agentManager } = await resolveAgentType(characterId);

        if (agentType === "none") {
          return reply.code(404).send({ error: "Agent not found" });
        }

        if (agentType === "model") {
          const { getAgentRuntimeByCharacterId } =
            await import("../../eliza/index.js");
          const runtime = getAgentRuntimeByCharacterId(characterId);
          if (runtime) {
            const service = runtime.getService("hyperscapeService") as {
              startAutonomousBehavior?: () => void;
            } | null;
            service?.startAutonomousBehavior?.();
          }
        } else if (agentType === "embedded" && agentManager) {
          await agentManager.resumeAgent(characterId);
        }

        console.log(`[AdminRoutes] Resumed agent ${characterId}`);
        return reply.send({ success: true });
      } catch (err) {
        console.error("[AdminRoutes] Resume agent error:", err);
        return reply.code(500).send({ error: "Failed to resume agent" });
      }
    },
  );

  /**
   * POST /admin/agents/:characterId/stop
   * Fully stop an agent (remove from world). Requires server restart to bring back.
   */
  fastify.post<{ Params: { characterId: string } }>(
    "/admin/agents/:characterId/stop",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { characterId } = request.params;

      try {
        const { agentType, modelProvider, modelModel, agentManager } =
          await resolveAgentType(characterId);

        if (agentType === "none") {
          return reply.code(404).send({ error: "Agent not found" });
        }

        if (agentType === "model" && modelProvider && modelModel) {
          const { getAgentRuntimeByCharacterId, stopModelAgent } =
            await import("../../eliza/index.js");

          // Gracefully wind down the HyperscapeService before tearing down
          // the runtime.  Any residual [PLUGIN:SQL] teardown warnings are
          // caught by the global unhandledRejection handler in shutdown.ts.
          const runtime = getAgentRuntimeByCharacterId(characterId);
          if (runtime) {
            try {
              const service = runtime.getService("hyperscapeService") as {
                stopAutonomousBehavior?: () => void;
                stop?: () => Promise<void>;
              } | null;
              if (service?.stop) {
                await service.stop();
              } else {
                service?.stopAutonomousBehavior?.();
              }
            } catch {
              /* service may not exist or already stopped */
            }
            await new Promise((r) => setTimeout(r, 2000));
          }

          await stopModelAgent(modelProvider, modelModel);
        } else if (agentType === "embedded" && agentManager) {
          await agentManager.stopAgent(characterId);
        }

        console.log(`[AdminRoutes] Stopped agent ${characterId}`);
        return reply.send({ success: true });
      } catch (err) {
        console.error("[AdminRoutes] Stop agent error:", err);
        return reply.code(500).send({ error: "Failed to stop agent" });
      }
    },
  );

  /**
   * GET /admin/agents/:characterId/kills
   * NPC kill counts for an agent, aggregated by NPC type.
   */
  fastify.get<{ Params: { characterId: string } }>(
    "/admin/agents/:characterId/kills",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const ctx = getDb(reply);
      if (!ctx) return;
      const { db } = ctx;
      const { characterId } = request.params;

      try {
        const kills = await db
          .select({
            npcId: schema.npcKills.npcId,
            count: schema.npcKills.killCount,
          })
          .from(schema.npcKills)
          .where(eq(schema.npcKills.playerId, characterId))
          .orderBy(desc(schema.npcKills.killCount));

        return reply.send({
          kills: kills.map((k) => ({
            npcId: k.npcId,
            name: k.npcId
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            count: k.count,
          })),
        });
      } catch (err) {
        console.error("[AdminRoutes] Agent kills error:", err);
        return reply.code(500).send({ error: "Failed to fetch kill data" });
      }
    },
  );
}
