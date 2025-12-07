import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { playerSessions, characters } from './src/lib/schema.ts';
import { eq, sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/hyperscape';
const client = postgres(connectionString);
const db = drizzle(client);

// Check active sessions
const activeSessions = await db
  .select({
    sessionId: playerSessions.id,
    playerId: playerSessions.playerId,
    sessionStart: playerSessions.sessionStart,
    sessionEnd: playerSessions.sessionEnd,
    lastActivity: playerSessions.lastActivity,
    characterName: characters.name,
  })
  .from(playerSessions)
  .leftJoin(characters, eq(playerSessions.playerId, characters.id))
  .where(sql`${playerSessions.sessionEnd} IS NULL`);

console.log('Active sessions (sessionEnd IS NULL):');
console.log(JSON.stringify(activeSessions, null, 2));
console.log(`\nTotal active sessions: ${activeSessions.length}`);

await client.end();
