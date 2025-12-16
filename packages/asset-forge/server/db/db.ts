/**
 * Database Connection
 * PostgreSQL connection using Bun-optimized postgres library and Drizzle ORM
 * 
 * Note: Database is completely optional - server runs without it.
 * Database features are lazy-loaded and only connect when actually needed.
 * 
 * Set SKIP_DATABASE=true to disable database connection attempts entirely.
 */

import "dotenv/config";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { schema as schemaType } from "./schema";

// Check if database should be skipped
const SKIP_DATABASE = process.env.SKIP_DATABASE === "true";

// Use DATABASE_URL from environment or default to local dev database
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://hyperscape:hyperscape_dev@localhost:5432/asset_forge_dev";

// Track if database is available
let dbAvailable = false;
let dbInitialized = false;
let dbInstance: PostgresJsDatabase<typeof schemaType> | null = null;

// Log skip message immediately if skipped
if (SKIP_DATABASE) {
  console.log("[Database] ⏭️  Database connection skipped (SKIP_DATABASE=true)");
  dbInitialized = true;
}

/**
 * Initialize database connection lazily
 * Only called when getDb() is first used
 */
async function initializeDatabase(): Promise<void> {
  if (dbInitialized) return;
  dbInitialized = true;
  
  if (SKIP_DATABASE) {
    dbAvailable = false;
    return;
  }
  
  try {
    // Dynamic imports to avoid module load-time connection attempts
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { schema } = await import("./schema");
    
    // Create postgres client with error handling
    const queryClient = postgres(DATABASE_URL, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
      onnotice: () => {},
    });
    
    // Test connection
    try {
      const result = await queryClient`SELECT NOW()`;
      console.log("[Database] ✓ Connected to PostgreSQL at", result[0].now);
      dbAvailable = true;
      dbInstance = drizzle(queryClient, { schema });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Database] ✗ Connection failed:", errorMessage);
      console.warn("[Database] ⚠️  Server will continue without database. Some features may be unavailable.");
      console.warn("[Database] 💡 To skip database: Set SKIP_DATABASE=true in your environment");
      dbAvailable = false;
      // Close the failed connection
      await queryClient.end().catch(() => {});
    }
  } catch (error) {
    console.error("[Database] ✗ Failed to initialize database:", error);
    console.warn("[Database] ⚠️  Server will continue without database.");
    dbAvailable = false;
  }
}

// Export helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return dbAvailable;
}

/**
 * Get the database instance
 * Returns null if database is not available
 * Initializes connection on first call
 */
export async function getDb(): Promise<PostgresJsDatabase<typeof schemaType> | null> {
  if (!dbInitialized) {
    await initializeDatabase();
  }
  return dbInstance;
}

// Export a synchronous db reference that may be null
// For backwards compatibility - prefer using getDb() for new code
export const db: PostgresJsDatabase<typeof schemaType> | null = null;
