/**
 * BaseRepository - Foundation for all database repositories
 *
 * Provides shared database access and common functionality for all repositories.
 * Each repository extends this class to access the Drizzle database instance
 * and PostgreSQL pool.
 *
 * Architecture:
 * - Repositories are instantiated with database connections
 * - They provide domain-specific database operations
 * - DatabaseSystem acts as a facade, delegating to repositories
 *
 * Usage:
 * ```typescript
 * class PlayerRepository extends BaseRepository {
 *   async getPlayer(id: string) {
 *     return this.db.select()...
 *   }
 * }
 * ```
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import type * as schema from "../schema";

/**
 * BaseRepository class
 *
 * All repositories extend this class to access database connections.
 * Provides protected access to Drizzle ORM and PostgreSQL pool.
 */
export abstract class BaseRepository {
  /**
   * Drizzle database instance for type-safe queries
   * @protected
   */
  protected readonly db: NodePgDatabase<typeof schema>;

  /**
   * PostgreSQL connection pool for low-level operations
   * @protected
   */
  protected readonly pool: pg.Pool;

  /**
   * Flag to indicate shutdown is in progress
   * Repositories should skip operations during shutdown to avoid errors
   * @protected
   */
  protected isDestroying: boolean = false;

  /**
   * Constructor
   *
   * @param db - Drizzle database instance
   * @param pool - PostgreSQL connection pool
   */
  constructor(db: NodePgDatabase<typeof schema>, pool: pg.Pool) {
    this.db = db;
    this.pool = pool;
  }

  /**
   * Mark repository as shutting down
   * Called during graceful shutdown to prevent new operations
   */
  markDestroying(): void {
    this.isDestroying = true;
  }

  /**
   * Check if database is available
   * @protected
   */
  protected ensureDatabase(): void {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
  }
}
