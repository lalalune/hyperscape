import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const { Pool } = pg;

// Get directory path for migrations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: ReturnType<typeof drizzle> | undefined;
let poolInstance: pg.Pool | undefined;

export async function initializeDatabase(connectionString: string) {
  if (dbInstance) {
    console.log('[DB] Database already initialized');
    return { db: dbInstance, pool: poolInstance! };
  }

  console.log('[DB] Initializing PostgreSQL with Drizzle...');
  
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    console.log('[DB] ✅ PostgreSQL connection established');
    client.release();
  } catch (error) {
    console.error('[DB] ❌ Failed to connect to PostgreSQL:', error);
    throw error;
  }

  // Create Drizzle instance
  const db = drizzle(pool, { schema });
  
  // Run migrations
  try {
    console.log('[DB] Running migrations...');
    
    // When bundled by esbuild, we need to find migrations relative to process.cwd()
    // Try multiple possible locations
    const possiblePaths = [
      // Development: from server package root
      path.join(process.cwd(), 'src/db/migrations'),
      // Development: from workspace root
      path.join(process.cwd(), 'packages/server/src/db/migrations'),
      // Production: built migrations (if copied)
      path.join(__dirname, 'migrations'),
      path.join(__dirname, 'db/migrations'),
      // Fallback: relative to build folder
      path.join(__dirname, '../src/db/migrations'),
    ];
    
    let migrationsFolder: string | null = null;
    for (const testPath of possiblePaths) {
      const journalPath = path.join(testPath, 'meta/_journal.json');
      if (fs.existsSync(journalPath)) {
        migrationsFolder = testPath;
        break;
      }
    }
    
    if (!migrationsFolder) {
      throw new Error(
        `Could not find migrations folder. Searched:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}\n` +
        `Current working directory: ${process.cwd()}\n` +
        `__dirname: ${__dirname}`
      );
    }
    
    console.log('[DB] Migrations folder:', migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log('[DB] ✅ Migrations completed');
  } catch (error) {
    // If tables already exist (42P07), that's fine - the database is already set up
    const hasCode = error && typeof error === 'object' && 'cause' in error && 
                    error.cause && typeof error.cause === 'object' && 'code' in error.cause;
    const hasMessage = error && typeof error === 'object' && 'message' in error;
    const isExistsError = (hasCode && error.cause.code === '42P07') || 
                          (hasMessage && typeof error.message === 'string' && error.message.includes('already exists'));
    
    if (isExistsError) {
      console.log('[DB] ✅ Database tables already exist, skipping migration');
    } else {
      console.error('[DB] ❌ Migration failed:', error);
      throw error;
    }
  }

  dbInstance = db;
  poolInstance = pool;
  
  return { db, pool };
}

export function getDatabase() {
  if (!dbInstance) {
    throw new Error('[DB] Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

export function getPool() {
  if (!poolInstance) {
    throw new Error('[DB] Pool not initialized. Call initializeDatabase() first.');
  }
  return poolInstance;
}

export async function closeDatabase() {
  if (poolInstance) {
    await poolInstance.end();
    console.log('[DB] Database connection closed');
    poolInstance = undefined;
    dbInstance = undefined;
  }
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;
