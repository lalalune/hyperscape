#!/usr/bin/env node

/**
 * Test Database Setup Script
 * Initializes the database schema for testing
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://hyperscape:hyperscape_test@localhost:5432/hyperscape_test';

async function setupTestDatabase() {
  console.log('🔧 Setting up test database...');
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  
  const client = new pg.Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Read and execute schema
    const schemaPath = join(__dirname, '../database/schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Executing schema.sql...');
    await client.query(schema);
    console.log('✅ Schema initialized successfully');
    
    // Run migrations if they exist
    const migrationsDir = join(__dirname, '../database/migrations');
    console.log('📁 Checking for migrations...');
    
    // Note: For now, schema.sql should be comprehensive enough
    // If you need to run migrations, add logic here
    
    console.log('✅ Test database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupTestDatabase();

