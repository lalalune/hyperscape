/**
 * Authentication Middleware for Asset Forge API
 *
 * Verifies Privy JWT tokens, looks up/creates forge_users,
 * and attaches user context to requests.
 *
 * Uses a derive function applied directly on each route group,
 * NOT an Elysia plugin — avoids plugin deduplication issues.
 */

import { PrivyClient } from "@privy-io/server-auth";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseEnabled } from "../db/db";
import {
  forgeUsers,
  teams,
  teamMembers,
  games,
  worldProjects,
  type ForgeUser,
} from "../db/schema";
import { DEFAULT_GAME_MODE_MANIFEST } from "../utils/gameModeRegistry";

/** User context attached to authenticated requests */
export interface ForgeAuthContext {
  user: ForgeUser | null;
  isAuthenticated: boolean;
  failReason?: string;
}

// Lazy-initialized Privy client singleton
let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient | null {
  if (privyClient) return privyClient;

  const appId = process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) return null;

  privyClient = new PrivyClient(appId, appSecret);
  return privyClient;
}

/** Dev mode user for local development without Privy */
const DEV_USER: ForgeUser = {
  id: "00000000-0000-0000-0000-000000000000",
  privyUserId: "dev-admin",
  email: "dev@localhost",
  displayName: "Dev Admin",
  avatarUrl: null,
  createdAt: new Date(),
  lastActiveAt: new Date(),
};

function fail(reason: string): { auth: ForgeAuthContext } {
  console.warn("[Auth]", reason);
  return { auth: { user: null, isAuthenticated: false, failReason: reason } };
}

/**
 * Find or create a forge user by Privy user ID.
 */
async function findOrCreateForgeUser(
  privyUserId: string,
  email: string | null,
  displayName: string | null,
): Promise<ForgeUser | null> {
  const db = getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(forgeUsers)
    .where(eq(forgeUsers.privyUserId, privyUserId))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    await db
      .update(forgeUsers)
      .set({ lastActiveAt: new Date() })
      .where(eq(forgeUsers.id, user.id));
    // Backfill default game for any team the user owns that has zero games
    // (guards against the prior schema-change regression where seeding a
    // game without `gameMode` silently failed the NOT NULL constraint).
    await ensureDefaultGameForTeams(user);
    // NOTE: world-project backfill removed deliberately. New users start
    // with a game but zero projects — they create their own via
    // NewWorldDialog (blank terrain) or load Hyperia explicitly as a
    // sample. The auto-backfill caused new projects to silently
    // resolve to the Hyperia placeholder and load HYPERIA_GAME_WORLD_CONFIG
    // instead of starting from a blank slate.
    return user;
  }

  const [newUser] = await db
    .insert(forgeUsers)
    .values({
      privyUserId,
      email,
      displayName: displayName || privyUserId,
    })
    .returning();

  await ensurePersonalTeam(newUser);
  return newUser;
}

/**
 * Ensure the user has at least one team.
 */
async function ensurePersonalTeam(user: ForgeUser): Promise<void> {
  const db = getDb();
  if (!db) return;

  const existing = await db
    .select({ id: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (existing.length > 0) return;

  const teamName = user.displayName ? `${user.displayName}'s Team` : "My Team";
  const slug = `team-${user.id.slice(0, 8)}`;

  const [team] = await db
    .insert(teams)
    .values({ name: teamName, slug, createdBy: user.id })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: "owner",
  });

  const [game] = await db
    .insert(games)
    .values({
      teamId: team.id,
      name: "Hyperia",
      slug: "hyperia",
      description: "Default game project",
      gameMode: DEFAULT_GAME_MODE_MANIFEST,
    })
    .returning();

  // Create default world project (placeholder — editor generates terrain on first open)
  await db.insert(worldProjects).values({
    teamId: team.id,
    gameId: game.id,
    name: "Hyperia",
    description: "Default game world",
    worldData: { _placeholder: true },
    createdBy: user.id,
  });
}

/**
 * Ensure every team the user owns has at least one game. Backfills for
 * users whose `ensurePersonalTeam` seed failed (e.g. when the schema
 * added a required `gameMode` column and the insert wasn't updated in
 * lockstep — leaving the team but no game).
 */
