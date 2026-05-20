/**
 * Database Client and Migration Manager
 *
 * This module handles PostgreSQL database initialization using Drizzle ORM.
 * It provides a singleton pattern for database connections to prevent connection pool exhaustion.
 *
 * **Key Features**:
 * - Singleton connection pool to prevent connection leaks
 * - Automatic migration runner that finds migrations in multiple possible locations
 * - Connection testing before returning database instance
 * - Graceful error handling for existing tables
 *
 * **Architecture**:
 * - Uses node-postgres (pg) for connection pooling
 * - Wraps pg with Drizzle ORM for type-safe queries
 * - Runs migrations from /src/database/migrations/ on startup
 * - Searches multiple paths to support both development and production builds
 *
 * **Migration System**:
 * The migration system searches for the `meta/_journal.json` file in these locations (in order):
 * 1. process.cwd()/src/database/migrations (development from server package)
 * 2. process.cwd()/packages/server/src/database/migrations (development from workspace root)
 * 3. __dirname/migrations (production build)
 * 4. __dirname/database/migrations (alternative build structure)
 * 5. __dirname/../src/database/migrations (alternative build structure)
 *
 * **Connection Pooling**:
 * - Max 20 connections per pool (min 2)
 * - 10 second idle timeout (aggressively reaps idle connections)
 * - 30 second connection timeout
 * - allowExitOnIdle: true (cleanup on hot reload)
 *
 * **Usage**:
 * ```typescript
 * const { db, pool } = await initializeDatabase(connectionString);
 * const users = await db.select().from(schema.users);
 * await pool.end(); // Cleanup on shutdown
 * ```
 *
 * **Referenced by**: index.ts (server startup), DatabaseSystem.ts (database operations)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const { Pool } = pg;

// Get directory path for migrations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Singleton instances - only one database connection per server process
 * This prevents connection pool exhaustion from multiple initialization attempts
 */
let dbInstance: ReturnType<typeof drizzle> | undefined;
let poolInstance: pg.Pool | undefined;

/**
 * Track connection errors for monitoring
 */
let connectionErrorCount = 0;

const REQUIRED_PUBLIC_TABLES = [
  "users",
  "characters",
  "player_sessions",
  "chunk_activity",
  "config",
] as const;

async function hasRequiredPublicTables(pool: pg.Pool): Promise<boolean> {
  const result = await pool.query<{
    table_name: string;
    exists: boolean;
  }>(
    `
      SELECT
        table_name,
        to_regclass('public.' || table_name) IS NOT NULL AS exists
      FROM unnest($1::text[]) AS table_name
    `,
    [REQUIRED_PUBLIC_TABLES],
  );

  return result.rows.every((row) => row.exists);
}

const MIGRATION_JOURNAL_TABLE_CANDIDATES = [
  "public.__drizzle_migrations",
  "__drizzle_migrations",
  "drizzle.__drizzle_migrations",
] as const;

function getMigrationErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Ensure additive columns exist when the live DB lags behind drizzle-kit migrate
 * (e.g. SKIP_MIGRATIONS, wrong DATABASE_URL for CLI migrate, or partial apply).
 * Matches migration 0053_add_agent_streaming_duel_enabled.sql.
 */
