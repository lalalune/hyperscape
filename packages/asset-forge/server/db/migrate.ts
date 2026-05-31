/**
 * Database Migration Runner
 * Runs pending migrations against the database
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

function getDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.ASSET_FORGE_POSTGRES_HOST;
  const password = process.env.ASSET_FORGE_POSTGRES_PASSWORD;

  if (!host || !password) {
    return undefined;
  }

  const user = process.env.ASSET_FORGE_POSTGRES_USER || "assetforge";
  const port = process.env.ASSET_FORGE_POSTGRES_PORT || "5432";
  const database = process.env.ASSET_FORGE_POSTGRES_DB || "assetforge";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const databaseUrl = getDatabaseUrl();

// Validate environment
if (!databaseUrl) {
  console.error(
    "ERROR: DATABASE_URL or ASSET_FORGE_POSTGRES_* environment variables are required",
  );
  process.exit(1);
}

// Migration connection
const migrationClient = postgres(databaseUrl, { max: 1 });
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
