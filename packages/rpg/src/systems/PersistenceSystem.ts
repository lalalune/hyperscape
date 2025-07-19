import { 
  RPGPersistenceSystem, 
  RPGPlayer, 
  RPGWorldState,
  RPGPlayerDB,
  RPGInventoryDB,
  RPGEquipmentDB,
  RPGBankDB,
  RPGSkill,
  RPGStats,
  RPGExperience,
  RPGEquipment,
  RPGInventory,
  EquipmentSlot,
  STARTING_STATS,
  STARTING_EXPERIENCE,
  STARTING_EQUIPMENT,
  RPG_CONSTANTS
} from '../types/index.js'

export class RPGPersistenceSystemImpl implements RPGPersistenceSystem {
  name = 'PersistenceSystem'
  
  private worldState: any // Will be injected by the world
  private db: any // Database connection (will be injected)

  constructor(worldState: any, db?: any) {
    this.worldState = worldState
    this.db = db
  }

  async init(): Promise<void> {
    // Initialize database tables if not exists
    await this.initializeTables()
    console.log('[PersistenceSystem] Initialized')
  }

  update(deltaTime: number): void {
    // Persistence system handles on-demand saves
  }

  async cleanup(): Promise<void> {
    // Save all current state before cleanup
    await this.saveWorldState()
    console.log('[PersistenceSystem] Cleaned up')
  }

  async savePlayer(player: RPGPlayer): Promise<void> {
    if (!this.db) {
      console.warn('[PersistenceSystem] No database connection')
      return
    }

    try {
      // Convert player to database format
      const playerDB = this.playerToDB(player)
      
      // Upsert player record
      await this.db.run(`
        INSERT OR REPLACE INTO players (
          id, name, 
          position_x, position_y, position_z, 
          rotation_x, rotation_y, rotation_z, rotation_w,
          stat_attack, stat_strength, stat_defense, stat_constitution, stat_range,
          stat_woodcutting, stat_fishing, stat_firemaking, stat_cooking,
          exp_attack, exp_strength, exp_defense, exp_constitution, exp_range,
          exp_woodcutting, exp_fishing, exp_firemaking, exp_cooking,
          health, coins, combat_style, is_running, stamina,
          last_login, total_play_time, death_count, kill_count,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `, [
        playerDB.id, playerDB.name,
        playerDB.position_x, playerDB.position_y, playerDB.position_z,
        playerDB.rotation_x, playerDB.rotation_y, playerDB.rotation_z, playerDB.rotation_w,
        playerDB.stat_attack, playerDB.stat_strength, playerDB.stat_defense, playerDB.stat_constitution, playerDB.stat_range,
        playerDB.stat_woodcutting, playerDB.stat_fishing, playerDB.stat_firemaking, playerDB.stat_cooking,
        playerDB.exp_attack, playerDB.exp_strength, playerDB.exp_defense, playerDB.exp_constitution, playerDB.exp_range,
        playerDB.exp_woodcutting, playerDB.exp_fishing, playerDB.exp_firemaking, playerDB.exp_cooking,
        playerDB.health, playerDB.coins, playerDB.combat_style, playerDB.is_running, playerDB.stamina,
        playerDB.last_login, playerDB.total_play_time, playerDB.death_count, playerDB.kill_count,
        playerDB.created_at, playerDB.updated_at
      ])

      // Save inventory
      await this.savePlayerInventory(player)
      
      // Save equipment
      await this.savePlayerEquipment(player)
      
      // Save bank
      await this.savePlayerBank(player)

      console.log(`[PersistenceSystem] Saved player: ${player.name}`)
      
    } catch (error) {
      console.error('[PersistenceSystem] Error saving player:', error)
      throw error
    }
  }

