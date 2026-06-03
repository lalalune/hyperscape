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
} from "../infrastructure/docker/docker-manager.js";
import type { ServerConfig } from "./config.js";
import type * as schema from "../database/schema.js";

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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function buildPostgresConnectionString(opts: {
  user: string;
  password?: string;
  host: string;
  port: number;
  database: string;
}): string {
  const encodedUser = encodeURIComponent(opts.user);
  const encodedPassword =
    opts.password && opts.password.length > 0
      ? `:${encodeURIComponent(opts.password)}`
      : "";
  return `postgresql://${encodedUser}${encodedPassword}@${opts.host}:${opts.port}/${opts.database}`;
}

/**
 * Development fallback when Docker isn't available:
 * connect to a local PostgreSQL service (e.g. Homebrew), create DB if needed,
 * then return a usable connection string for normal Drizzle initialization.
 */
async function tryLocalPostgresFallback(
  config: ServerConfig,
): Promise<string | null> {
  // Only allow automatic local fallback outside production.
  if (config.nodeEnv === "production") return null;

  const host = process.env.LOCAL_POSTGRES_HOST || "localhost";
  const port = parseInt(process.env.LOCAL_POSTGRES_PORT || "5432", 10);
  const user =
    process.env.LOCAL_POSTGRES_USER || process.env.USER || "postgres";
  const password = process.env.LOCAL_POSTGRES_PASSWORD || "";
  const adminDatabase = process.env.LOCAL_POSTGRES_ADMIN_DB || "postgres";
  const targetDatabase = process.env.POSTGRES_DB || "hyperia";

  const adminConnectionString = buildPostgresConnectionString({
    user,
    password,
    host,
    port,
    database: adminDatabase,
  });
  const targetConnectionString = buildPostgresConnectionString({
    user,
    password,
    host,
    port,
    database: targetDatabase,
  });

  let pool: pg.Pool | undefined;
  try {
    const { default: pgModule } = await import("pg");
    pool = new pgModule.Pool({
      connectionString: adminConnectionString,
      max: 1,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    try {
      await client.query("SELECT 1");

      if (targetDatabase !== adminDatabase) {
        const exists = await client.query(
          "SELECT 1 FROM pg_database WHERE datname = $1 LIMIT 1",
          [targetDatabase],
        );
        if (exists.rowCount === 0) {
          const safeDbName = `"${targetDatabase.replace(/"/g, '""')}"`;
          await client.query(`CREATE DATABASE ${safeDbName}`);
        }
      }
    } finally {
      client.release();
    }
    return targetConnectionString;
  } catch (error) {
    console.warn(
      "[Database] Local PostgreSQL fallback failed:",
      getErrorMessage(error),
    );
    return null;
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
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
    try {
      dockerManager = createDefaultDockerManager();
      await dockerManager.checkDockerRunning();

      const isPostgresRunning = await dockerManager.checkPostgresRunning();
      if (!isPostgresRunning) {
        await dockerManager.startPostgres();
      }

      connectionString = await dockerManager.getConnectionString();
    } catch (dockerError) {
      console.warn(
        "[Database] Docker PostgreSQL unavailable:",
        getErrorMessage(dockerError),
      );

      const fallbackConnectionString = await tryLocalPostgresFallback(config);
      if (!fallbackConnectionString) {
        throw new Error(
          `[Database] Failed to initialize database: Docker/local PostgreSQL initialization failed. ` +
            `Start Docker Desktop, start local PostgreSQL for fallback, or set DATABASE_URL to a reachable PostgreSQL instance. ` +
            `If you use a pre-existing Docker container with non-default credentials, set POSTGRES_PASSWORD to match.`,
        );
      }

      // Docker is not being used in fallback mode.
      dockerManager = undefined;
      connectionString = fallbackConnectionString;
    }
  } else if (config.databaseUrl) {
    connectionString = config.databaseUrl;
  } else {
    throw new Error(
      "[Database] No database configuration: set DATABASE_URL or USE_LOCAL_POSTGRES=true",
    );
  }

  // Initialize Drizzle database
  const { initializeDatabase: initDrizzle } =
    await import("../database/client.js");
  const { db: drizzleDb, pool: pgPool } = await initDrizzle(connectionString);

  // Create adapter for systems that need the old database interface
  const { createDrizzleAdapter } = await import("../database/adapter.js");
  const db = createDrizzleAdapter(drizzleDb as NodePgDatabase<typeof schema>);

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
  const { closeDatabase: closeDatabaseUtil } =
    await import("../database/client.js");
  await closeDatabaseUtil();
}
