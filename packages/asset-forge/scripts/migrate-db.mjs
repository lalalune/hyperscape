/**
 * Database Migration Script
 * Creates all tables and enables pgvector extension
 */

import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment')
  process.exit(1)
}

console.log('🔄 Connecting to Fly.io Postgres...\n')

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function migrate() {
  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    // Enable pgvector extension
    console.log('1. Enabling pgvector extension...')
    await client.query('CREATE EXTENSION IF NOT EXISTS vector')
    console.log('✅ pgvector extension enabled\n')

    // Create users table
    console.log('2. Creating users table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        privy_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        wallet_address VARCHAR(42),
        farcaster_fid VARCHAR(100),
        display_name VARCHAR(100),
        avatar_url TEXT,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS privy_id_idx ON users(privy_id)')
    await client.query('CREATE INDEX IF NOT EXISTS email_idx ON users(email)')
    await client.query('CREATE INDEX IF NOT EXISTS wallet_address_idx ON users(wallet_address)')
    console.log('✅ users table created\n')

    // Create assets table
    console.log('3. Creating assets table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        tags JSONB DEFAULT '[]',
        model_url TEXT NOT NULL,
        model_url_raw TEXT,
        model_url_rigged TEXT,
        concept_art_url TEXT,
        thumbnail_url TEXT,
        metadata JSONB DEFAULT '{}',
        prompt TEXT,
        style_preset VARCHAR(100),
        file_size INTEGER,
        vertex_count INTEGER,
        triangle_count INTEGER,
        meshy_task_id VARCHAR(255),
        generated_by UUID REFERENCES users(id),
        generated_at TIMESTAMP,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        is_public BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS asset_id_idx ON assets(asset_id)')
    await client.query('CREATE INDEX IF NOT EXISTS category_idx ON assets(category)')
    await client.query('CREATE INDEX IF NOT EXISTS status_idx ON assets(status)')
    await client.query('CREATE INDEX IF NOT EXISTS generated_by_idx ON assets(generated_by)')
    console.log('✅ assets table created\n')

    // Create asset_embeddings table
    console.log('4. Creating asset_embeddings table with pgvector...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
        embedding vector(1536),
        source_text TEXT,
        model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS asset_embedding_asset_id_idx ON asset_embeddings(asset_id)')
    await client.query('CREATE INDEX IF NOT EXISTS embedding_idx ON asset_embeddings USING hnsw (embedding vector_cosine_ops)')
    console.log('✅ asset_embeddings table created\n')

    // Create generations table
    console.log('5. Creating generations table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        prompt TEXT,
        reference_image_url TEXT,
        style_preset VARCHAR(100),
        parameters JSONB DEFAULT '{}',
        asset_id UUID REFERENCES assets(id),
        status VARCHAR(50) NOT NULL,
        error TEXT,
        meshy_task_id VARCHAR(255),
        pipeline_id VARCHAR(255),
        steps JSONB DEFAULT '[]',
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        duration INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS generation_user_id_idx ON generations(user_id)')
    await client.query('CREATE INDEX IF NOT EXISTS generation_status_idx ON generations(status)')
    await client.query('CREATE INDEX IF NOT EXISTS generation_type_idx ON generations(type)')
    await client.query('CREATE INDEX IF NOT EXISTS generation_created_at_idx ON generations(created_at)')
    console.log('✅ generations table created\n')

    // Create voice_profiles table
    console.log('6. Creating voice_profiles table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        voice_id VARCHAR(255) NOT NULL,
        voice_settings JSONB DEFAULT '{}',
        sample_audio_url TEXT,
        character_count INTEGER DEFAULT 0,
        generation_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS voice_profile_entity_idx ON voice_profiles(entity_type, entity_id)')
    await client.query('CREATE INDEX IF NOT EXISTS voice_profile_voice_id_idx ON voice_profiles(voice_id)')
    console.log('✅ voice_profiles table created\n')

    // Create api_keys table
    console.log('7. Creating api_keys table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(10) NOT NULL,
        scopes JSONB DEFAULT '[]',
        rate_limit INTEGER DEFAULT 100,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS api_key_user_id_idx ON api_keys(user_id)')
    await client.query('CREATE INDEX IF NOT EXISTS api_key_hash_idx ON api_keys(key_hash)')
    await client.query('CREATE INDEX IF NOT EXISTS api_key_active_idx ON api_keys(is_active)')
    console.log('✅ api_keys table created\n')

    // Create sessions table
    console.log('8. Creating sessions table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS session_token_idx ON sessions(session_token)')
    await client.query('CREATE INDEX IF NOT EXISTS session_user_id_idx ON sessions(user_id)')
    await client.query('CREATE INDEX IF NOT EXISTS session_expires_at_idx ON sessions(expires_at)')
    console.log('✅ sessions table created\n')

    console.log('🎉 Database migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await client.end()
  }
}

migrate()
