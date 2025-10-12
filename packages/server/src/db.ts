import type { PluginMigration, SystemDatabase } from '@hyperscape/shared'

// PostgreSQL client interface
export type PgClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>
  end: () => Promise<void>
}

export type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>
  end: () => Promise<void>
  connect: () => Promise<PgClient>
}

async function openPostgresDatabase(connectionString: string): Promise<PgPool> {
  const pg = await import('pg')
  const { Pool } = pg.default || pg
  
  if (!connectionString) {
    throw new Error('[DB] No database connection string provided')
  }
  
  console.log('[DB] Connecting to PostgreSQL...')
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  
  // Test connection with timeout
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 5s')), 5000)
      )
    ])
    
    try {
      await client.query('SELECT NOW()')
      console.log('[DB] ✅ PostgreSQL connection established')
    } finally {
      client.release()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[DB] ❌ PostgreSQL connection failed:', errorMessage)
    
    // Provide helpful error messages
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
      console.error('[DB] → PostgreSQL server is not accessible')
      console.error('[DB] → Check if PostgreSQL is running')
      console.error('[DB] → Verify connection string:', connectionString.replace(/:[^:@]+@/, ':****@'))
    } else if (errorMessage.includes('authentication failed') || errorMessage.includes('password')) {
      console.error('[DB] → Invalid credentials')
    } else if (errorMessage.includes('does not exist')) {
      console.error('[DB] → Database does not exist (will be created by migrations)')
    }
    
    throw error
  }
  
  return pool as unknown as PgPool
}

// Minimal query builder to satisfy SystemDatabase
function createSystemDatabase(pool: PgPool): SystemDatabase {
  type WhereCond = { key: string; value: unknown }
  // Quote identifiers that contain uppercase letters to preserve case in PostgreSQL
  const esc = (id: string) => {
    const clean = id.replace(/[^a-zA-Z0-9_]/g, '')
    return /[A-Z]/.test(clean) ? `"${clean}"` : clean
  }

  class QueryBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
    private _table: string
    private _where: WhereCond[] = []
    private _columns: string[] | undefined

    constructor(table: string) {
      this._table = esc(table)
    }

    where(key: string, value: unknown): this {
      this._where.push({ key: esc(key), value })
      return this
    }

    select(columns?: string | string[]): this {
      if (Array.isArray(columns)) this._columns = columns.map(esc)
      else if (typeof columns === 'string') this._columns = [esc(columns)]
      return this
    }

    async first(): Promise<T | undefined> {
      const rows = await this._all<T>(true)
      return rows[0]
    }

    async insert(data: Record<string, unknown> | Record<string, unknown>[]): Promise<void> {
      const rows = Array.isArray(data) ? data : [data]
      for (const row of rows) {
        const originalKeys = Object.keys(row)
        const escapedKeys = originalKeys.map(esc)
        const placeholders = escapedKeys.map((_, i) => `$${i + 1}`).join(',')
        const sql = `INSERT INTO ${this._table} (${escapedKeys.join(',')}) VALUES (${placeholders})`
        const values = originalKeys.map(k => (row as Record<string, unknown>)[k])
        await pool.query(sql, values)
      }
    }

    async update(data: Record<string, unknown>): Promise<number> {
      const originalKeys = Object.keys(data)
      const escapedKeys = originalKeys.map(esc)
      const setClause = escapedKeys.map((k, i) => `${k} = $${i + 1}`).join(', ')
      const whereClause = this._where.length
        ? ` WHERE ${this._where.map((w, i) => `${w.key} = $${originalKeys.length + i + 1}`).join(' AND ')}`
        : ''
      const sql = `UPDATE ${this._table} SET ${setClause}${whereClause}`
      const params = originalKeys.map(k => (data as Record<string, unknown>)[k]).concat(this._where.map(w => w.value))
      const result = await pool.query(sql, params)
      return result.rowCount || 0
    }

    async delete(): Promise<number> {
      const whereClause = this._where.length
        ? ` WHERE ${this._where.map((w, i) => `${w.key} = $${i + 1}`).join(' AND ')}`
        : ''
      const sql = `DELETE FROM ${this._table}${whereClause}`
      const params = this._where.map(w => w.value)
      const result = await pool.query(sql, params)
      return result.rowCount || 0
    }

    then<TResult1 = T[], TResult2 = never>(
      onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2> {
      return this._all<T>(false).then(onfulfilled, onrejected) as unknown as Promise<TResult1 | TResult2>
    }

    catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null
    ): Promise<T[] | TResult> {
      return this._all<T>(false).catch(onrejected)
    }

    private async _all<R>(limitOne: boolean): Promise<R[]> {
      const cols = this._columns?.length ? this._columns!.join(',') : '*'
      const whereClause = this._where.length
        ? ` WHERE ${this._where.map((w, i) => `${w.key} = $${i + 1}`).join(' AND ')}`
        : ''
      const limit = limitOne ? ' LIMIT 1' : ''
      const sql = `SELECT ${cols} FROM ${this._table}${whereClause}${limit}`
      const params = this._where.map(w => w.value)
      const result = await pool.query(sql, params)
      return (result.rows as R[]) || []
    }
  }

  const dbFunc = ((table: string) => new QueryBuilder(table)) as unknown as SystemDatabase
  return dbFunc
}

