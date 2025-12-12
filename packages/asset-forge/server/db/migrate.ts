/**
 * Database Migration Runner
 * Runs pending migrations against the database
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Validate environment
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

// Migration connection
const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(migrationClient);

// Run migrations
async function main() {
  console.log("[Migrations] Running migrations...");

  try {
    await migrate(db, { migrationsFolder: "./server/db/migrations" });
    console.log("[Migrations] ✓ Migrations completed successfully");
  } catch (error) {
    console.error("[Migrations] ✗ Migration failed:", error);
    process.exit(1);
  }

  await migrationClient.end();
  process.exit(0);
}

main();
