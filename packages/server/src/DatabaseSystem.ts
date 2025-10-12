import { SystemBase } from '@hyperscape/shared'
import type {
  EquipmentRow,
  EquipmentSaveItem,
  InventoryRow,
  InventorySaveItem,
  ItemRow,
  PlayerRow,
  PlayerSessionRow,
  WorldChunkRow,
  World
} from '@hyperscape/shared'

// PostgreSQL pool interface (compatible with node-postgres)
type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>
  end: () => Promise<void>
}

export class DatabaseSystem extends SystemBase {
  private db: PgPool | null = null
  private connectionString: string

  private getDb(): PgPool {
    if (!this.db) {
      throw new Error('[DatabaseSystem] Database not initialized - call init() first')
    }
    return this.db
  }

  constructor(world: World) {
    super(world, {
      name: 'database',
      dependencies: {
        required: [], // Foundational system - no dependencies
        optional: [], // Self-contained database layer
      },
      autoCleanup: true,
    })

    // Get connection string from environment
    this.connectionString = process.env['DATABASE_URL'] || process.env['POSTGRES_URL'] || 'postgresql://localhost:5432/hyperscape'
  }

  private async initializeDependencies(): Promise<void> {
    const serverWorld = this.world as { isServer?: boolean }
    if (serverWorld.isServer) {
      // Initialize PostgreSQL connection with proper error handling
      try {
        const pg = await import('pg')
        const { Pool } = pg.default || pg
        
        if (!this.connectionString) {
          throw new Error('DATABASE_URL or POSTGRES_URL environment variable not set')
        }
        
        console.log('[DatabaseSystem] Connecting to PostgreSQL...')
        const pool = new Pool({
          connectionString: this.connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        })
        
        // Test connection with timeout
        const client = await Promise.race([
          pool.connect(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('PostgreSQL connection timeout after 5s')), 5000)
          )
        ])
        
        await client.query('SELECT NOW()')
        console.log('[DatabaseSystem] ✅ PostgreSQL connection established')
        client.release()
        
        this.db = pool as unknown as PgPool
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[DatabaseSystem] ❌ Failed to connect to PostgreSQL:', errorMessage)
        console.error('[DatabaseSystem] Connection string:', this.connectionString.replace(/:[^:@]+@/, ':****@'))
        console.error('[DatabaseSystem] Make sure PostgreSQL is running and accessible')
        
        if (errorMessage.includes('ECONNREFUSED')) {
          console.error('[DatabaseSystem] PostgreSQL server is not running or not accessible')
          console.error('[DatabaseSystem] Run: docker-compose up postgres OR set DATABASE_URL')
        } else if (errorMessage.includes('authentication failed')) {
          console.error('[DatabaseSystem] Invalid PostgreSQL credentials')
        } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
          console.error('[DatabaseSystem] Database does not exist - it will be created on first migration')
        }
        
