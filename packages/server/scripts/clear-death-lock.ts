/**
 * Emergency script to clear a stuck death lock
 * Run this if a player is stuck on death screen at spawn
 */

import { Client } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

async function clearDeathLock(playerId: string) {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not set in environment");
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("Connected to database");

    // Delete death lock
    const result = await client.query(
      "DELETE FROM player_deaths WHERE player_id = $1 RETURNING *",
      [playerId],
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`✓ Cleared death lock for player: ${playerId}`);
      console.log("Death lock data:", result.rows[0]);
    } else {
      console.log(`No death lock found for player: ${playerId}`);
    }
  } catch (error) {
    console.error("Error clearing death lock:", error);
  } finally {
    await client.end();
  }
}

// Get player ID from command line
const playerId = process.argv[2];

if (!playerId) {
  console.error("Usage: tsx clear-death-lock.ts <player_id>");
  console.error("Example: tsx clear-death-lock.ts player_123");
  process.exit(1);
}

clearDeathLock(playerId);
