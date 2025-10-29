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
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      database: process.env.DB_NAME || 'asset_forge',
      user: process.env.DB_USER || 'asset_forge',
      password: process.env.DB_PASSWORD || 'asset_forge_dev_password_2024',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }

// Create connection pool
export const pool = new Pool(dbConfig)

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('[Database] Unexpected error on idle client', err)
})

// Test connection (non-blocking - don't prevent server startup)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.warn('[Database] Connection test failed (server will continue):', err.message)
  } else {
    console.log('[Database] Connected successfully at', res.rows[0].now)
  }
}).catch(err => {
  console.warn('[Database] Connection test failed (server will continue):', err.message)
})

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Database] Closing connection pool...')
  await pool.end()
  process.exit(0)
})

export default { pool, query, getClient, transaction }
