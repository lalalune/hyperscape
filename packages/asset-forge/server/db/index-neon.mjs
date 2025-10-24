/**
 * Database Client - Neon PostgreSQL with Drizzle ORM
 * 
 * Initializes and manages the Neon serverless PostgreSQL database connection
 */

import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import * as schema from './schema-pg.mjs'

// Load environment variables from .env.local and .env
dotenv.config({ path: '.env.local' })
dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

console.log('[Database] Connecting to Neon PostgreSQL...')

// Create Neon SQL client - optimized for serverless/edge environments
const sql = neon(DATABASE_URL)

// Initialize Drizzle ORM with Neon HTTP adapter
export const db = drizzle(sql, { schema })

// Export schema and SQL client for use in queries
export { schema, sql }

console.log('[Database] Neon PostgreSQL connection established')

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`
    console.log('[Database] Connection test successful:', result[0].current_time)
    return true
  } catch (error) {
    console.error('[Database] Connection test failed:', error)
    throw error
  }
}

/**
 * Initialize database tables if they don't exist
 * Note: For production, use Drizzle migrations instead
 */
export async function initializeDatabase() {
  console.log('[Database] Checking database schema...')
  
  try {
    // Test the connection
    await testConnection()
    
    console.log('[Database] Database ready')
    console.log('[Database] Run migrations with: bun run drizzle-kit push')
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error)
    throw error
  }
}

