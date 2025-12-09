/**
 * Database types for ElizaOS runtime database access
 */

/**
 * Database adapter interface for ElizaOS runtime
 * This represents the database adapter that may be attached to IAgentRuntime
 */
export interface DatabaseAdapter {
  db?: DatabaseConnection;
}

/**
 * Database connection interface
 * Supports both SQLite (better-sqlite3) and PostgreSQL (node-postgres) patterns
 */
export interface DatabaseConnection {
  run?: (sql: string, params?: unknown[]) => Promise<unknown>;
  query?: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  exec?: (sql: string) => Promise<unknown>;
  prepare?: (sql: string) => PreparedStatement;
  [key: string]: unknown;
}

/**
 * Prepared statement interface
 */
export interface PreparedStatement {
  run: (params?: unknown[]) => Promise<unknown>;
  get: (params?: unknown[]) => Promise<unknown>;
  all: (params?: unknown[]) => Promise<unknown[]>;
}

/**
 * Extended IAgentRuntime with database access
 */
export interface IAgentRuntimeWithDatabase {
  databaseAdapter?: DatabaseAdapter;
  db?: DatabaseConnection;
}