  async loadPlayer(playerId: string): Promise<RPGPlayer | null> {
    if (!this.db) {
      console.warn('[PersistenceSystem] No database connection')
      return null
    }

    try {
      // Load player record
      const playerDB = await this.db.get(`SELECT * FROM players WHERE id = ?`, [playerId])
      
      if (!playerDB) {
        return null
      }

      // Convert from database format
      const player = this.playerFromDB(playerDB)
      
      // Load inventory
      player.inventory = await this.loadPlayerInventory(playerId)
      
      // Load equipment
      player.equipment = await this.loadPlayerEquipment(playerId)
      
      console.log(`[PersistenceSystem] Loaded player: ${player.name}`)
      
      return player
      
    } catch (error) {
      console.error('[PersistenceSystem] Error loading player:', error)
      return null
    }
  }

  async saveWorldState(): Promise<void> {
    if (!this.worldState) return

    try {
      // Save all players
      const savePromises: Promise<void>[] = []
      
      for (const player of this.worldState.players?.values() || []) {
        savePromises.push(this.savePlayer(player))
      }
      
      await Promise.all(savePromises)
      
      // Update world state metadata
      this.worldState.lastSave = new Date()
      
      console.log('[PersistenceSystem] Saved world state')
      
    } catch (error) {
      console.error('[PersistenceSystem] Error saving world state:', error)
      throw error
    }
  }

  async loadWorldState(): Promise<RPGWorldState> {
    // Create empty world state
    const worldState: RPGWorldState = {
      players: new Map(),
      mobs: new Map(),
      items: new Map(),
      zones: new Map(),
      activeCombat: new Map(),
      worldTime: new Date(),
      tickCount: 0,
      lastSave: new Date()
    }

    // Load all players
    try {
      if (this.db) {
        const players = await this.db.all(`SELECT * FROM players`)
        
        for (const playerDB of players) {
          const player = this.playerFromDB(playerDB)
          
          // Load inventory and equipment
          player.inventory = await this.loadPlayerInventory(player.id)
          player.equipment = await this.loadPlayerEquipment(player.id)
          
          worldState.players.set(player.id, player)
        }
      }
      
      console.log(`[PersistenceSystem] Loaded ${worldState.players.size} players`)
      
    } catch (error) {
      console.error('[PersistenceSystem] Error loading world state:', error)
    }

    return worldState
  }

  async createPlayer(name: string): Promise<RPGPlayer> {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const player: RPGPlayer = {
      id: playerId,
      name,
      position: { x: 0, y: 0, z: 0 }, // Will be set to random starter town
      stats: { ...STARTING_STATS },
      experience: { ...STARTING_EXPERIENCE },
      health: RPG_CONSTANTS.BASE_HEALTH + (STARTING_STATS[RPGSkill.CONSTITUTION] - 1),
      maxHealth: RPG_CONSTANTS.BASE_HEALTH + (STARTING_STATS[RPGSkill.CONSTITUTION] - 1),
      inventory: {
        slots: Array(RPG_CONSTANTS.INVENTORY_SLOTS).fill(null).map(() => ({ quantity: 0 })),
        maxSlots: RPG_CONSTANTS.INVENTORY_SLOTS
      },
      equipment: { ...STARTING_EQUIPMENT },
      coins: 0,
      combatStyle: 'accurate' as any,
      isRunning: false,
      stamina: 100,
      maxStamina: 100,
      lastLogin: new Date(),
      totalPlayTime: 0,
      deathCount: 0,
      killCount: 0,
      inCombat: false,
      lastAttackTime: 0
    }

    // Save the new player
    await this.savePlayer(player)
    
    console.log(`[PersistenceSystem] Created new player: ${name}`)
    
    return player
  }

  async deletePlayer(playerId: string): Promise<void> {
    if (!this.db) {
      console.warn('[PersistenceSystem] No database connection')
      return
    }

    try {
      // Delete player and related data
      await this.db.run(`DELETE FROM players WHERE id = ?`, [playerId])
      await this.db.run(`DELETE FROM inventories WHERE player_id = ?`, [playerId])
      await this.db.run(`DELETE FROM equipment WHERE player_id = ?`, [playerId])
      await this.db.run(`DELETE FROM banks WHERE player_id = ?`, [playerId])
      
      console.log(`[PersistenceSystem] Deleted player: ${playerId}`)
      
    } catch (error) {
      console.error('[PersistenceSystem] Error deleting player:', error)
      throw error
    }
  }

