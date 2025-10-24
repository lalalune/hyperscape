/**
 * Database Connection and Query Client
 *
 * Provides PostgreSQL connection with pgvector support
 * Uses Drizzle ORM for type-safe queries
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { createLogger } from '../utils/logger.mjs'
import * as schema from './schema.mjs'

const logger = createLogger('Database')

const { Pool } = pg

/**
 * Database configuration
 */
const config = {
  // Use pooled connection by default (via PgBouncer)
  connectionString: process.env.DATABASE_URL,

  // Direct connection for migrations and vector operations
  directConnectionString: process.env.DATABASE_URL_DIRECT,

  // Pool configuration
  max: 20, // maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // SSL configuration for Fly.io
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
}

/**
 * Create connection pool
 */
let pool = null
let db = null

export function getPool() {
  if (!pool) {
    if (!config.connectionString) {
      logger.warn('DATABASE_URL not set - database features disabled')
      return null
    }

    pool = new Pool({
      connectionString: config.connectionString,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      ssl: config.ssl
    })

    // Handle pool errors
    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle client', { error: err.message })
    })

    logger.info('Database pool created', {
      max: config.max,
      ssl: !!config.ssl,
      mode: 'pooled'
    })
  }

  return pool
}

/**
 * Get Drizzle ORM instance
 */
export function getDb() {
  if (!db) {
    const poolInstance = getPool()
    if (!poolInstance) {
      return null
    }

    db = drizzle(poolInstance, { schema })
    logger.info('Drizzle ORM initialized')
  }

  return db
}

/**
 * Create direct connection (for migrations and admin tasks)
 */
export function getDirectPool() {
  if (!config.directConnectionString) {
    logger.warn('DATABASE_URL_DIRECT not set - using pooled connection')
    return getPool()
  }

  const directPool = new Pool({
    connectionString: config.directConnectionString,
    max: 1, // Direct connections should be limited
    ssl: config.ssl
  })

  logger.info('Direct database connection created')
  return directPool
}

/**
 * Initialize database (create pgvector extension)
 */
export async function initializeDatabase() {
  const poolInstance = getDirectPool()
  if (!poolInstance) {
    logger.warn('Database not available - skipping initialization')
    return false
  }

  let client
  try {
    client = await poolInstance.connect()

    logger.info('Initializing database...')

    // Create pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector')
    logger.info('pgvector extension enabled')

    // Check extension version
    const result = await client.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
    )

    if (result.rows.length > 0) {
      logger.info('pgvector version:', { version: result.rows[0].extversion })
    }

    return true
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message })
    return false
  } finally {
    if (client) {
      client.release()
    }
  }
}

/**
 * Test database connection
 */
export async function testConnection() {
  const poolInstance = getPool()
  if (!poolInstance) {
    return false
  }

  let client
  try {
    client = await poolInstance.connect()
    const result = await client.query('SELECT NOW()')

    logger.info('Database connection successful', {
      timestamp: result.rows[0].now
    })

    return true
  } catch (error) {
    logger.error('Database connection failed', { error: error.message })
    return false
  } finally {
    if (client) {
      client.release()
    }
  }
}

/**
 * Close all database connections
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end()
    logger.info('Database pool closed')
    pool = null
    db = null
  }
}

/**
 * Execute raw SQL query (use sparingly)
 */
export async function executeQuery(query, params = []) {
  const poolInstance = getPool()
  if (!poolInstance) {
    throw new Error('Database not available')
  }

  const client = await poolInstance.connect()
  try {
    const result = await client.query(query, params)
    return result
  } finally {
    client.release()
  }
}

// Export schema for use in queries
export { schema }

// Singleton database instance
export const database = {
  get pool() {
    return getPool()
  },
  get db() {
    return getDb()
  },
  get directPool() {
    return getDirectPool()
  },
  initialize: initializeDatabase,
  test: testConnection,
  close: closeDatabase,
  query: executeQuery
}

export default database
