'use server';

/**
 * Dashboard Server Actions
 *
 * Server-side functions for fetching dashboard statistics and activity.
 */

import { getDatabase } from '@/lib/db';
import { users, characters, playerSessions, inventory, equipment, bankStorage } from '@/lib/schema';
import { desc, eq, sql, count } from 'drizzle-orm';

export interface DashboardStats {
  totalUsers: number;
  totalCharacters: number;
  humanCharacters: number;
  agentCharacters: number;
  activeSessions: number;
  totalSessions: number;
  totalInventoryItems: number;
  totalEquipmentItems: number;
  totalBankItems: number;
}

export interface RecentActivity {
  id: string;
  type: 'login' | 'logout' | 'character_created';
  characterName: string;
  userName: string | null;
  timestamp: number;
  description: string;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDatabase();

  const [
    totalUsersResult,
    totalCharactersResult,
    humanCharactersResult,
    agentCharactersResult,
    activeSessionsResult,
    totalSessionsResult,
    totalInventoryResult,
    totalEquipmentResult,
    totalBankResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(characters),
    db.select({ count: count() }).from(characters).where(eq(characters.isAgent, 0)),
    db.select({ count: count() }).from(characters).where(eq(characters.isAgent, 1)),
    db.select({ count: count() }).from(playerSessions).where(sql`"sessionEnd" IS NULL`),
    db.select({ count: count() }).from(playerSessions),
    db.select({ count: count() }).from(inventory),
    db.select({ count: count() }).from(equipment).where(sql`"itemId" IS NOT NULL`),
    db.select({ count: count() }).from(bankStorage),
  ]);

  return {
    totalUsers: totalUsersResult[0]?.count || 0,
    totalCharacters: totalCharactersResult[0]?.count || 0,
    humanCharacters: humanCharactersResult[0]?.count || 0,
    agentCharacters: agentCharactersResult[0]?.count || 0,
    activeSessions: activeSessionsResult[0]?.count || 0,
    totalSessions: totalSessionsResult[0]?.count || 0,
    totalInventoryItems: totalInventoryResult[0]?.count || 0,
    totalEquipmentItems: totalEquipmentResult[0]?.count || 0,
    totalBankItems: totalBankResult[0]?.count || 0,
  };
}

/**
 * Get recent activity (logins, logouts, character creation)
 */
export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  const db = getDatabase();

  // Get recent sessions with character and user info
  const recentSessions = await db
    .select({
      sessionId: playerSessions.id,
      playerId: playerSessions.playerId,
      sessionStart: playerSessions.sessionStart,
      sessionEnd: playerSessions.sessionEnd,
      characterName: characters.name,
      accountId: characters.accountId,
      userName: users.name,
    })
    .from(playerSessions)
    .innerJoin(characters, eq(playerSessions.playerId, characters.id))
    .leftJoin(users, eq(characters.accountId, users.id))
    .orderBy(desc(playerSessions.sessionStart))
    .limit(limit * 2); // Get more to mix with character creations

  // Get recent character creations
  const recentCharacters = await db
    .select({
      characterId: characters.id,
      characterName: characters.name,
      createdAt: characters.createdAt,
      accountId: characters.accountId,
      userName: users.name,
    })
    .from(characters)
    .leftJoin(users, eq(characters.accountId, users.id))
    .orderBy(desc(characters.createdAt))
    .limit(limit);

  // Combine and format activities
  const activities: RecentActivity[] = [];

  // Add sessions (logins/logouts)
  for (const session of recentSessions) {
    if (session.sessionEnd) {
      // Logout
      activities.push({
        id: `logout-${session.sessionId}`,
        type: 'logout',
        characterName: session.characterName,
        userName: session.userName,
        timestamp: Number(session.sessionEnd),
        description: `${session.characterName} logged out`,
      });
    }

    // Login
    activities.push({
      id: `login-${session.sessionId}`,
      type: 'login',
      characterName: session.characterName,
      userName: session.userName,
      timestamp: Number(session.sessionStart),
      description: `${session.characterName} joined the server`,
    });
  }

  // Add character creations
  for (const char of recentCharacters) {
    if (char.createdAt) {
      activities.push({
        id: `character-${char.characterId}`,
        type: 'character_created',
        characterName: char.characterName,
        userName: char.userName,
        timestamp: Number(char.createdAt),
        description: `${char.characterName} was created`,
      });
    }
  }

  // Sort by timestamp descending and limit
  return activities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get top players by playtime
 */
export async function getTopPlayersByPlaytime(limit: number = 5) {
  const db = getDatabase();

  const topPlayers = await db
    .select({
      characterId: characters.id,
      characterName: characters.name,
      totalPlaytime: sql<number>`COALESCE(SUM(${playerSessions.playtimeMinutes}), 0)`,
      sessionCount: count(playerSessions.id),
    })
    .from(characters)
    .leftJoin(playerSessions, eq(characters.id, playerSessions.playerId))
    .groupBy(characters.id, characters.name)
    .orderBy(desc(sql`COALESCE(SUM(${playerSessions.playtimeMinutes}), 0)`))
    .limit(limit);

  return topPlayers.map(p => ({
    characterId: p.characterId,
    characterName: p.characterName,
    totalPlaytime: Number(p.totalPlaytime),
    sessionCount: Number(p.sessionCount),
  }));
}