async function ensureAgentMappingsStreamingDuelColumn(
  pool: pg.Pool,
): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE "agent_mappings"
      ADD COLUMN IF NOT EXISTS "streaming_duel_enabled" boolean DEFAULT true NOT NULL;
    `);
    console.log("[DB] ✓ Ensured agent_mappings.streaming_duel_enabled");
  } catch (error) {
    console.warn(
      "[DB] Could not ensure agent_mappings.streaming_duel_enabled:",
      getMigrationErrorMessage(error),
    );
  }
}

function isMigrationExistingObjectError(error: unknown): boolean {
  const hasCode = Boolean(
    error &&
    typeof error === "object" &&
    "cause" in error &&
    error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause,
  );
  const hasMessage = Boolean(
    error && typeof error === "object" && "message" in error,
  );
  const errorWithCause = error as {
    cause?: { code?: string };
    message?: string;
  };
  return (
    (hasCode && errorWithCause.cause?.code === "42P07") || // Table already exists
    (hasCode && errorWithCause.cause?.code === "42701") || // Column already exists
    (hasCode && errorWithCause.cause?.code === "42710") || // Constraint already exists
    (hasMessage &&
      typeof errorWithCause.message === "string" &&
      errorWithCause.message.includes("already exists"))
  );
}

async function clearMigrationJournal(pool: pg.Pool): Promise<boolean> {
  let clearedAny = false;
  for (const tableName of MIGRATION_JOURNAL_TABLE_CANDIDATES) {
    const existsResult = await pool.query<{ exists: boolean }>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [tableName],
    );
    if (existsResult.rows[0]?.exists) {
      await pool.query(`DELETE FROM ${tableName}`);
      console.log(`[DB] Cleared migration journal entries from ${tableName}`);
      clearedAny = true;
    }
  }
  return clearedAny;
}

function resolveMigrationsFolder(): string {
  const possiblePaths = [
    // Development: from server package root
    path.join(process.cwd(), "src/database/migrations"),
    // Development: from workspace root
    path.join(process.cwd(), "packages/server/src/database/migrations"),
    path.join(__dirname, "migrations"),
    path.join(__dirname, "database/migrations"),
    path.join(__dirname, "../src/database/migrations"),
  ];

  for (const testPath of possiblePaths) {
    const journalPath = path.join(testPath, "meta/_journal.json");
    if (fs.existsSync(journalPath)) {
      console.log(`[DB] ✓ Found migrations folder: ${testPath}`);
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      console.log(
        `[DB] Journal has ${journal.entries?.length || 0} migrations`,
      );
      return testPath;
    }
  }

  throw new Error(
    `Could not find migrations folder. Searched:\n${possiblePaths.map((p) => `  - ${p}`).join("\n")}\n` +
      `Current working directory: ${process.cwd()}\n` +
      `__dirname: ${__dirname}`,
  );
}

/**
 * Detect if connection string is for a serverless/managed database
 * These require special handling for connection management:
 * - Lower max connections (managed DBs have strict limits)
 * - Shorter idle timeouts
 * - Keepalive enabled
 */
function isServerlessDatabase(connectionString: string): boolean {
  return (
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler") ||
    connectionString.includes("-pooler.") ||
    connectionString.includes(".rlwy.net") || // Railway proxy
    connectionString.includes(".railway.app") || // Railway direct
    connectionString.includes(".railway.internal") || // Railway internal
    process.env.RAILWAY_ENVIRONMENT !== undefined // Railway environment variable
  );
}

/** Detect if using a connection pooler that doesn't support prepared statements */
function isSupavisorPooler(connectionString: string): boolean {
  // Railway proxy uses pgbouncer - detect via env var or URL patterns
  const isRailwayProxy =
    process.env.RAILWAY_ENVIRONMENT !== undefined ||
    connectionString.includes(".proxy.rlwy.net") ||
    connectionString.includes(".railway.internal");

  return (
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("pgbouncer=true") ||
    isRailwayProxy
  );
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Phase 4.5 — operational tuning constants. All overridable via
 * environment variables so deployment-specific behavior doesn't
 * require code changes.
 *
 *   POSTGRES_POOL_MAX / DB_POOL_MAX
 *     Max concurrent connections per pool. Default depends on
 *     detected DB type:
 *       - Standard PG:  30
 *       - Serverless:   15 (Neon, Supabase, Railway)
 *       - Supavisor:     6 (pooler, tighter limit)
 *   POSTGRES_POOL_MIN / DB_POOL_MIN
 *     Min idle connections kept warm. Default 2 (standard) or 1
 *     (serverless to avoid keep-alive overhead).
 *   POSTGRES_STATEMENT_TIEOUT_MS
 *     Per-query statement timeout. Default 30s — query-level
 *     timeout aborts any single query that hangs longer (e.g.
 *     missing index causing seq scan over millions of rows).
 *   POSTGRES_SLOW_QUERY_MS
 *     Threshold for slow-query logging. Queries running longer
 *     than this are logged with their text + duration. Default
 *     1000ms (1s); set higher in dev to silence ad-hoc queries.
 */
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;
const DEFAULT_SLOW_QUERY_MS = 1_000;

function getStatementTimeoutMs(): number {
  return (
    parseOptionalInt(process.env.POSTGRES_STATEMENT_TIMEOUT_MS) ??
    DEFAULT_STATEMENT_TIMEOUT_MS
  );
}

function getSlowQueryThresholdMs(): number {
  return (
    parseOptionalInt(process.env.POSTGRES_SLOW_QUERY_MS) ??
    DEFAULT_SLOW_QUERY_MS
  );
}

/**
 * Wrap pool.query to log queries exceeding the slow-query
 * threshold. Returns the original pool unchanged structurally;
 * just intercepts the `.query` method.
 *
 * Slow-query logging is operator-visible only — every entry has
 * `[DB:slow]` prefix and includes the duration + truncated SQL.
 * Helps identify hot-path issues (N+1, missing indexes) without
 * needing always-on EXPLAIN ANALYZE.
 */
function installSlowQueryLogger(pool: pg.Pool, thresholdMs: number): void {
  const originalQuery = pool.query.bind(pool);
  // Cast to `any` so we can preserve all overload signatures —
  // pg.Pool.query has 7+ overloads and TypeScript can't redeclare
  // them all cleanly. The runtime behavior is unchanged.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as unknown as { query: any }).query = function wrappedQuery(
    this: pg.Pool,
    ...args: unknown[]
  ): unknown {
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (originalQuery as any).apply(this, args);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      return (result as Promise<unknown>).finally(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= thresholdMs) {
          const sql =
            typeof args[0] === "string"
              ? args[0]
              : ((args[0] as { text?: string })?.text ?? "<unknown>");
          const truncated = sql.length > 200 ? `${sql.slice(0, 200)}…` : sql;
          console.warn(
            `[DB:slow] ${elapsed}ms — ${truncated.replace(/\s+/g, " ")}`,
          );
        }
      });
    }
    return result;
  };
}

/**
 * Initialize the database and run migrations
 *
 * This is the main entry point for database setup. It creates a connection pool,
 * initializes Drizzle ORM, and runs all pending migrations.
 *
 * **Hot Reload Safety**: Automatically closes any stale connection pools from previous
 * dev server instances before creating a new one. This prevents connection exhaustion
 * during development.
 *
 * @param connectionString - PostgreSQL connection URL (postgresql://user:pass@host:port/database)
 * @returns Object with db (Drizzle instance) and pool (pg.Pool) for direct access
 * @throws Error if connection fails or migrations encounter unexpected errors
 */
export async function initializeDatabase(connectionString: string) {
  // Force cleanup of stale connections on hot reload
  if (poolInstance) {
    await poolInstance.end().catch((err) => {
      console.warn("[DB] Error ending stale pool:", err);
    });
    poolInstance = undefined;
    dbInstance = undefined;
  }

  // Return cached instance if already initialized (singleton pattern)
  if (dbInstance) {
    return { db: dbInstance, pool: poolInstance! };
  }

  // Detect SSL requirement from connection string or RDS hostname
  const needsSSL =
    connectionString.includes("sslmode=") ||
    connectionString.includes(".rds.amazonaws.com") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co");

  // Detect serverless database for special connection handling
  const isServerless = isServerlessDatabase(connectionString);

  // Detect Supavisor pooler (needs prepare: false for Drizzle ORM)
  const useSupavisor = isSupavisorPooler(connectionString);

  // Configure pool based on database type
  // Serverless databases (Neon, Supabase) need:
  // - Shorter idle timeouts (they aggressively close idle connections)
  // - Keepalive to prevent unexpected disconnects
  // - Lower max connections (serverless pools are limited)
  // Supavisor pooler needs even lower max connections
  const defaultMax = useSupavisor ? 6 : isServerless ? 15 : 30;
  const defaultMin = isServerless ? 1 : 2;
  const envMax = parseOptionalInt(
    process.env.POSTGRES_POOL_MAX || process.env.DB_POOL_MAX,
  );
  const envMin = parseOptionalInt(
    process.env.POSTGRES_POOL_MIN || process.env.DB_POOL_MIN,
  );
  const poolMax = envMax && envMax > 0 ? envMax : defaultMax;
  const poolMinCandidate =
    envMin !== undefined && envMin >= 0 ? envMin : defaultMin;
  const poolMin = Math.min(poolMinCandidate, poolMax);

  const statementTimeoutMs = getStatementTimeoutMs();
  const slowQueryThresholdMs = getSlowQueryThresholdMs();

  // Phase 4.5 — statement_timeout aborts queries hanging beyond
  // the threshold. Set as a -c flag on the connection options so
  // every session in the pool inherits it. Serverless skip the
  // options line (Neon pooler rejects search_path as startup
  // params; we keep `options` undefined for them and forgo
  // statement_timeout at the connection level — those deployments
  // typically configure it server-side).
  const connectionOptions = isServerless
    ? undefined
    : `-c search_path=public -c statement_timeout=${statementTimeoutMs}`;

  const poolConfig: pg.PoolConfig = {
    connectionString,
    // Keep these configurable so local environments with low max_connections
    // don't fail during heavy startup bursts.
    max: poolMax,
    min: poolMin,
    // Serverless DBs close idle connections quickly, so use shorter timeout
    idleTimeoutMillis: isServerless ? 20000 : 30000,
    connectionTimeoutMillis: 60000,
    allowExitOnIdle: true,
    // Enable SSL for cloud databases
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
    // Keep all unqualified tables in public, never in drizzle or role schemas.
    // Combined with statement_timeout for non-serverless deployments
    // (Neon pooled connections reject startup parameters).
    options: connectionOptions,
    // TCP keepalive settings to detect dead connections faster
    keepAlive: true,
    keepAliveInitialDelayMillis: isServerless ? 10000 : 30000,
  };

  console.log(
    `[DB] Initializing ${isServerless ? "serverless" : "standard"} PostgreSQL pool (max: ${poolConfig.max}, keepAlive: ${poolConfig.keepAlive}, statementTimeout: ${statementTimeoutMs}ms, slowQuery: ${slowQueryThresholdMs}ms)`,
  );

  const pool = new Pool(poolConfig);
  installSlowQueryLogger(pool, slowQueryThresholdMs);

  // Add pool error handlers for connection issues
  pool.on("error", (err) => {
    connectionErrorCount++;
    console.error(
      `[DB] Pool connection error (count: ${connectionErrorCount}):`,
      err.message,
    );
    // Don't throw - let the pool try to recover by acquiring new connections
  });

  pool.on("connect", () => {
    // Reset error count on successful connection
    if (connectionErrorCount > 0) {
      console.log(
        `[DB] Pool connection restored after ${connectionErrorCount} errors`,
      );
      connectionErrorCount = 0;
    }
  });

  // Test connection with retry
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT NOW()");
      client.release();
      console.log("[DB] ✓ Connection test successful");
      break;
    } catch (error) {
      console.error(
        `[DB] ❌ Connection attempt ${attempt}/${maxRetries} failed:`,
        error instanceof Error ? error.message : error,
      );
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 500),
      );
    }
  }

  // Create Drizzle instance
  // Supavisor (Supabase connection pooler) doesn't support prepared statements,
  // so we disable them via { prepare: false } to avoid XX000 errors.
  if (useSupavisor) {
    console.log(
      "[DB] Supavisor pooler detected — disabling prepared statements",
    );
  }
  const db = drizzle(pool, {
    schema,
    ...(useSupavisor ? { prepare: false } : {}),
  });

  const migrationsFolder = resolveMigrationsFolder();

  // Run migrations (skip if SKIP_MIGRATIONS is set, e.g. when drizzle-kit push handles schema)
  if (process.env.SKIP_MIGRATIONS === "true") {
    console.log("[DB] Skipping migrations (SKIP_MIGRATIONS=true)");
  } else {
    try {
      console.log("[DB] Running migrations...");
      await migrate(db, { migrationsFolder });
      console.log("[DB] ✓ Migrations complete");
    } catch (error) {
      if (isMigrationExistingObjectError(error)) {
        console.log(
          "[DB] ⚠️  Migration reported existing objects; validating required tables",
        );
        console.log(
          "[DB] Migration error details:",
          getMigrationErrorMessage(error),
        );
      } else {
        console.error("[DB] ❌ Migration failed:", error);
        throw error;
      }
    }
  }

  if (process.env.SKIP_MIGRATIONS !== "true") {
    let hasAllRequiredTables = await hasRequiredPublicTables(pool);
    if (!hasAllRequiredTables) {
      console.warn(
        "[DB] Required public tables are missing after migration. Attempting recovery by resetting migration journal and rerunning migrations.",
      );

      const clearedJournal = await clearMigrationJournal(pool);
      if (!clearedJournal) {
        console.warn(
          "[DB] No drizzle migration journal table found to clear; rerunning migrations anyway.",
        );
      }

      try {
        await migrate(db, { migrationsFolder });
        console.log("[DB] ✓ Recovery migration pass complete");
      } catch (recoveryError) {
        if (isMigrationExistingObjectError(recoveryError)) {
          console.log(
            "[DB] Recovery migration pass encountered existing objects; validating table state",
          );
        } else {
          console.error("[DB] ❌ Recovery migration failed:", recoveryError);
          throw recoveryError;
        }
      }

      hasAllRequiredTables = await hasRequiredPublicTables(pool);
      if (!hasAllRequiredTables) {
        throw new Error(
          "[DB] Required public tables are still missing after migration recovery. " +
            "Database is in a partial state; recreate the database or run migrations on a clean schema.",
        );
      }

      console.log("[DB] ✓ Required public tables verified after recovery");
    }
  }

  await ensureAgentMappingsStreamingDuelColumn(pool);

  dbInstance = db;
  poolInstance = pool;

  return { db, pool };
}

/**
 * Get the cached Drizzle database instance
 *
 * Use this to access the database from anywhere in the application after initialization.
 * Throws an error if called before initializeDatabase().
 *
 * @returns The Drizzle database instance
 * @throws Error if database hasn't been initialized yet
 */
export function getDatabase() {
  if (!dbInstance) {
    throw new Error(
      "[DB] Database not initialized. Call initializeDatabase() first.",
    );
  }
  return dbInstance;
}

/**
 * Get the cached PostgreSQL connection pool
 *
 * Use this for low-level database operations that need direct pool access.
 * Most operations should use the Drizzle instance from getDatabase() instead.
 *
 * @returns The PostgreSQL connection pool
 * @throws Error if pool hasn't been initialized yet
 */
export function getPool() {
  if (!poolInstance) {
    throw new Error(
      "[DB] Pool not initialized. Call initializeDatabase() first.",
    );
  }
  return poolInstance;
}

/**
 * Close the database connection and clean up resources
 *
 * This should be called during graceful server shutdown to:
 * - Close all active connections in the pool
 * - Release database resources
 * - Allow the process to exit cleanly
 *
 * After calling this, you must call initializeDatabase() again before using the database.
 * Called by the server shutdown handler in index.ts.
 */
export async function closeDatabase() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = undefined;
    dbInstance = undefined;
  }
}

/** TypeScript type for the Drizzle database instance with schema */
export type Database = ReturnType<typeof drizzle<typeof schema>>;