// Global registry for plugin migrations
const pluginMigrations: Record<string, PluginMigration[]> = {}

export function registerPluginMigrations(pluginName: string, migrations: PluginMigration[]): void {
  pluginMigrations[pluginName] = migrations
  console.log(`[DB] Registered ${migrations.length} migrations for plugin: ${pluginName}`)
}

let dbInstance: SystemDatabase | undefined
let pgPoolInstance: PgPool | undefined

export async function getDB(connectionString: string): Promise<SystemDatabase> {
  if (!dbInstance) {
    try {
      console.log('[DB] Initializing PostgreSQL database...')
      const pool = await openPostgresDatabase(connectionString)
      const systemDb = createSystemDatabase(pool)
      await migratePostgres(pool, systemDb)
      dbInstance = systemDb
      pgPoolInstance = pool
    } catch (error) {
      console.error('[DB] Error initializing database:', error instanceof Error ? error.message : String(error))
      console.error('[DB] Full error:', error)
      console.log('[DB] Falling back to mock database for development')
      dbInstance = createMockSystemDatabase()
    }
  }
  return dbInstance!
}

export function getPgPool(): PgPool | undefined {
  return pgPoolInstance
}

export async function closeDB(): Promise<void> {
  if (pgPoolInstance) {
    try {
      await pgPoolInstance.end()
      console.log('[DB] Database connection closed')
    } catch (error) {
      console.error('[DB] Error closing database:', error)
    }
    pgPoolInstance = undefined
    dbInstance = undefined
  }
}