  // Private helper methods

  private async initializeTables(): Promise<void> {
    if (!this.db) return

    try {
      // Players table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          position_x REAL NOT NULL,
          position_y REAL NOT NULL,
          position_z REAL NOT NULL,
          rotation_x REAL NOT NULL DEFAULT 0,
          rotation_y REAL NOT NULL DEFAULT 0,
          rotation_z REAL NOT NULL DEFAULT 0,
          rotation_w REAL NOT NULL DEFAULT 1,
          stat_attack INTEGER NOT NULL DEFAULT 1,
          stat_strength INTEGER NOT NULL DEFAULT 1,
          stat_defense INTEGER NOT NULL DEFAULT 1,
          stat_constitution INTEGER NOT NULL DEFAULT 10,
          stat_range INTEGER NOT NULL DEFAULT 1,
          stat_woodcutting INTEGER NOT NULL DEFAULT 1,
          stat_fishing INTEGER NOT NULL DEFAULT 1,
          stat_firemaking INTEGER NOT NULL DEFAULT 1,
          stat_cooking INTEGER NOT NULL DEFAULT 1,
          exp_attack INTEGER NOT NULL DEFAULT 0,
          exp_strength INTEGER NOT NULL DEFAULT 0,
          exp_defense INTEGER NOT NULL DEFAULT 0,
          exp_constitution INTEGER NOT NULL DEFAULT 1154,
          exp_range INTEGER NOT NULL DEFAULT 0,
          exp_woodcutting INTEGER NOT NULL DEFAULT 0,
          exp_fishing INTEGER NOT NULL DEFAULT 0,
          exp_firemaking INTEGER NOT NULL DEFAULT 0,
          exp_cooking INTEGER NOT NULL DEFAULT 0,
          health INTEGER NOT NULL DEFAULT 19,
          coins INTEGER NOT NULL DEFAULT 0,
          combat_style TEXT NOT NULL DEFAULT 'accurate',
          is_running BOOLEAN NOT NULL DEFAULT 0,
          stamina INTEGER NOT NULL DEFAULT 100,
          last_login TEXT NOT NULL,
          total_play_time INTEGER NOT NULL DEFAULT 0,
          death_count INTEGER NOT NULL DEFAULT 0,
          kill_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `)

      // Inventories table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS inventories (
          id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          slot_index INTEGER NOT NULL,
          item_id TEXT,
          quantity INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
          UNIQUE(player_id, slot_index)
        )
      `)

      // Equipment table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS equipment (
          id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          slot TEXT NOT NULL,
          item_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
          UNIQUE(player_id, slot)
        )
      `)

      // Banks table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS banks (
          id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          slot_index INTEGER NOT NULL,
          item_id TEXT,
          quantity INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
          UNIQUE(player_id, slot_index)
        )
      `)

      console.log('[PersistenceSystem] Database tables initialized')
      
    } catch (error) {
      console.error('[PersistenceSystem] Error initializing tables:', error)
      throw error
    }
  }

  private playerToDB(player: RPGPlayer): RPGPlayerDB {
    const now = new Date().toISOString()
    
    return {
      id: player.id,
      name: player.name,
      position_x: player.position.x,
      position_y: player.position.y,
      position_z: player.position.z,
      rotation_x: player.position.rotation?.x || 0,
      rotation_y: player.position.rotation?.y || 0,
      rotation_z: player.position.rotation?.z || 0,
      rotation_w: player.position.rotation?.w || 1,
      stat_attack: player.stats[RPGSkill.ATTACK],
      stat_strength: player.stats[RPGSkill.STRENGTH],
      stat_defense: player.stats[RPGSkill.DEFENSE],
      stat_constitution: player.stats[RPGSkill.CONSTITUTION],
      stat_range: player.stats[RPGSkill.RANGE],
      stat_woodcutting: player.stats[RPGSkill.WOODCUTTING],
      stat_fishing: player.stats[RPGSkill.FISHING],
      stat_firemaking: player.stats[RPGSkill.FIREMAKING],
      stat_cooking: player.stats[RPGSkill.COOKING],
      exp_attack: player.experience[RPGSkill.ATTACK],
      exp_strength: player.experience[RPGSkill.STRENGTH],
      exp_defense: player.experience[RPGSkill.DEFENSE],
      exp_constitution: player.experience[RPGSkill.CONSTITUTION],
      exp_range: player.experience[RPGSkill.RANGE],
      exp_woodcutting: player.experience[RPGSkill.WOODCUTTING],
      exp_fishing: player.experience[RPGSkill.FISHING],
      exp_firemaking: player.experience[RPGSkill.FIREMAKING],
      exp_cooking: player.experience[RPGSkill.COOKING],
      health: player.health,
      coins: player.coins,
      combat_style: player.combatStyle,
      is_running: player.isRunning,
      stamina: player.stamina,
      last_login: player.lastLogin.toISOString(),
      total_play_time: player.totalPlayTime,
      death_count: player.deathCount,
      kill_count: player.killCount,
      created_at: now,
      updated_at: now
    }
  }

  private playerFromDB(playerDB: RPGPlayerDB): RPGPlayer {
    const stats: RPGStats = {
      [RPGSkill.ATTACK]: playerDB.stat_attack,
      [RPGSkill.STRENGTH]: playerDB.stat_strength,
      [RPGSkill.DEFENSE]: playerDB.stat_defense,
      [RPGSkill.CONSTITUTION]: playerDB.stat_constitution,
      [RPGSkill.RANGE]: playerDB.stat_range,
      [RPGSkill.WOODCUTTING]: playerDB.stat_woodcutting,
      [RPGSkill.FISHING]: playerDB.stat_fishing,
      [RPGSkill.FIREMAKING]: playerDB.stat_firemaking,
      [RPGSkill.COOKING]: playerDB.stat_cooking
    }

    const experience: RPGExperience = {
      [RPGSkill.ATTACK]: playerDB.exp_attack,
      [RPGSkill.STRENGTH]: playerDB.exp_strength,
      [RPGSkill.DEFENSE]: playerDB.exp_defense,
      [RPGSkill.CONSTITUTION]: playerDB.exp_constitution,
      [RPGSkill.RANGE]: playerDB.exp_range,
      [RPGSkill.WOODCUTTING]: playerDB.exp_woodcutting,
      [RPGSkill.FISHING]: playerDB.exp_fishing,
      [RPGSkill.FIREMAKING]: playerDB.exp_firemaking,
      [RPGSkill.COOKING]: playerDB.exp_cooking
    }

    return {
      id: playerDB.id,
      name: playerDB.name,
      position: {
        x: playerDB.position_x,
        y: playerDB.position_y,
        z: playerDB.position_z,
        rotation: {
          x: playerDB.rotation_x,
          y: playerDB.rotation_y,
          z: playerDB.rotation_z,
          w: playerDB.rotation_w
        }
      },
      stats,
      experience,
      health: playerDB.health,
      maxHealth: RPG_CONSTANTS.BASE_HEALTH + (stats[RPGSkill.CONSTITUTION] - 1),
      inventory: {
        slots: Array(RPG_CONSTANTS.INVENTORY_SLOTS).fill(null).map(() => ({ quantity: 0 })),
        maxSlots: RPG_CONSTANTS.INVENTORY_SLOTS
      },
      equipment: {},
      coins: playerDB.coins,
      combatStyle: playerDB.combat_style as any,
      isRunning: playerDB.is_running,
      stamina: playerDB.stamina,
      maxStamina: 100,
      lastLogin: new Date(playerDB.last_login),
      totalPlayTime: playerDB.total_play_time,
      deathCount: playerDB.death_count,
      killCount: playerDB.kill_count,
      inCombat: false,
      lastAttackTime: 0
    }
  }

  private async savePlayerInventory(player: RPGPlayer): Promise<void> {
    if (!this.db) return

    // Delete existing inventory
    await this.db.run(`DELETE FROM inventories WHERE player_id = ?`, [player.id])

    // Save current inventory
    const now = new Date().toISOString()
    
    for (let i = 0; i < player.inventory.slots.length; i++) {
      const slot = player.inventory.slots[i]
      if (slot.itemId && slot.quantity > 0) {
        await this.db.run(`
          INSERT INTO inventories (id, player_id, slot_index, item_id, quantity, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          `inv_${player.id}_${i}`,
          player.id,
          i,
          slot.itemId,
          slot.quantity,
          now,
          now
        ])
      }
    }
  }

  private async loadPlayerInventory(playerId: string): Promise<RPGInventory> {
    const inventory: RPGInventory = {
      slots: Array(RPG_CONSTANTS.INVENTORY_SLOTS).fill(null).map(() => ({ quantity: 0 })),
      maxSlots: RPG_CONSTANTS.INVENTORY_SLOTS
    }

    if (!this.db) return inventory

    const slots = await this.db.all(`
      SELECT * FROM inventories WHERE player_id = ? ORDER BY slot_index
    `, [playerId])

    for (const slot of slots) {
      if (slot.slot_index >= 0 && slot.slot_index < RPG_CONSTANTS.INVENTORY_SLOTS) {
        inventory.slots[slot.slot_index] = {
          itemId: slot.item_id,
          quantity: slot.quantity
        }
      }
    }

    return inventory
  }

  private async savePlayerEquipment(player: RPGPlayer): Promise<void> {
    if (!this.db) return

    // Delete existing equipment
    await this.db.run(`DELETE FROM equipment WHERE player_id = ?`, [player.id])

    // Save current equipment
    const now = new Date().toISOString()
    
    for (const [slot, itemId] of Object.entries(player.equipment)) {
      if (itemId) {
        await this.db.run(`
          INSERT INTO equipment (id, player_id, slot, item_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          `eq_${player.id}_${slot}`,
          player.id,
          slot,
          itemId,
          now,
          now
        ])
      }
    }
  }

  private async loadPlayerEquipment(playerId: string): Promise<RPGEquipment> {
    const equipment: RPGEquipment = {}

    if (!this.db) return equipment

    const slots = await this.db.all(`
      SELECT * FROM equipment WHERE player_id = ?
    `, [playerId])

    for (const slot of slots) {
      if (slot.item_id) {
        equipment[slot.slot as EquipmentSlot] = slot.item_id
      }
    }

    return equipment
  }

  private async savePlayerBank(player: RPGPlayer): Promise<void> {
    // Bank functionality - placeholder for now
    // Will be implemented when banking system is added
  }

  private async loadPlayerBank(playerId: string): Promise<void> {
    // Bank functionality - placeholder for now
    // Will be implemented when banking system is added
  }

  // Utility methods

  async getPlayerCount(): Promise<number> {
    if (!this.db) return 0

    try {
      const result = await this.db.get(`SELECT COUNT(*) as count FROM players`)
      return result.count || 0
    } catch (error) {
      console.error('[PersistenceSystem] Error getting player count:', error)
      return 0
    }
  }

  async getPlayerList(): Promise<{ id: string; name: string; lastLogin: Date }[]> {
    if (!this.db) return []

    try {
      const players = await this.db.all(`
        SELECT id, name, last_login FROM players ORDER BY last_login DESC
      `)
      
      return players.map(p => ({
        id: p.id,
        name: p.name,
        lastLogin: new Date(p.last_login)
      }))
    } catch (error) {
      console.error('[PersistenceSystem] Error getting player list:', error)
      return []
    }
  }

  async playerExists(playerId: string): Promise<boolean> {
    if (!this.db) return false

    try {
      const result = await this.db.get(`SELECT id FROM players WHERE id = ?`, [playerId])
      return !!result
    } catch (error) {
      console.error('[PersistenceSystem] Error checking player existence:', error)
      return false
    }
  }

  async playerNameExists(name: string): Promise<boolean> {
    if (!this.db) return false

    try {
      const result = await this.db.get(`SELECT id FROM players WHERE name = ?`, [name])
      return !!result
    } catch (error) {
      console.error('[PersistenceSystem] Error checking player name:', error)
      return false
    }
  }
}