async function ensureDefaultGameForTeams(user: ForgeUser): Promise<void> {
  const db = getDb();
  if (!db) return;

  // Teams this user belongs to, with their game counts.
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  for (const { teamId } of userTeams) {
    const existingGames = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.teamId, teamId))
      .limit(1);

    if (existingGames.length > 0) continue;

    await db.insert(games).values({
      teamId,
      name: "Hyperia",
      slug: "hyperia",
      description: "Default game project",
      gameMode: DEFAULT_GAME_MODE_MANIFEST,
    });
    console.log("[Auth] Backfilled default Hyperia game for team", teamId);
  }
}

/**
 * Ensure every game the user belongs to has at least one world project.
 * Backfills for users created before the default project was added.
 */
async function ensureDefaultWorldProject(user: ForgeUser): Promise<void> {
  const db = getDb();
  if (!db) return;

  // Find all games in teams the user belongs to
  const userGames = await db
    .select({ gameId: games.id, teamId: games.teamId })
    .from(games)
    .innerJoin(teamMembers, eq(teamMembers.teamId, games.teamId))
    .where(eq(teamMembers.userId, user.id));

  for (const { gameId, teamId } of userGames) {
    // Check if this game already has any world projects
    const existingProjects = await db
      .select({ id: worldProjects.id })
      .from(worldProjects)
      .where(eq(worldProjects.gameId, gameId))
      .limit(1);

    if (existingProjects.length === 0) {
      await db.insert(worldProjects).values({
        teamId,
        gameId,
        name: "Hyperia",
        description: "Default game world",
        worldData: { _placeholder: true },
        createdBy: user.id,
      });
      console.log("[Auth] Created default world project for game", gameId);
    }
  }
}

/**
 * Derive function for authentication.
 * Apply directly on route groups: `.derive(authDerive)`
 *
 * Usage:
 *   new Elysia().derive(authDerive).get("/me", ({ auth }) => auth.user)
 */
export async function authDerive({
  request,
}: {
  request: Request;
}): Promise<{ auth: ForgeAuthContext }> {
  console.log("[Auth] Checking", new URL(request.url).pathname);

  // Dev mode bypass
  if (
    process.env.GRANT_DEV_ADMIN === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return { auth: { user: DEV_USER, isAuthenticated: true } };
  }

  // No DB = no auth
  if (!isDatabaseEnabled()) {
    return fail("Database not enabled");
  }

  // Extract Bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return fail("No Bearer token in Authorization header");
  }
  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    return fail("Bearer token is empty or too short");
  }

  // Verify with Privy
  const client = getPrivyClient();
  if (!client) {
    const hasAppId = !!(
      process.env.PRIVY_APP_ID || process.env.PUBLIC_PRIVY_APP_ID
    );
    const hasSecret = !!process.env.PRIVY_APP_SECRET;
    return fail(
      `Privy not configured (appId=${hasAppId}, secret=${hasSecret})`,
    );
  }

  try {
    const verifiedClaims = await client.verifyAuthToken(token);
    if (!verifiedClaims?.userId) {
      return fail("Privy token verified but no userId in claims");
    }

    const forgeUser = await findOrCreateForgeUser(
      verifiedClaims.userId,
      null,
      null,
    );

    if (!forgeUser) {
      return fail("Failed to find or create user in database");
    }

    console.log(
      "[Auth] Authenticated user:",
      forgeUser.displayName || forgeUser.privyUserId,
    );
    return {
      auth: {
        user: forgeUser,
        isAuthenticated: true,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Auth] Token verification failed:", msg);
    return fail(`Token verification failed: ${msg}`);
  }
}

/**
 * Guard helper that checks authentication and returns 401 with reason.
 */
export function requireAuthGuard({
  auth,
  set,
}: {
  auth: ForgeAuthContext;
  set: { status: number };
}) {
  if (!auth?.isAuthenticated || !auth?.user) {
    set.status = 401;
    return {
      error: "Authentication required",
      reason: auth?.failReason || "Unknown — auth context not populated",
    };
  }
}