async function migratePostgres(pool: PgPool, systemDb: SystemDatabase): Promise<void> {
  // Ensure config table exists
  await pool.query(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`)
  const vRow = await pool.query('SELECT value FROM config WHERE key = $1', ['version'])
  let version = Number.parseInt((vRow.rows[0] as { value?: string })?.value ?? '0', 10) || 0

  const migrations: Array<(pool: PgPool) => Promise<void>> = [
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        roles TEXT NOT NULL,
        "createdAt" TEXT NOT NULL,
        avatar TEXT
      )`)
    },
    async pool => {
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vrm'`
      )
      if (result.rows.length === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vrm TEXT`)
      }
    },
    async pool => {
      const hasVRM = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vrm'`
      )
      const hasAvatar = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar'`
      )
      if (hasVRM.rows.length > 0 && hasAvatar.rows.length === 0) {
        await pool.query(`ALTER TABLE users RENAME COLUMN vrm TO avatar`)
      }
    },
    async pool => {
      const cfg = await pool.query(`SELECT value FROM config WHERE key = 'config'`)
      if (cfg.rows.length > 0 && (cfg.rows[0] as { value?: string })?.value) {
        await pool.query(`INSERT INTO config (key, value) VALUES ('settings', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [
          (cfg.rows[0] as { value: string }).value,
        ])
        await pool.query(`DELETE FROM config WHERE key = 'config'`)
      }
    },
    async pool => {
      const hasTable = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'entities'`
      )
      if (hasTable.rows.length > 0) {
        const rows = await pool.query('SELECT id, data FROM entities')
        for (const row of rows.rows as Array<{ id: string; data: string }>) {
          const data = JSON.parse(row.data) as Record<string, unknown>
          if (!('scale' in data)) {
            (data as { scale: [number, number, number] }).scale = [1, 1, 1]
            await pool.query('UPDATE entities SET data = $1 WHERE id = $2', [JSON.stringify(data), row.id])
          }
        }
      } else {
        console.log('[DB] Migration #5: entities table does not exist, skipping scale field update')
      }
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`)
    },
    async pool => {
      // Migration #7: Add Privy authentication columns
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "privyUserId" TEXT UNIQUE`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "farcasterFid" TEXT`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_privy ON users("privyUserId")`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_farcaster ON users("farcasterFid")`)
      console.log('[DB] Migration #7: Added privyUserId and farcasterFid columns')
    },
    // RPG tables (migrated from SQLite)
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        "playerId" TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        "combatLevel" INTEGER DEFAULT 1,
        "attackLevel" INTEGER DEFAULT 1,
        "strengthLevel" INTEGER DEFAULT 1,
        "defenseLevel" INTEGER DEFAULT 1,
        "constitutionLevel" INTEGER DEFAULT 10,
        "rangedLevel" INTEGER DEFAULT 1,
        "attackXp" INTEGER DEFAULT 0,
        "strengthXp" INTEGER DEFAULT 0,
        "defenseXp" INTEGER DEFAULT 0,
        "constitutionXp" INTEGER DEFAULT 1154,
        "rangedXp" INTEGER DEFAULT 0,
        health INTEGER DEFAULT 100,
        "maxHealth" INTEGER DEFAULT 100,
        coins INTEGER DEFAULT 0,
        "positionX" REAL DEFAULT 0,
        "positionY" REAL DEFAULT 0,
        "positionZ" REAL DEFAULT 0,
        "lastLogin" BIGINT DEFAULT 0,
        "createdAt" BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        value INTEGER DEFAULT 0,
        weight REAL DEFAULT 0,
        stackable INTEGER DEFAULT 0,
        tradeable INTEGER DEFAULT 1,
        "attackLevel" INTEGER,
        "strengthLevel" INTEGER,
        "defenseLevel" INTEGER,
        "rangedLevel" INTEGER,
        "attackBonus" INTEGER DEFAULT 0,
        "strengthBonus" INTEGER DEFAULT 0,
        "defenseBonus" INTEGER DEFAULT 0,
        "rangedBonus" INTEGER DEFAULT 0,
        heals INTEGER
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        "playerId" TEXT NOT NULL,
        "itemId" TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        "slotIndex" INTEGER DEFAULT -1,
        metadata TEXT,
        CONSTRAINT fk_inventory_player FOREIGN KEY ("playerId") REFERENCES players("playerId") ON DELETE CASCADE
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS equipment (
        id SERIAL PRIMARY KEY,
        "playerId" TEXT NOT NULL,
        "slotType" TEXT NOT NULL,
        "itemId" TEXT,
        quantity INTEGER DEFAULT 1,
        UNIQUE("playerId", "slotType"),
        CONSTRAINT fk_equipment_player FOREIGN KEY ("playerId") REFERENCES players("playerId") ON DELETE CASCADE
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS world_chunks (
        "chunkX" INTEGER NOT NULL,
        "chunkZ" INTEGER NOT NULL,
        data TEXT NOT NULL,
        "lastActive" BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        "playerCount" INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        "needsReset" INTEGER DEFAULT 0,
        PRIMARY KEY ("chunkX", "chunkZ")
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS player_sessions (
        id TEXT PRIMARY KEY,
        "playerId" TEXT NOT NULL,
        "sessionStart" BIGINT NOT NULL,
        "sessionEnd" BIGINT,
        "playtimeMinutes" INTEGER DEFAULT 0,
        reason TEXT,
        "lastActivity" BIGINT DEFAULT 0,
        CONSTRAINT fk_session_player FOREIGN KEY ("playerId") REFERENCES players("playerId") ON DELETE CASCADE
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS chunk_activity (
        id SERIAL PRIMARY KEY,
        "chunkX" INTEGER NOT NULL,
        "chunkZ" INTEGER NOT NULL,
        "playerId" TEXT NOT NULL,
        "entryTime" BIGINT NOT NULL,
        "exitTime" BIGINT,
        CONSTRAINT fk_activity_player FOREIGN KEY ("playerId") REFERENCES players("playerId") ON DELETE CASCADE
      )`)
    },
    async pool => {
      await pool.query(`CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        name TEXT NOT NULL,
        "createdAt" BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        "combatLevel" INTEGER DEFAULT 1,
        "attackLevel" INTEGER DEFAULT 1,
        "strengthLevel" INTEGER DEFAULT 1,
        "defenseLevel" INTEGER DEFAULT 1,
        "constitutionLevel" INTEGER DEFAULT 10,
        "rangedLevel" INTEGER DEFAULT 1,
        "woodcuttingLevel" INTEGER DEFAULT 1,
        "fishingLevel" INTEGER DEFAULT 1,
        "firemakingLevel" INTEGER DEFAULT 1,
        "cookingLevel" INTEGER DEFAULT 1,
        "attackXp" INTEGER DEFAULT 0,
        "strengthXp" INTEGER DEFAULT 0,
        "defenseXp" INTEGER DEFAULT 0,
        "constitutionXp" INTEGER DEFAULT 1154,
        "rangedXp" INTEGER DEFAULT 0,
        "woodcuttingXp" INTEGER DEFAULT 0,
        "fishingXp" INTEGER DEFAULT 0,
        "firemakingXp" INTEGER DEFAULT 0,
        "cookingXp" INTEGER DEFAULT 0,
        health INTEGER DEFAULT 100,
        "maxHealth" INTEGER DEFAULT 100,
        coins INTEGER DEFAULT 0,
        "positionX" REAL DEFAULT 0,
        "positionY" REAL DEFAULT 10,
        "positionZ" REAL DEFAULT 0,
        "lastLogin" BIGINT DEFAULT 0
      )`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_characters_account ON characters("accountId")`)
    },
    async pool => {
      // Fix users.createdAt column if it was created as lowercase 'createdat'
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('createdat', 'createdAt')`
      )
      const columnName = result.rows[0] ? (result.rows[0] as { column_name: string }).column_name : null
      
      if (columnName === 'createdat') {
        await pool.query(`ALTER TABLE users RENAME COLUMN createdat TO "createdAt"`)
        console.log('[DB] Migration #17: Fixed users.createdAt column name')
      } else if (!columnName) {
        await pool.query(`ALTER TABLE users ADD COLUMN "createdAt" TEXT NOT NULL DEFAULT NOW()::TEXT`)
        console.log('[DB] Migration #17: Added users.createdAt column')
      }
    },
  ]

  for (let i = version; i < migrations.length; i++) {
    console.log(`[DB] running migration #${i + 1}...`)
    await migrations[i](pool)
    await pool.query('INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [
      'version',
      String(i + 1),
    ])
    version = i + 1
  }

  // Plugin migrations after core
  await runPluginMigrationsPostgres(pool, systemDb)
  console.log('[DB] All migrations completed')
}

