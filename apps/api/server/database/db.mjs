/**
 * Database Connection Pool
 * PostgreSQL connection management for Asset Forge API
 */

import pkg from 'pg'
const { Pool } = pkg

// Database configuration from environment
// Support both DATABASE_URL (Railway) and individual env vars (local dev)
const dbConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum pool size
      min: 2, // Minimum pool size (keep connections warm)
      idleTimeoutMillis: 60000, // 60 seconds before closing idle connection
      connectionTimeoutMillis: 10000, // 10 seconds to establish connection
      allowExitOnIdle: false, // Don't exit if all connections idle
      // Railway IPv6 private networking optimization
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10s
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      database: process.env.DB_NAME || 'asset_forge',
      user: process.env.DB_USER || 'asset_forge',
      password: process.env.DB_PASSWORD || 'asset_forge_dev_password_2024',
      max: 20,
      min: 2,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }

// Create connection pool
export const pool = new Pool(dbConfig)

// Handle pool errors (Railway IPv6 networking can cause intermittent disconnects)
pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client:', err.message)

  // Connection terminated errors are expected with Railway's private networking
  // The pool will automatically reconnect on the next query
  if (err.message.includes('Connection terminated')) {
    console.log('[Database] Connection will be reestablished on next query')
  }
})

// Handle pool connection events for monitoring
pool.on('connect', () => {
  console.log('[Database] New client connected to pool')
})

pool.on('remove', () => {
  console.log('[Database] Client removed from pool')
})

// Test connection with retry logic
async function testConnection(retries = 5, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query('SELECT NOW()')
      console.log(`[Database] ✅ Connected successfully at ${res.rows[0].now}`)
      return true
    } catch (err) {
      console.warn(`[Database] Connection attempt ${attempt}/${retries} failed: ${err.message}`)

      if (attempt === retries) {
        console.error('[Database] ❌ All connection attempts failed. Server will continue but database operations will fail.')
        return false
      }

      const waitTime = delay * Math.pow(2, attempt - 1) // Exponential backoff
      console.log(`[Database] Retrying in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  return false
}

// Start connection test (non-blocking)
testConnection().catch(err => {
  console.error('[Database] Connection test error:', err)
})

/**
 * Check database health
 * @returns {Promise<boolean>} True if database is healthy
 */
export async function healthCheck() {
  try {
    const result = await pool.query('SELECT 1 as healthy')
    return result.rows[0].healthy === 1
  } catch (error) {
    console.error('[Database] Health check failed:', error.message)
    return false
  }
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export async function query(text, params) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('[Database] Query executed', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('[Database] Query error:', { text, error: error.message })
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
export async function getClient() {
  const client = await pool.connect()
  const query = client.query
  const release = client.release

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('[Database] Client has been checked out for more than 5 seconds!')
    console.error(`[Database] Last query: ${client.lastQuery}`)
  }, 5000)

  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args
    return query.apply(client, args)
  }

  // Monkey patch the release method to clear the timeout
  client.release = () => {
    clearTimeout(timeout)
    client.query = query
    client.release = release
    return release.apply(client)
  }

  return client
}

/**
 * Execute a transaction
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise} Transaction result
 */
export async function transaction(callback) {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Graceful shutdown - handle all common shutdown signals
const gracefulShutdown = async (signal) => {
  console.log(`[Database] Received ${signal}, closing connection pool...`)
  try {
    await pool.end()
    console.log('[Database] Connection pool closed successfully')
    process.exit(0)
  } catch (error) {
    console.error('[Database] Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')) // nodemon restart signal

export default { pool, query, getClient, transaction, healthCheck }
