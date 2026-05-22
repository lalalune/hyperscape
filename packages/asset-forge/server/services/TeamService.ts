/**
 * Team Service
 * Manages teams, games, memberships, invites, and permissions.
 *
 * Database is optional — all operations return null/empty when DB is unavailable.
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb, isDatabaseEnabled } from "../db/db";
import {
  teams,
  games,
  teamMembers,
  teamInvites,
  teamPermissions,
  forgeUsers,
  type Team,
  type Game,
  type TeamMember,
  type TeamInvite,
  type NewTeam,
  type NewGame,
} from "../db/schema";
import { randomBytes } from "crypto";

/** Role hierarchy for permission checks */
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/** Default permissions by role */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ["project:view"],
  editor: [
    "project:view",
    "project:create",
    "project:edit",
    "staging:push",
    "ai:generate",
    "asset:promote-staging",
    "manifest:edit",
  ],
  admin: [
    "project:view",
    "project:create",
    "project:edit",
    "project:delete",
    "staging:push",
    "prod:push",
    "prod:approve",
    "ai:generate",
    "asset:promote-staging",
    "asset:promote-prod",
    "manifest:edit",
    "team:invite",
    "team:manage-roles",
  ],
  owner: [
    "project:view",
    "project:create",
    "project:edit",
    "project:delete",
    "staging:push",
    "prod:push",
    "prod:approve",
    "ai:generate",
    "asset:promote-staging",
    "asset:promote-prod",
    "manifest:edit",
    "team:invite",
    "team:manage-roles",
    "team:manage-billing",
    "team:delete",
    "team:transfer",
  ],
};

export class TeamService {
  // ==================== Teams ====================