async function runPluginMigrationsPostgres(pool: PgPool, systemDb: SystemDatabase): Promise<void> {
  for (const [pluginName, migrations] of Object.entries(pluginMigrations)) {
    const table = `${pluginName}_migrations`
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${table} (id SERIAL PRIMARY KEY, name TEXT NOT NULL, executed_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()))`
    )
    const rows = await pool.query(`SELECT name FROM ${table}`)
    const executed = new Set((rows.rows as Array<{ name: string }>).map(r => r.name))
    for (const m of migrations) {
      if (!executed.has(m.name)) {
        console.log(`[DB] Running plugin migration: ${pluginName}.${m.name}`)
        await m.up(systemDb as unknown)
        await pool.query(`INSERT INTO ${table} (name) VALUES ($1)`, [m.name])
      }
    }
  }
}

function createMockSystemDatabase(): SystemDatabase {
  const mockQueryBuilder = {
    where: (_key: string, _value: unknown) => mockQueryBuilder,
    first: async () => undefined,
    select: (_columns?: string | string[]) => mockQueryBuilder,
    update: async (_data: unknown) => 0,
    delete: async () => 0,
    insert: async (_data: unknown) => {},
  } as unknown as {
    where: (k: string, v: unknown) => unknown
    first: () => Promise<unknown>
    select: (c?: unknown) => unknown
    update: (d: unknown) => Promise<number>
    delete: () => Promise<number>
    insert: (d: unknown) => Promise<void>
  } & PromiseLike<unknown[]>

  ;(mockQueryBuilder as unknown as { then: Function }).then = (
    onfulfilled: (v: unknown[]) => unknown,
    onrejected?: (e: unknown) => unknown
  ) => Promise.resolve([]).then(onfulfilled, onrejected)
  ;(mockQueryBuilder as unknown as { catch: Function }).catch = (onrejected: (e: unknown) => unknown) =>
    Promise.resolve([]).catch(onrejected)

  const mockFunction = ((_tableName: string) => {
    console.log(`[DB Mock] Query on table: ${_tableName}`)
    return mockQueryBuilder
  }) as unknown as SystemDatabase

  return mockFunction
}
