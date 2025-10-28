#!/usr/bin/env node

/**
 * Database Schema Initialization Script
 * Initializes the database schema on first deployment
 * Idempotent - safe to run multiple times
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Database connection - use Railway environment variable
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.log('⚠️  DATABASE_URL not set, skipping schema initialization')
  console.log('   This is normal for local development (use docker-compose)')
  process.exit(0)
}

async function initializeSchema() {
  console.log('🔧 Initializing database schema...')
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`)

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    // Check if schema already initialized (check for users table)
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `)

    if (checkResult.rows[0].exists) {
      console.log('✅ Schema already initialized (users table exists)')
      console.log('   Skipping schema.sql execution')
      return
    }

    console.log('📄 Schema not found, initializing from schema.sql...')

    // Read and execute schema
    const schemaPath = join(__dirname, '../../database/schema.sql')
    const schema = readFileSync(schemaPath, 'utf8')

    console.log('📄 Executing schema.sql...')
    await client.query(schema)
    console.log('✅ Schema initialized successfully')

    console.log('✅ Database initialization complete!')
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message)
    console.error('   Full error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

initializeSchema()
