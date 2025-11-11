/**
 * Database Module - PostgreSQL initialization and connection management
 *
 * Handles database setup including Docker PostgreSQL management, Drizzle ORM
 * initialization, connection pooling, and migration execution.
 *
 * Responsibilities:
 * - Start/check Docker PostgreSQL container (if configured)
 * - Initialize Drizzle database client
 * - Run database migrations
 * - Create database adapters for legacy systems
 * - Export connection pool for cleanup
 *
 * Usage:
 * ```typescript
 * const dbContext = await initializeDatabase(config);
 * world.pgPool = dbContext.pgPool;
 * world.drizzleDb = dbContext.drizzleDb;
 * ```
 */

import type pg from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  createDefaultDockerManager,
  type DockerManager,
} from "../docker-manager.js";
import type { ServerConfig } from "./config.js";
import type * as schema from "../db/schema.js";

/**
 * Database context returned by initialization
 * Contains all database-related instances needed by the server
 */
export interface DatabaseContext {
  /** PostgreSQL connection pool */
  pgPool: pg.Pool;

  /** Drizzle database client (typed with schema) */
  drizzleDb: NodePgDatabase<typeof schema>;

  /** Legacy database adapter for old systems */
  db: unknown; // DrizzleAdapter type from drizzle-adapter.ts

  /** Docker manager instance (if Docker is used) */
  dockerManager?: DockerManager;
}

/**
 * Initialize database with Docker and Drizzle
 *
 * This function handles the complete database initialization sequence:
 * 1. Check if Docker PostgreSQL should be used
 * 2. Start Docker PostgreSQL if needed (and not already running)
 * 3. Get connection string (from Docker or env)
 * 4. Initialize Drizzle client and connection pool
 * 5. Run migrations
 * 6. Create legacy adapter for compatibility
 *
 * @param config - Server configuration from config module
 * @returns Promise resolving to DatabaseContext with all DB instances
 * @throws Error if Docker fails to start or database connection fails
 */
export async function initializeDatabase(
  config: ServerConfig,
): Promise<DatabaseContext> {
  let dockerManager: DockerManager | undefined;
  let connectionString: string;

  // Initialize Docker and PostgreSQL (optional based on config)
  if (config.useLocalPostgres && !config.databaseUrl) {
    dockerManager = createDefaultDockerManager();
    await dockerManager.checkDockerRunning();

    const isPostgresRunning = await dockerManager.checkPostgresRunning();
    if (!isPostgresRunning) {
      console.log("[Database] Starting Docker PostgreSQL...");
      await dockerManager.startPostgres();
      console.log("[Database] ✅ PostgreSQL started");
    } else {
      console.log("[Database] ✅ PostgreSQL already running");
    }

    connectionString = await dockerManager.getConnectionString();
  } else if (config.databaseUrl) {
    console.log("[Database] Using explicit DATABASE_URL");
    connectionString = config.databaseUrl;
  } else {
    throw new Error(
      "[Database] No database configuration: set DATABASE_URL or USE_LOCAL_POSTGRES=true",
    );
  }

  // Initialize Drizzle database
  console.log("[Database] Initializing Drizzle ORM...");
  const { initializeDatabase: initDrizzle } = await import("../db/client.js");
  const { db: drizzleDb, pool: pgPool } = await initDrizzle(connectionString);
  console.log("[Database] ✅ Drizzle ORM initialized");

  // Create adapter for systems that need the old database interface
  console.log("[Database] Creating legacy adapter...");
  const { createDrizzleAdapter } = await import("../db/drizzle-adapter.js");
  const db = createDrizzleAdapter(drizzleDb as NodePgDatabase<typeof schema>);
  console.log("[Database] ✅ Legacy adapter created");

  return {
    pgPool,
    drizzleDb: drizzleDb as NodePgDatabase<typeof schema>,
    db,
    dockerManager,
  };
}

/**
 * Close database connections and cleanup
 *
 * Closes the PostgreSQL connection pool and clears singleton instances.
 * Should be called during graceful shutdown.
 *
 * @returns Promise that resolves when cleanup is complete
 */
export async function closeDatabase(): Promise<void> {
  console.log("[Database] Closing database connections...");
  const { closeDatabase: closeDatabaseUtil } = await import("../db/client.js");
  await closeDatabaseUtil();
  console.log("[Database] ✅ Database connections closed");
}
