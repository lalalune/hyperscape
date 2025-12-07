/**
 * Admin Panel Database Client
 * 
 * Uses Drizzle ORM to connect to the same PostgreSQL database as the game server.
 * The schema is imported directly from the server package for consistency.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Import schema from server package (will need to be built or shared)
// For now, we'll define inline schema types or import when available
import * as schema from './schema';

let pool: Pool | undefined;
let db: ReturnType<typeof drizzle> | undefined;

/**
 * Get or create database connection
 * Uses singleton pattern to reuse connections
 */
export function getDatabase() {
  if (db) return db;
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is required.\n' +
      'Set it in packages/admin-panel/.env.local or as an environment variable.'
    );
  }
  
  pool = new Pool({
    connectionString,
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  
  db = drizzle(pool, { schema });
  
  return db;
}

/**
 * Close database connection
 * Call during graceful shutdown
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;