  async createTeam(
    data: { name: string; slug: string; description?: string },
    createdBy: string,
  ): Promise<Team | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [team] = await db
      .insert(teams)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        createdBy,
      })
      .returning();

    // Add creator as owner
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: createdBy,
      role: "owner",
    });

    return team;
  }

  async getTeam(teamId: string): Promise<Team | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    return team ?? null;
  }

  async getTeamBySlug(slug: string): Promise<Team | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.slug, slug))
      .limit(1);

    return team ?? null;
  }

  async updateTeam(
    teamId: string,
    updates: Partial<Pick<NewTeam, "name" | "description" | "avatarUrl">>,
  ): Promise<Team | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [updated] = await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, teamId))
      .returning();

    return updated ?? null;
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const result = await db.delete(teams).where(eq(teams.id, teamId));
    return (result?.rowCount ?? 0) > 0;
  }

  /** Get all teams a user belongs to */
  async getTeamsForUser(
    userId: string,
  ): Promise<Array<{ team: Team; role: string }>> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    const rows = await db
      .select({
        team: teams,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    return rows;
  }

  // ==================== Games ====================

  async createGame(
    teamId: string,
    data: {
      name: string;
      slug: string;
      description?: string;
      stagingServerUrl?: string;
      stagingAssetsPath?: string;
      productionServerUrl?: string;
      productionAssetsPath?: string;
      /**
       * GameMode manifest. Omit to use the Hyperia default. The route
       * validates this against the registry before passing it here.
       */
      gameMode?: {
        playerController: string;
        camera: string;
        inputContext: string;
        pawn: string;
      };
    },
  ): Promise<Game | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [game] = await db
      .insert(games)
      .values({
        teamId,
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        stagingServerUrl: data.stagingServerUrl ?? null,
        stagingAssetsPath: data.stagingAssetsPath ?? null,
        productionServerUrl: data.productionServerUrl ?? null,
        productionAssetsPath: data.productionAssetsPath ?? null,
        gameMode: data.gameMode ?? {
          playerController: "click-to-walk",
          camera: "orbit",
          inputContext: "hyperia-default",
          pawn: "humanoid-rpg",
        },
      })
      .returning();

    return game;
  }

  async getGamesForTeam(teamId: string): Promise<Game[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    return db.select().from(games).where(eq(games.teamId, teamId));
  }

  async getGame(gameId: string): Promise<Game | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    return game ?? null;
  }

  async updateGame(
    gameId: string,
    updates: Partial<NewGame>,
  ): Promise<Game | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [updated] = await db
      .update(games)
      .set(updates)
      .where(eq(games.id, gameId))
      .returning();

    return updated ?? null;
  }

  async deleteGame(gameId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const result = await db.delete(games).where(eq(games.id, gameId));
    return (result?.rowCount ?? 0) > 0;
  }

  // ==================== Members ====================

  async getMembers(teamId: string): Promise<
    Array<{
      member: TeamMember;
      user: {
        displayName: string;
        email: string | null;
        avatarUrl: string | null;
      };
    }>
  > {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    return db
      .select({
        member: teamMembers,
        user: {
          displayName: forgeUsers.displayName,
          email: forgeUsers.email,
          avatarUrl: forgeUsers.avatarUrl,
        },
      })
      .from(teamMembers)
      .innerJoin(forgeUsers, eq(forgeUsers.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId));
  }

  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const [member] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
      )
      .limit(1);

    return member?.role ?? null;
  }

  async updateMemberRole(
    teamId: string,
    userId: string,
    newRole: string,
  ): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const result = await db
      .update(teamMembers)
      .set({ role: newRole })
      .where(
        and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
      );

    return (result?.rowCount ?? 0) > 0;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const result = await db
      .delete(teamMembers)
      .where(
        and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
      );

    return (result?.rowCount ?? 0) > 0;
  }

  // ==================== Invites ====================

  async createInvite(
    teamId: string,
    email: string,
    role: string,
    invitedBy: string,
  ): Promise<TeamInvite | null> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return null;

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(teamInvites)
      .values({
        teamId,
        email,
        role,
        invitedBy,
        token,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [teamInvites.teamId, teamInvites.email],
        set: { role, token, expiresAt, invitedBy, acceptedAt: null },
      })
      .returning();

    return invite;
  }

  async acceptInvite(token: string, userId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite || invite.acceptedAt || new Date() > invite.expiresAt) {
      return false;
    }

    // Add member and mark invite as accepted in a transaction-like sequence
    await db.insert(teamMembers).values({
      teamId: invite.teamId,
      userId,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });

    await db
      .update(teamInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id));

    return true;
  }

  async getPendingInvites(teamId: string): Promise<TeamInvite[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    return db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          sql`${teamInvites.acceptedAt} IS NULL`,
          sql`${teamInvites.expiresAt} > NOW()`,
        ),
      );
  }

  /**
   * Pending invitations addressed to a specific email — used by the
   * "Invitations TO me" surface on the user's profile. Matches case-
   * insensitively against the email stored on the invite record.
   */
  async getPendingInvitesForEmail(email: string): Promise<TeamInvite[]> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return [];

    return db
      .select()
      .from(teamInvites)
      .where(
        and(
          sql`LOWER(${teamInvites.email}) = LOWER(${email})`,
          sql`${teamInvites.acceptedAt} IS NULL`,
          sql`${teamInvites.expiresAt} > NOW()`,
        ),
      );
  }

  async revokeInvite(inviteId: string): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    const result = await db
      .delete(teamInvites)
      .where(eq(teamInvites.id, inviteId));

    return (result?.rowCount ?? 0) > 0;
  }

  // ==================== Permissions ====================

  /**
   * Check if a user has a specific permission within a team.
   * Checks role defaults first, then granular overrides.
   */
  async hasPermission(
    teamId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const db = getDb();
    if (!isDatabaseEnabled() || !db) return false;

    // Get member role
    const role = await this.getMemberRole(teamId, userId);
    if (!role) return false;

    // Check role defaults
    const rolePerms = ROLE_PERMISSIONS[role] ?? [];
    let hasDefault = rolePerms.includes(permission);

    // Check granular overrides
    const [override] = await db
      .select()
      .from(teamPermissions)
      .where(
        and(
          eq(teamPermissions.teamId, teamId),
          eq(teamPermissions.userId, userId),
          eq(teamPermissions.permission, permission),
        ),
      )
      .limit(1);

    if (override) {
      return override.granted;
    }

    return hasDefault;
  }

  /**
   * Check if user has at least the specified role level in a team.
   */
  async hasRoleLevel(
    teamId: string,
    userId: string,
    minRole: string,
  ): Promise<boolean> {
    const role = await this.getMemberRole(teamId, userId);
    if (!role) return false;
    return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 999);
  }
}
