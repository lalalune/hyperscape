/**
 * Database Connection
 * PostgreSQL connection using Bun-optimized postgres library and Drizzle ORM
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "./schema";

// Use DATABASE_URL from environment or default to local dev database
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://hyperscape:hyperscape_dev@localhost:5432/asset_forge_dev";

// Create postgres client (optimized for Bun)
// Using connection pool with sensible defaults
export const queryClient = postgres(DATABASE_URL, {
  max: 20, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Fail after 10 seconds if can't connect
  prepare: false, // Disable prepared statements for better compatibility
});

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Test connection
queryClient`SELECT NOW()`
  .then((result) => {
    console.log("[Database] ✓ Connected to PostgreSQL at", result[0].now);
  })
  .catch((error) => {
    console.error("[Database] ✗ Connection failed:", error.message);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Database] Closing connection...");
  await queryClient.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Database] Closing connection...");
  await queryClient.end();
  process.exit(0);
});
