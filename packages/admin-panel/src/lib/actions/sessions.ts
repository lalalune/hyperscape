'use server';

/**
 * Session Server Actions
 *
 * Server-side functions for managing player sessions.
 */

import { getDatabase } from '@/lib/db';
import { playerSessions, characters, users } from '@/lib/schema';
import { desc, eq, sql } from 'drizzle-orm';

export interface SessionWithDetails {
  id: string;
  playerId: string;
  characterName: string;
  accountName: string | null;
  sessionStart: number;
  sessionEnd: number | null;
  lastActivity: number | null;
  playtimeMinutes: number | null;
  isActive: boolean;
}

/**
 * Get all active sessions (sessionEnd IS NULL)
 */
export async function getActiveSessions(): Promise<SessionWithDetails[]> {
  const db = getDatabase();

  const activeSessions = await db
    .select({
      id: playerSessions.id,
      playerId: playerSessions.playerId,
      sessionStart: playerSessions.sessionStart,
      sessionEnd: playerSessions.sessionEnd,
      lastActivity: playerSessions.lastActivity,
      playtimeMinutes: playerSessions.playtimeMinutes,
      characterName: characters.name,
      accountId: characters.accountId,
      accountName: users.name,
    })
    .from(playerSessions)
    .innerJoin(characters, eq(playerSessions.playerId, characters.id))
    .leftJoin(users, eq(characters.accountId, users.id))
    .where(sql`${playerSessions.sessionEnd} IS NULL`)
    .orderBy(desc(playerSessions.sessionStart));

  return activeSessions.map(s => ({
    id: s.id,
    playerId: s.playerId,
    characterName: s.characterName,
    accountName: s.accountName,
    sessionStart: Number(s.sessionStart),
    sessionEnd: s.sessionEnd ? Number(s.sessionEnd) : null,
    lastActivity: s.lastActivity ? Number(s.lastActivity) : null,
    playtimeMinutes: s.playtimeMinutes,
    isActive: true,
  }));
}

/**
 * Close a session (mark it as ended)
 */
export async function closeSession(sessionId: string) {
  const db = getDatabase();

  await db
    .update(playerSessions)
    .set({
      sessionEnd: Date.now(),
      reason: 'Admin closed',
    })
    .where(eq(playerSessions.id, sessionId));

  return { success: true };
}

/**
 * Close all stale sessions (no activity in last X minutes)
 */
export async function closeInactiveSessions(inactiveMinutes: number = 30) {
  const db = getDatabase();
  const cutoffTime = Date.now() - (inactiveMinutes * 60 * 1000);

  const result = await db
    .update(playerSessions)
    .set({
      sessionEnd: Date.now(),
      reason: 'Auto-closed (inactive)',
    })
    .where(sql`${playerSessions.sessionEnd} IS NULL AND ${playerSessions.lastActivity} < ${cutoffTime}`);

  return { success: true, closed: (result as any).rowCount || 0 };
}