        throw new Error(`DatabaseSystem initialization failed: ${errorMessage}`)
      }
    } else {
      console.warn('[DatabaseSystem] Running on client - creating mock database')
      this.db = this.createMockDatabase()
    }
  }

  async init(): Promise<void> {
    await this.initializeDependencies()

    if (!this.db) {
      throw new Error('[DatabaseSystem] Database initialization failed')
    }

    const serverWorld = this.world as { isServer?: boolean }
    if (serverWorld.isServer) {
      // Run database migrations only for real database
      await this.runMigrations()

      // Seed initial data if needed
      await this.seedInitialData()

      console.log('DatabaseSystem', 'Database initialized successfully')
    } else {
      console.log('DatabaseSystem', 'Mock database initialized - skipping migrations and seeding')
    }
  }

  start(): void {
    console.log('DatabaseSystem', 'Database system started')
  }

  // --- Characters API (now the primary player data store) ---
  getCharacters(_accountId: string): Array<{ id: string; name: string }> {
    // Sync method for compatibility - in real Postgres this should be async
    // For now, return empty array as this will be called from sync contexts
    console.warn('[DatabaseSystem] getCharacters called synchronously - returning empty array')
    return []
  }

  async getCharactersAsync(accountId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getDb().query(
      'SELECT id, name FROM characters WHERE "accountId" = $1 ORDER BY "createdAt" ASC',
      [accountId]
    )
    return result.rows as Array<{ id: string; name: string }>
  }

  async createCharacter(accountId: string, id: string, name: string): Promise<boolean> {
    const now = Date.now()
    const result = await this.getDb().query(
      `INSERT INTO characters (
        id, "accountId", name,
        "combatLevel", "attackLevel", "strengthLevel", "defenseLevel", "constitutionLevel", "rangedLevel",
        "woodcuttingLevel", "fishingLevel", "firemakingLevel", "cookingLevel",
        "attackXp", "strengthXp", "defenseXp", "constitutionXp", "rangedXp",
        "woodcuttingXp", "fishingXp", "firemakingXp", "cookingXp",
        health, "maxHealth", coins,
        "positionX", "positionY", "positionZ",
        "createdAt", "lastLogin"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      ON CONFLICT (id) DO NOTHING`,
      [
        id, accountId, name,
        1, 1, 1, 1, 10, 1, // combat, attack, strength, defense, constitution, ranged
        1, 1, 1, 1, // woodcutting, fishing, firemaking, cooking
        0, 0, 0, 1154, 0, // XP: attack, strength, defense, constitution, ranged
        0, 0, 0, 0, // XP: woodcutting, fishing, firemaking, cooking
        100, 100, 0, // health, maxHealth, coins
        0, 10, 0, // positionX, positionY (safe default), positionZ
        now, now // createdAt, lastLogin
      ]
    )
    return (result.rowCount || 0) > 0
  }

  destroy(): void {
    // Close database connection safely
    if (this.db && 'end' in this.db) {
      this.db.end().catch((error: Error) => {
        console.error('[DatabaseSystem] Error closing database:', error)
      })
      console.log('DatabaseSystem', 'Database connection closed')
    }

    super.destroy()
  }

  private async runMigrations(): Promise<void> {
    // Database migrations are handled by db.ts (the primary migration runner)
    // This system only manages RPG-specific data operations
    console.log('[DatabaseSystem] Skipping migrations - handled by db.ts')
  }

  private async seedInitialData(): Promise<void> {
    // Items are seeded by db.ts migrations during database initialization
    // This method is kept for future seeding needs (NPCs, starter items, etc.)
    console.log('[DatabaseSystem] Skipping item seeding - handled by db.ts migrations')
  }

  // Player data methods with proper typing
  getPlayer(_playerId: string): PlayerRow | null {
    // Sync method for compatibility - logs warning and returns null
    // Use getPlayerAsync for actual functionality
    console.warn('[DatabaseSystem] getPlayer called synchronously - use getPlayerAsync instead')
    return null
  }

  async getPlayerAsync(playerId: string): Promise<PlayerRow | null> {
    const result = await this.getDb().query('SELECT * FROM characters WHERE id = $1', [playerId])
    
    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0] as Record<string, unknown>
    return {
      ...row,
      playerId: String(row.id),
    } as unknown as PlayerRow
  }

  savePlayer(playerId: string, data: Partial<PlayerRow>): void {
    // Async operation - queue it
    this.savePlayerAsync(playerId, data).catch((error: Error) => {
      console.error('[DatabaseSystem] Error saving player:', error)
    })
  }

  async savePlayerAsync(playerId: string, data: Partial<PlayerRow>): Promise<void> {
    // Build dynamic update query
    const fields: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'playerId' && value !== undefined) {
        fields.push(`"${key}" = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    })

    if (fields.length === 0) return

    values.push(playerId)
    const updateQuery = `UPDATE characters SET ${fields.join(', ')} WHERE id = $${paramIndex}`
    
    await this.getDb().query(updateQuery, values)
  }

  // Inventory methods
  getPlayerInventory(_playerId: string): InventoryRow[] {
    // Sync method for compatibility - returns empty array
    console.warn('[DatabaseSystem] getPlayerInventory called synchronously - use getPlayerInventoryAsync instead')
    return []
  }

  async getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]> {
    const result = await this.getDb().query(
      'SELECT * FROM inventory WHERE "playerId" = $1 ORDER BY "slotIndex"',
      [playerId]
    )

    return result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    })) as InventoryRow[]
  }

  savePlayerInventory(playerId: string, inventory: InventorySaveItem[]): void {
    // Async operation - queue it
    this.savePlayerInventoryAsync(playerId, inventory).catch((error: Error) => {
      console.error('[DatabaseSystem] Error saving inventory:', error)
    })
  }

  async savePlayerInventoryAsync(playerId: string, inventory: InventorySaveItem[]): Promise<void> {
    // Clear existing inventory
    await this.getDb().query('DELETE FROM inventory WHERE "playerId" = $1', [playerId])

    // Insert new inventory items
    for (const item of inventory) {
      await this.getDb().query(
        `INSERT INTO inventory ("playerId", "itemId", quantity, "slotIndex", metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          playerId,
          item.itemId,
          item.quantity || 1,
          item.slotIndex || -1,
          item.metadata ? JSON.stringify(item.metadata) : null
        ]
      )
    }
  }

  // Equipment methods
  getPlayerEquipment(_playerId: string): EquipmentRow[] {
    // Sync method for compatibility - returns empty array
    console.warn('[DatabaseSystem] getPlayerEquipment called synchronously - use getPlayerEquipmentAsync instead')
    return []
  }

  async getPlayerEquipmentAsync(playerId: string): Promise<EquipmentRow[]> {
    const result = await this.getDb().query(
      'SELECT * FROM equipment WHERE "playerId" = $1',
      [playerId]
    )
    return result.rows as EquipmentRow[]
  }

  savePlayerEquipment(playerId: string, equipment: EquipmentSaveItem[]): void {
    // Async operation - queue it
    this.savePlayerEquipmentAsync(playerId, equipment).catch((error: Error) => {
      console.error('[DatabaseSystem] Error saving equipment:', error)
    })
  }

  async savePlayerEquipmentAsync(playerId: string, equipment: EquipmentSaveItem[]): Promise<void> {
    // Clear existing equipment
    await this.getDb().query('DELETE FROM equipment WHERE "playerId" = $1', [playerId])

    // Insert new equipment
    for (const item of equipment) {
      await this.getDb().query(
        `INSERT INTO equipment ("playerId", "slotType", "itemId", quantity)
         VALUES ($1, $2, $3, $4)`,
        [playerId, item.slotType, item.itemId, item.quantity || 1]
      )
    }
  }

  // Item methods
  getItem(_itemId: number): ItemRow | null {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] getItem called synchronously - use getItemAsync instead')
    return null
  }

  async getItemAsync(itemId: number): Promise<ItemRow | null> {
    const result = await this.getDb().query('SELECT * FROM items WHERE id = $1', [itemId])
    return result.rows.length > 0 ? (result.rows[0] as ItemRow) : null
  }

  getAllItems(): ItemRow[] {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] getAllItems called synchronously - use getAllItemsAsync instead')
    return []
  }

  async getAllItemsAsync(): Promise<ItemRow[]> {
    const result = await this.getDb().query('SELECT * FROM items ORDER BY id')
    return result.rows as ItemRow[]
  }

  // World chunk methods
  getWorldChunk(_chunkX: number, _chunkZ: number): WorldChunkRow | null {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] getWorldChunk called synchronously - use getWorldChunkAsync instead')
    return null
  }

  async getWorldChunkAsync(chunkX: number, chunkZ: number): Promise<WorldChunkRow | null> {
    const result = await this.getDb().query(
      'SELECT * FROM world_chunks WHERE "chunkX" = $1 AND "chunkZ" = $2',
      [chunkX, chunkZ]
    )
    return result.rows.length > 0 ? (result.rows[0] as WorldChunkRow) : null
  }

  saveWorldChunk(chunkData: {
    chunkX: number
    chunkZ: number
    biome?: string
    heightData?: number[]
    chunkSeed?: number
    lastActiveTime?: number | Date
    playerCount?: number
    data?: string
  }): void {
    // Async operation - queue it
    this.saveWorldChunkAsync(chunkData).catch((error: Error) => {
      console.error('[DatabaseSystem] Error saving world chunk:', error)
    })
  }

  async saveWorldChunkAsync(chunkData: {
    chunkX: number
    chunkZ: number
    biome?: string
    heightData?: number[]
    chunkSeed?: number
    lastActiveTime?: number | Date
    playerCount?: number
    data?: string
  }): Promise<void> {
    const dataToStore = chunkData.data || JSON.stringify({
      biome: chunkData.biome || 'grassland',
      heightData: chunkData.heightData || [],
      chunkSeed: chunkData.chunkSeed || 0,
    })

    await this.getDb().query(
      `INSERT INTO world_chunks ("chunkX", "chunkZ", data, "lastActive", "playerCount", version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("chunkX", "chunkZ") DO UPDATE SET
       data = $3, "lastActive" = $4, "playerCount" = $5, version = $6`,
      [
        chunkData.chunkX,
        chunkData.chunkZ,
        dataToStore,
        chunkData.lastActiveTime ? new Date(chunkData.lastActiveTime).getTime() : Date.now(),
        chunkData.playerCount || 0,
        1
      ]
    )
  }

  getInactiveChunks(_inactiveMinutes: number = 15): WorldChunkRow[] {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] getInactiveChunks called synchronously - use getInactiveChunksAsync instead')
    return []
  }

  async getInactiveChunksAsync(inactiveMinutes: number = 15): Promise<WorldChunkRow[]> {
    const cutoffTime = Date.now() - inactiveMinutes * 60 * 1000
    const result = await this.getDb().query(
      'SELECT * FROM world_chunks WHERE "lastActive" < $1 AND "playerCount" = 0',
      [cutoffTime]
    )
    return result.rows as WorldChunkRow[]
  }

  markChunkForReset(chunkX: number, chunkZ: number): void {
    this.markChunkForResetAsync(chunkX, chunkZ).catch((error: Error) => {
      console.error('[DatabaseSystem] Error marking chunk for reset:', error)
    })
  }

  async markChunkForResetAsync(chunkX: number, chunkZ: number): Promise<void> {
    await this.getDb().query(
      'UPDATE world_chunks SET "needsReset" = 1 WHERE "chunkX" = $1 AND "chunkZ" = $2',
      [chunkX, chunkZ]
    )
  }

  resetChunk(chunkX: number, chunkZ: number): void {
    this.resetChunkAsync(chunkX, chunkZ).catch((error: Error) => {
      console.error('[DatabaseSystem] Error resetting chunk:', error)
    })
  }

  async resetChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
    await this.getDb().query(
      'DELETE FROM world_chunks WHERE "chunkX" = $1 AND "chunkZ" = $2',
      [chunkX, chunkZ]
    )
  }

  updateChunkPlayerCount(chunkX: number, chunkZ: number, playerCount: number): void {
    this.updateChunkPlayerCountAsync(chunkX, chunkZ, playerCount).catch((error: Error) => {
      console.error('[DatabaseSystem] Error updating chunk player count:', error)
    })
  }

  async updateChunkPlayerCountAsync(chunkX: number, chunkZ: number, playerCount: number): Promise<void> {
    await this.getDb().query(
      'UPDATE world_chunks SET "playerCount" = $1, "lastActive" = $2 WHERE "chunkX" = $3 AND "chunkZ" = $4',
      [playerCount, Date.now(), chunkX, chunkZ]
    )
  }

  // Session tracking methods
  createPlayerSession(sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'>): string {
    // Return a session ID immediately, but do the actual creation async
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.createPlayerSessionAsync(sessionData, sessionId).catch((error: Error) => {
      console.error('[DatabaseSystem] Error creating player session:', error)
    })
    return sessionId
  }

  async createPlayerSessionAsync(sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'>, sessionId?: string): Promise<string> {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    await this.getDb().query(
      `INSERT INTO player_sessions (id, "playerId", "sessionStart", "sessionEnd", "playtimeMinutes", reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        sessionData.playerId,
        sessionData.sessionStart,
        sessionData.sessionEnd,
        sessionData.playtimeMinutes,
        sessionData.reason
      ]
    )

    return id
  }

  updatePlayerSession(sessionId: string, updates: Partial<PlayerSessionRow>): void {
    this.updatePlayerSessionAsync(sessionId, updates).catch((error: Error) => {
      console.error('[DatabaseSystem] Error updating player session:', error)
    })
  }

  async updatePlayerSessionAsync(sessionId: string, updates: Partial<PlayerSessionRow>): Promise<void> {
    const fields: string[] = []
    const values: (string | number | null)[] = []
    let paramIndex = 1

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        fields.push(`"${key}" = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    })

    if (fields.length === 0) return

    values.push(sessionId)
    const updateQuery = `UPDATE player_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex}`
    await this.getDb().query(updateQuery, values)
  }

  getActivePlayerSessions(): PlayerSessionRow[] {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] getActivePlayerSessions called synchronously - use getActivePlayerSessionsAsync instead')
    return []
  }

  async getActivePlayerSessionsAsync(): Promise<PlayerSessionRow[]> {
    const result = await this.getDb().query('SELECT * FROM player_sessions WHERE "sessionEnd" IS NULL')
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      sessionId: row.id as string,
      playerId: row.playerId as string,
      sessionStart: row.sessionStart as number,
      sessionEnd: row.sessionEnd as number | null,
      playtimeMinutes: row.playtimeMinutes as number,
      reason: row.reason as string | null,
      lastActivity: row.lastActivity as number,
    }))
  }

  endPlayerSession(sessionId: string, reason?: string): void {
    this.endPlayerSessionAsync(sessionId, reason).catch((error: Error) => {
      console.error('[DatabaseSystem] Error ending player session:', error)
    })
  }

  async endPlayerSessionAsync(sessionId: string, reason?: string): Promise<void> {
    await this.getDb().query(
      'UPDATE player_sessions SET "sessionEnd" = $1, reason = $2 WHERE id = $3',
      [Date.now(), reason || 'normal', sessionId]
    )
  }

  async recordChunkEntry(chunkX: number, chunkZ: number, playerId: string): Promise<number> {
    const result = await this.getDb().query(
      'INSERT INTO chunk_activity ("chunkX", "chunkZ", "playerId", "entryTime") VALUES ($1, $2, $3, $4) RETURNING id',
      [chunkX, chunkZ, playerId, Date.now()]
    )
    return (result.rows[0] as { id: number }).id
  }

  recordChunkExit(activityId: number): void {
    this.recordChunkExitAsync(activityId).catch((error: Error) => {
      console.error('[DatabaseSystem] Error recording chunk exit:', error)
    })
  }

  async recordChunkExitAsync(activityId: number): Promise<void> {
    await this.getDb().query(
      'UPDATE chunk_activity SET "exitTime" = $1 WHERE id = $2',
      [Date.now(), activityId]
    )
  }

  async getChunkPlayerCount(chunkX: number, chunkZ: number): Promise<number> {
    const result = await this.getDb().query(
      'SELECT COUNT(*) as count FROM chunk_activity WHERE "chunkX" = $1 AND "chunkZ" = $2 AND "exitTime" IS NULL',
      [chunkX, chunkZ]
    )
    return (result.rows[0] as { count: number }).count
  }

  cleanupOldSessions(_daysOld: number = 7): number {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] cleanupOldSessions called synchronously - use cleanupOldSessionsAsync instead')
    return 0
  }

  async cleanupOldSessionsAsync(daysOld: number = 7): Promise<number> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000
    const result = await this.getDb().query(
      'DELETE FROM player_sessions WHERE "sessionEnd" < $1',
      [cutoffTime]
    )
    return result.rowCount || 0
  }

  cleanupOldChunkActivity(_daysOld: number = 30): number {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] cleanupOldChunkActivity called synchronously - use cleanupOldChunkActivityAsync instead')
    return 0
  }

  async cleanupOldChunkActivityAsync(daysOld: number = 30): Promise<number> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000
    const result = await this.getDb().query(
      'DELETE FROM chunk_activity WHERE "entryTime" < $1',
      [cutoffTime]
    )
    return result.rowCount || 0
  }

  getDatabaseStats(): {
    playerCount: number
    activeSessionCount: number
    chunkCount: number
    activeChunkCount: number
    totalActivityRecords: number
  } {
    // Sync method for compatibility
    console.warn('[DatabaseSystem] getDatabaseStats called synchronously - use getDatabaseStatsAsync instead')
    return {
      playerCount: 0,
      activeSessionCount: 0,
      chunkCount: 0,
      activeChunkCount: 0,
      totalActivityRecords: 0,
    }
  }

  async getDatabaseStatsAsync(): Promise<{
    playerCount: number
    activeSessionCount: number
    chunkCount: number
    activeChunkCount: number
    totalActivityRecords: number
  }> {
    const playerCountResult = await this.getDb().query('SELECT COUNT(*) as count FROM players')
    const activeSessionCountResult = await this.getDb().query('SELECT COUNT(*) as count FROM player_sessions WHERE "sessionEnd" IS NULL')
    const chunkCountResult = await this.getDb().query('SELECT COUNT(*) as count FROM world_chunks')
    const activeChunkCountResult = await this.getDb().query('SELECT COUNT(*) as count FROM world_chunks WHERE "playerCount" > 0')
    const activityRecordsResult = await this.getDb().query('SELECT COUNT(*) as count FROM chunk_activity')

    return {
      playerCount: (playerCountResult.rows[0] as { count: number }).count,
      activeSessionCount: (activeSessionCountResult.rows[0] as { count: number }).count,
      chunkCount: (chunkCountResult.rows[0] as { count: number }).count,
      activeChunkCount: (activeChunkCountResult.rows[0] as { count: number }).count,
      totalActivityRecords: (activityRecordsResult.rows[0] as { count: number }).count,
    }
  }

  private createMockDatabase(): PgPool {
    // Simple mock database for client-side testing
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => {},
    } as PgPool
  }
}
