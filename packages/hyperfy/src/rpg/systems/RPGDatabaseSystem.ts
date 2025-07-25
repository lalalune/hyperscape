import { System } from '../../core/systems/System';
// Dynamic import for better-sqlite3 to avoid client-side bundling issues
let Database: any = null;
let path: any = null;
import { RPGMigrations } from '../database/migrations';
import type { 
  RPGPlayerData, 
  RPGInventoryItem, 
  RPGEquipmentSlot,
  RPGItem,
  RPGWorldChunk,
  RPGPlayerSession 
} from '../types/index';

export class RPGDatabaseSystem extends System {
  private db: any | null = null;
  private dbPath: string;

  constructor(world: any) {
    super(world);
    // Initialize dynamic imports on server only
    this.initializeDependencies();
    // Use the world's database path if available, otherwise default
    // Path will be set after dependencies are loaded
    this.dbPath = '';
  }

  private async initializeDependencies(): Promise<void> {
    // Only load dependencies on server
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      try {
        const { default: BetterSqlite3 } = await import('better-sqlite3');
        const pathModule = await import('path');
        Database = BetterSqlite3;
        path = pathModule.default;
        this.dbPath = path.join(process.cwd(), 'world', 'rpg.sqlite');
      } catch (error) {
        console.warn('[RPGDatabaseSystem] Failed to load dependencies, running in client mode');
      }
    }
  }

  async init(): Promise<void> {
    console.log('[RPGDatabaseSystem] Initializing database system...');
    
    // Wait for dependencies to be loaded
    await this.initializeDependencies();
    
    // Skip initialization if we're on client or dependencies failed to load
    if (!Database || !path) {
      console.log('[RPGDatabaseSystem] Skipping database initialization (client mode or dependencies unavailable)');
      return;
    }
    
    try {
      // Initialize SQLite database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      
      // Run migrations
      await this.runMigrations();
      
      // Seed initial data
      await this.seedInitialData();
      
      console.log('[RPGDatabaseSystem] Database system initialized successfully');
    } catch (error) {
      console.error('[RPGDatabaseSystem] Failed to initialize database:', error);
      throw error;
    }
  }

  start(): void {
    console.log('[RPGDatabaseSystem] Database system started');
  }

  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    console.log('[RPGDatabaseSystem] Database system destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rpg_migrations (
        name TEXT PRIMARY KEY,
        executed_at TEXT NOT NULL
      )
    `);

    const executedMigrations = this.db
      .prepare('SELECT name FROM rpg_migrations')
      .all()
      .map((row: any) => row.name);

    for (const migration of RPGMigrations) {
      if (executedMigrations.includes(migration.name)) {
        continue;
      }

      console.log(`[RPGDatabaseSystem] Running migration: ${migration.name}`);
      
      // Convert Knex schema to SQLite directly
      await this.executeMigrationSQL(migration.name);
      
      // Record migration as executed
      this.db.prepare('INSERT INTO rpg_migrations (name, executed_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString());
    }
  }

  private async executeMigrationSQL(migrationName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    switch (migrationName) {
      case 'create_rpg_world_chunks':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_world_chunks (
            chunk_x INTEGER NOT NULL,
            chunk_z INTEGER NOT NULL,
            biome TEXT NOT NULL,
            height_data TEXT NOT NULL,
            resource_states TEXT,
            mob_spawn_states TEXT,
            player_modifications TEXT,
            chunk_seed INTEGER,
            last_active_time TEXT,
            player_count INTEGER DEFAULT 0,
            needs_reset INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (chunk_x, chunk_z)
          )
        `);
        break;

      case 'create_rpg_player_sessions':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_player_sessions (
            session_id TEXT PRIMARY KEY,
            player_id TEXT REFERENCES rpg_players(id) ON DELETE CASCADE,
            player_token TEXT NOT NULL,
            start_time TEXT DEFAULT CURRENT_TIMESTAMP,
            end_time TEXT,
            last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
            last_save_time TEXT DEFAULT CURRENT_TIMESTAMP,
            auto_save_interval INTEGER DEFAULT 30,
            is_active INTEGER DEFAULT 1,
            disconnect_reason TEXT
          )
        `);
        break;

      case 'create_rpg_chunk_activity':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_chunk_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chunk_x INTEGER NOT NULL,
            chunk_z INTEGER NOT NULL,
            player_id TEXT REFERENCES rpg_players(id) ON DELETE CASCADE,
            entered_at TEXT DEFAULT CURRENT_TIMESTAMP,
            left_at TEXT,
            session_duration INTEGER DEFAULT 0,
            FOREIGN KEY (chunk_x, chunk_z) REFERENCES rpg_world_chunks(chunk_x, chunk_z)
          )
        `);
        break;

      case 'create_rpg_players':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_players (
            id TEXT PRIMARY KEY,
            hyperfy_player_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            attack_level INTEGER DEFAULT 1,
            attack_xp INTEGER DEFAULT 0,
            strength_level INTEGER DEFAULT 1,
            strength_xp INTEGER DEFAULT 0,
            defense_level INTEGER DEFAULT 1,
            defense_xp INTEGER DEFAULT 0,
            ranged_level INTEGER DEFAULT 1,
            ranged_xp INTEGER DEFAULT 0,
            woodcutting_level INTEGER DEFAULT 1,
            woodcutting_xp INTEGER DEFAULT 0,
            fishing_level INTEGER DEFAULT 1,
            fishing_xp INTEGER DEFAULT 0,
            firemaking_level INTEGER DEFAULT 1,
            firemaking_xp INTEGER DEFAULT 0,
            cooking_level INTEGER DEFAULT 1,
            cooking_xp INTEGER DEFAULT 0,
            constitution_level INTEGER DEFAULT 10,
            constitution_xp INTEGER DEFAULT 1154,
            current_hitpoints INTEGER DEFAULT 100,
            max_hitpoints INTEGER DEFAULT 100,
            position_x REAL DEFAULT 0,
            position_y REAL DEFAULT 0,
            position_z REAL DEFAULT 0,
            alive INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        break;

      case 'create_rpg_inventory':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT REFERENCES rpg_players(id) ON DELETE CASCADE,
            slot_index INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            item_data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, slot_index)
          )
        `);
        break;

      case 'create_rpg_equipment':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT REFERENCES rpg_players(id) ON DELETE CASCADE,
            slot_name TEXT NOT NULL,
            item_id INTEGER,
            quantity INTEGER DEFAULT 1,
            item_data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, slot_name)
          )
        `);
        break;

      case 'create_rpg_items':
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS rpg_items (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            tier TEXT,
            stackable INTEGER DEFAULT 0,
            attack_level INTEGER,
            strength_level INTEGER,
            defense_level INTEGER,
            ranged_level INTEGER,
            attack_bonus INTEGER DEFAULT 0,
            strength_bonus INTEGER DEFAULT 0,
            defense_bonus INTEGER DEFAULT 0,
            ranged_bonus INTEGER DEFAULT 0,
            heals INTEGER,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        break;

      default:
        console.warn(`[RPGDatabaseSystem] Unknown migration: ${migrationName}`);
    }
  }

  private async seedInitialData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if items are already seeded
    const itemCount = this.db.prepare('SELECT COUNT(*) as count FROM rpg_items').get() as { count: number };
    
    if (itemCount.count > 0) {
      return; // Already seeded
    }

    console.log('[RPGDatabaseSystem] Seeding initial item data...');

    // Seed items from data files
    const items = [
      // Weapons
      { id: 1, name: 'Bronze Sword', type: 'weapon', tier: 'bronze', attack_level: 1, attack_bonus: 4, strength_bonus: 2 },
      { id: 2, name: 'Steel Sword', type: 'weapon', tier: 'steel', attack_level: 10, attack_bonus: 8, strength_bonus: 4 },
      { id: 3, name: 'Mithril Sword', type: 'weapon', tier: 'mithril', attack_level: 20, attack_bonus: 12, strength_bonus: 6 },
      
      // Bows
      { id: 11, name: 'Wood Bow', type: 'weapon', tier: 'wood', ranged_level: 1, ranged_bonus: 4 },
      { id: 12, name: 'Oak Bow', type: 'weapon', tier: 'oak', ranged_level: 10, ranged_bonus: 8 },
      { id: 13, name: 'Willow Bow', type: 'weapon', tier: 'willow', ranged_level: 20, ranged_bonus: 12 },
      
      // Shields
      { id: 21, name: 'Bronze Shield', type: 'shield', tier: 'bronze', defense_level: 1, defense_bonus: 6 },
      { id: 22, name: 'Steel Shield', type: 'shield', tier: 'steel', defense_level: 10, defense_bonus: 12 },
      { id: 23, name: 'Mithril Shield', type: 'shield', tier: 'mithril', defense_level: 20, defense_bonus: 18 },
      
      // Helmets
      { id: 31, name: 'Leather Helmet', type: 'helmet', tier: 'leather', defense_level: 1, defense_bonus: 2 },
      { id: 32, name: 'Bronze Helmet', type: 'helmet', tier: 'bronze', defense_level: 1, defense_bonus: 4 },
      { id: 33, name: 'Steel Helmet', type: 'helmet', tier: 'steel', defense_level: 10, defense_bonus: 8 },
      { id: 34, name: 'Mithril Helmet', type: 'helmet', tier: 'mithril', defense_level: 20, defense_bonus: 12 },
      
      // Body armor
      { id: 41, name: 'Leather Body', type: 'body', tier: 'leather', defense_level: 1, defense_bonus: 6 },
      { id: 42, name: 'Bronze Body', type: 'body', tier: 'bronze', defense_level: 1, defense_bonus: 12 },
      { id: 43, name: 'Steel Body', type: 'body', tier: 'steel', defense_level: 10, defense_bonus: 24 },
      { id: 44, name: 'Mithril Body', type: 'body', tier: 'mithril', defense_level: 20, defense_bonus: 36 },
      
      // Leg armor
      { id: 51, name: 'Leather Legs', type: 'legs', tier: 'leather', defense_level: 1, defense_bonus: 4 },
      { id: 52, name: 'Bronze Legs', type: 'legs', tier: 'bronze', defense_level: 1, defense_bonus: 8 },
      { id: 53, name: 'Steel Legs', type: 'legs', tier: 'steel', defense_level: 10, defense_bonus: 16 },
      { id: 54, name: 'Mithril Legs', type: 'legs', tier: 'mithril', defense_level: 20, defense_bonus: 24 },
      
      // Tools
      { id: 61, name: 'Bronze Hatchet', type: 'tool', tier: 'bronze', woodcutting_level: 1 },
      { id: 62, name: 'Fishing Rod', type: 'tool', fishing_level: 1 },
      { id: 63, name: 'Tinderbox', type: 'tool', firemaking_level: 1 },
      
      // Ammunition
      { id: 71, name: 'Arrows', type: 'ammunition', stackable: 1, ranged_level: 1 },
      
      // Resources
      { id: 81, name: 'Logs', type: 'resource', stackable: 1 },
      { id: 82, name: 'Raw Fish', type: 'resource', stackable: 1 },
      { id: 83, name: 'Cooked Fish', type: 'food', stackable: 1, heals: 40 },
      
      // Currency
      { id: 91, name: 'Coins', type: 'currency', stackable: 1 }
    ];

    const insertItem = this.db.prepare(`
      INSERT INTO rpg_items (id, name, type, tier, stackable, attack_level, strength_level, 
                            defense_level, ranged_level, attack_bonus, strength_bonus, 
                            defense_bonus, ranged_bonus, heals)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        item.id, item.name, item.type, item.tier || null, item.stackable || 0,
        (item as any).attack_level || null, (item as any).strength_level || null, (item as any).defense_level || null,
        (item as any).ranged_level || null, (item as any).attack_bonus || 0, (item as any).strength_bonus || 0,
        (item as any).defense_bonus || 0, (item as any).ranged_bonus || 0, (item as any).heals || null
      );
    }

    console.log('[RPGDatabaseSystem] Initial data seeded successfully');
  }

  // Player Data Methods
  getPlayerData(playerId: string): RPGPlayerData | null {
    if (!this.db) throw new Error('Database not initialized');

    const player = this.db.prepare(`
      SELECT * FROM rpg_players WHERE hyperfy_player_id = ?
    `).get(playerId) as any;

    if (!player) return null;

    return {
      id: player.id,
      hyperfyPlayerId: player.hyperfy_player_id,
      name: player.name,
      skills: {
        attack: { level: player.attack_level, xp: player.attack_xp },
        strength: { level: player.strength_level, xp: player.strength_xp },
        defense: { level: player.defense_level, xp: player.defense_xp },
        ranged: { level: player.ranged_level, xp: player.ranged_xp },
        woodcutting: { level: player.woodcutting_level, xp: player.woodcutting_xp },
        fishing: { level: player.fishing_level, xp: player.fishing_xp },
        firemaking: { level: player.firemaking_level, xp: player.firemaking_xp },
        cooking: { level: player.cooking_level, xp: player.cooking_xp },
        constitution: { level: player.constitution_level, xp: player.constitution_xp }
      },
      health: {
        current: player.current_hitpoints,
        max: player.max_hitpoints
      },
      position: {
        x: player.position_x,
        y: player.position_y,
        z: player.position_z
      },
      alive: Boolean(player.alive)
    };
  }

  savePlayerData(playerId: string, data: Partial<RPGPlayerData>): void {
    if (!this.db) throw new Error('Database not initialized');

    const existingPlayer = this.getPlayerData(playerId);
    
    if (!existingPlayer) {
      // Create new player
      this.createNewPlayer(playerId, data);
    } else {
      // Update existing player
      this.updatePlayer(playerId, data);
    }
  }

  private createNewPlayer(playerId: string, data: Partial<RPGPlayerData>): void {
    if (!this.db) throw new Error('Database not initialized');

    const playerId_internal = `rpg_${playerId}_${Date.now()}`;
    
    this.db.prepare(`
      INSERT INTO rpg_players (
        id, hyperfy_player_id, name,
        attack_level, attack_xp, strength_level, strength_xp,
        defense_level, defense_xp, ranged_level, ranged_xp,
        woodcutting_level, woodcutting_xp, fishing_level, fishing_xp,
        firemaking_level, firemaking_xp, cooking_level, cooking_xp,
        constitution_level, constitution_xp,
        current_hitpoints, max_hitpoints,
        position_x, position_y, position_z, alive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      playerId_internal,
      playerId,
      data.name || 'Unknown Player',
      data.skills?.attack?.level || 1,
      data.skills?.attack?.xp || 0,
      data.skills?.strength?.level || 1,
      data.skills?.strength?.xp || 0,
      data.skills?.defense?.level || 1,
      data.skills?.defense?.xp || 0,
      data.skills?.ranged?.level || 1,
      data.skills?.ranged?.xp || 0,
      data.skills?.woodcutting?.level || 1,
      data.skills?.woodcutting?.xp || 0,
      data.skills?.fishing?.level || 1,
      data.skills?.fishing?.xp || 0,
      data.skills?.firemaking?.level || 1,
      data.skills?.firemaking?.xp || 0,
      data.skills?.cooking?.level || 1,
      data.skills?.cooking?.xp || 0,
      data.skills?.constitution?.level || 10,
      data.skills?.constitution?.xp || 1154,
      data.health?.current || 100,
      data.health?.max || 100,
      data.position?.x || 0,
      data.position?.y || 0,
      data.position?.z || 0,
      data.alive !== false ? 1 : 0
    );

    // Initialize starting equipment
    this.initializeStartingEquipment(playerId_internal);
  }

  private updatePlayer(playerId: string, data: Partial<RPGPlayerData>): void {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (data.skills) {
      Object.entries(data.skills).forEach(([skillName, skillData]) => {
        if (skillData) {
          updates.push(`${skillName}_level = ?`, `${skillName}_xp = ?`);
          values.push(skillData.level, skillData.xp);
        }
      });
    }

    if (data.health) {
      if (data.health.current !== undefined) {
        updates.push('current_hitpoints = ?');
        values.push(data.health.current);
      }
      if (data.health.max !== undefined) {
        updates.push('max_hitpoints = ?');
        values.push(data.health.max);
      }
    }

    if (data.position) {
      updates.push('position_x = ?', 'position_y = ?', 'position_z = ?');
      values.push(data.position.x, data.position.y, data.position.z);
    }

    if (data.alive !== undefined) {
      updates.push('alive = ?');
      values.push(data.alive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(playerId);

      this.db.prepare(`
        UPDATE rpg_players SET ${updates.join(', ')} WHERE hyperfy_player_id = ?
      `).run(...values);
    }
  }

  private initializeStartingEquipment(internalPlayerId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    // Give starting bronze sword
    this.db.prepare(`
      INSERT INTO rpg_equipment (player_id, slot_name, item_id, quantity)
      VALUES (?, 'weapon', 1, 1)
    `).run(internalPlayerId);

    console.log(`[RPGDatabaseSystem] Initialized starting equipment for player ${internalPlayerId}`);
  }

  // Inventory Methods
  getPlayerInventory(playerId: string): RPGInventoryItem[] {
    if (!this.db) throw new Error('Database not initialized');

    const playerData = this.getPlayerData(playerId);
    if (!playerData) return [];

    const items = this.db.prepare(`
      SELECT i.*, items.name, items.type, items.stackable 
      FROM rpg_inventory i 
      JOIN rpg_items items ON i.item_id = items.id 
      WHERE i.player_id = (SELECT id FROM rpg_players WHERE hyperfy_player_id = ?)
      ORDER BY i.slot_index
    `).all(playerId) as any[];

    return items.map(item => ({
      slotIndex: item.slot_index,
      itemId: item.item_id,
      quantity: item.quantity,
      itemData: item.item_data ? JSON.parse(item.item_data) : null,
      name: item.name,
      type: item.type,
      stackable: Boolean(item.stackable)
    }));
  }

  savePlayerInventory(playerId: string, inventory: RPGInventoryItem[]): void {
    if (!this.db) throw new Error('Database not initialized');

    const playerData = this.getPlayerData(playerId);
    if (!playerData) throw new Error('Player not found');

    // Clear existing inventory
    this.db.prepare(`
      DELETE FROM rpg_inventory WHERE player_id = (SELECT id FROM rpg_players WHERE hyperfy_player_id = ?)
    `).run(playerId);

    // Insert new inventory items
    const insertItem = this.db.prepare(`
      INSERT INTO rpg_inventory (player_id, slot_index, item_id, quantity, item_data)
      VALUES ((SELECT id FROM rpg_players WHERE hyperfy_player_id = ?), ?, ?, ?, ?)
    `);

    for (const item of inventory) {
      insertItem.run(
        playerId,
        item.slotIndex,
        item.itemId,
        item.quantity,
        item.itemData ? JSON.stringify(item.itemData) : null
      );
    }
  }

  // Equipment Methods
  getPlayerEquipment(playerId: string): RPGEquipmentSlot[] {
    if (!this.db) throw new Error('Database not initialized');

    const playerData = this.getPlayerData(playerId);
    if (!playerData) return [];

    const equipment = this.db.prepare(`
      SELECT e.*, items.name, items.type 
      FROM rpg_equipment e 
      LEFT JOIN rpg_items items ON e.item_id = items.id 
      WHERE e.player_id = (SELECT id FROM rpg_players WHERE hyperfy_player_id = ?)
    `).all(playerId) as any[];

    return equipment.map(item => ({
      slotName: item.slot_name,
      itemId: item.item_id,
      quantity: item.quantity,
      itemData: item.item_data ? JSON.parse(item.item_data) : null,
      name: item.name,
      type: item.type
    }));
  }

  savePlayerEquipment(playerId: string, equipment: RPGEquipmentSlot[]): void {
    if (!this.db) throw new Error('Database not initialized');

    const playerData = this.getPlayerData(playerId);
    if (!playerData) throw new Error('Player not found');

    // Use upsert for equipment
    const upsertEquipment = this.db.prepare(`
      INSERT INTO rpg_equipment (player_id, slot_name, item_id, quantity, item_data)
      VALUES ((SELECT id FROM rpg_players WHERE hyperfy_player_id = ?), ?, ?, ?, ?)
      ON CONFLICT(player_id, slot_name) DO UPDATE SET
        item_id = excluded.item_id,
        quantity = excluded.quantity,
        item_data = excluded.item_data,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const item of equipment) {
      upsertEquipment.run(
        playerId,
        item.slotName,
        item.itemId,
        item.quantity,
        item.itemData ? JSON.stringify(item.itemData) : null
      );
    }
  }

  // Item Methods
  getItem(itemId: number): RPGItem | null {
    if (!this.db) throw new Error('Database not initialized');

    const item = this.db.prepare('SELECT * FROM rpg_items WHERE id = ?').get(itemId) as any;
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      description: item.description || '',
      type: item.type,
      stackable: Boolean(item.stackable),
      maxStack: item.max_stack || 1,
      value: item.value || 0,
      weight: item.weight || 0,
      requirements: {
        attack: item.attack_level,
        strength: item.strength_level,
        defense: item.defense_level,
        ranged: item.ranged_level
      },
      bonuses: {
        attack: item.attack_bonus,
        strength: item.strength_bonus,
        defense: item.defense_bonus,
        ranged: item.ranged_bonus
      },
      weaponType: item.weapon_type,
      armorSlot: item.armor_slot,
      modelPath: item.model_path,
      iconPath: item.icon_path,
      healAmount: item.heals,
      restoreAmount: item.restore_amount,
      consumeOnUse: Boolean(item.consume_on_use)
    };
  }

  getAllItems(): RPGItem[] {
    if (!this.db) throw new Error('Database not initialized');

    const items = this.db.prepare('SELECT * FROM rpg_items ORDER BY id').all() as any[];
    
    return items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      type: item.type,
      stackable: Boolean(item.stackable),
      maxStack: item.max_stack || 1,
      value: item.value || 0,
      weight: item.weight || 0,
      requirements: {
        attack: item.attack_level,
        strength: item.strength_level,
        defense: item.defense_level,
        ranged: item.ranged_level
      },
      bonuses: {
        attack: item.attack_bonus,
        strength: item.strength_bonus,
        defense: item.defense_bonus,
        ranged: item.ranged_bonus
      },
      weaponType: item.weapon_type,
      armorSlot: item.armor_slot,
      modelPath: item.model_path,
      iconPath: item.icon_path,
      healAmount: item.heals,
      restoreAmount: item.restore_amount,
      consumeOnUse: Boolean(item.consume_on_use)
    }));
  }

  // World Chunk Persistence Methods
  getWorldChunk(chunkX: number, chunkZ: number): RPGWorldChunk | null {
    if (!this.db) throw new Error('Database not initialized');

    const chunk = this.db.prepare(`
      SELECT * FROM rpg_world_chunks WHERE chunk_x = ? AND chunk_z = ?
    `).get(chunkX, chunkZ) as any;

    if (!chunk) return null;

    return {
      chunkX: chunk.chunk_x,
      chunkZ: chunk.chunk_z,
      biome: chunk.biome,
      heightData: chunk.height_data ? JSON.parse(chunk.height_data) : null,
      resourceStates: chunk.resource_states ? JSON.parse(chunk.resource_states) : {},
      mobSpawnStates: chunk.mob_spawn_states ? JSON.parse(chunk.mob_spawn_states) : {},
      playerModifications: chunk.player_modifications ? JSON.parse(chunk.player_modifications) : {},
      chunkSeed: chunk.chunk_seed,
      lastActiveTime: chunk.last_active_time ? new Date(chunk.last_active_time) : null,
      playerCount: chunk.player_count,
      needsReset: Boolean(chunk.needs_reset),
      createdAt: new Date(chunk.created_at),
      updatedAt: new Date(chunk.updated_at)
    };
  }

  saveWorldChunk(chunkData: RPGWorldChunk): void {
    if (!this.db) throw new Error('Database not initialized');

    const upsertChunk = this.db.prepare(`
      INSERT INTO rpg_world_chunks (
        chunk_x, chunk_z, biome, height_data, resource_states, 
        mob_spawn_states, player_modifications, chunk_seed, 
        last_active_time, player_count, needs_reset, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chunk_x, chunk_z) DO UPDATE SET
        biome = excluded.biome,
        height_data = excluded.height_data,
        resource_states = excluded.resource_states,
        mob_spawn_states = excluded.mob_spawn_states,
        player_modifications = excluded.player_modifications,
        chunk_seed = excluded.chunk_seed,
        last_active_time = excluded.last_active_time,
        player_count = excluded.player_count,
        needs_reset = excluded.needs_reset,
        updated_at = excluded.updated_at
    `);

    upsertChunk.run(
      chunkData.chunkX,
      chunkData.chunkZ,
      chunkData.biome,
      JSON.stringify(chunkData.heightData),
      JSON.stringify(chunkData.resourceStates),
      JSON.stringify(chunkData.mobSpawnStates),
      JSON.stringify(chunkData.playerModifications),
      chunkData.chunkSeed,
      chunkData.lastActiveTime?.toISOString() || null,
      chunkData.playerCount,
      chunkData.needsReset ? 1 : 0,
      new Date().toISOString()
    );
  }

  getInactiveChunks(inactiveMinutes: number = 15): RPGWorldChunk[] {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000).toISOString();
    
    const chunks = this.db.prepare(`
      SELECT * FROM rpg_world_chunks 
      WHERE (last_active_time IS NULL OR last_active_time < ?) 
      AND player_count = 0
      AND needs_reset = 0
    `).all(cutoffTime) as any[];

    return chunks.map(chunk => ({
      chunkX: chunk.chunk_x,
      chunkZ: chunk.chunk_z,
      biome: chunk.biome,
      heightData: chunk.height_data ? JSON.parse(chunk.height_data) : null,
      resourceStates: chunk.resource_states ? JSON.parse(chunk.resource_states) : {},
      mobSpawnStates: chunk.mob_spawn_states ? JSON.parse(chunk.mob_spawn_states) : {},
      playerModifications: chunk.player_modifications ? JSON.parse(chunk.player_modifications) : {},
      chunkSeed: chunk.chunk_seed,
      lastActiveTime: chunk.last_active_time ? new Date(chunk.last_active_time) : null,
      playerCount: chunk.player_count,
      needsReset: Boolean(chunk.needs_reset),
      createdAt: new Date(chunk.created_at),
      updatedAt: new Date(chunk.updated_at)
    }));
  }

  markChunkForReset(chunkX: number, chunkZ: number): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      UPDATE rpg_world_chunks 
      SET needs_reset = 1, updated_at = ? 
      WHERE chunk_x = ? AND chunk_z = ?
    `).run(new Date().toISOString(), chunkX, chunkZ);
  }

  resetChunk(chunkX: number, chunkZ: number): void {
    if (!this.db) throw new Error('Database not initialized');

    // Delete the chunk - it will be regenerated when needed
    this.db.prepare(`
      DELETE FROM rpg_world_chunks WHERE chunk_x = ? AND chunk_z = ?
    `).run(chunkX, chunkZ);

    // Clean up related chunk activity records
    this.db.prepare(`
      DELETE FROM rpg_chunk_activity WHERE chunk_x = ? AND chunk_z = ?
    `).run(chunkX, chunkZ);

    console.log(`[RPGDatabaseSystem] Reset chunk (${chunkX}, ${chunkZ})`);
  }

  updateChunkPlayerCount(chunkX: number, chunkZ: number, playerCount: number): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      UPDATE rpg_world_chunks 
      SET player_count = ?, last_active_time = ?, updated_at = ?
      WHERE chunk_x = ? AND chunk_z = ?
    `).run(
      playerCount, 
      new Date().toISOString(), 
      new Date().toISOString(), 
      chunkX, 
      chunkZ
    );
  }

  // Player Session Management
  createPlayerSession(sessionData: Omit<RPGPlayerSession, 'id'>): string {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      INSERT INTO rpg_player_sessions (
        session_id, player_id, player_token, start_time, 
        last_activity, auto_save_interval, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionData.sessionId,
      sessionData.playerId,
      sessionData.playerToken,
      sessionData.startTime.toISOString(),
      sessionData.lastActivity.toISOString(),
      sessionData.autoSaveInterval,
      sessionData.isActive ? 1 : 0
    );

    return sessionData.sessionId;
  }

  updatePlayerSession(sessionId: string, updates: Partial<RPGPlayerSession>): void {
    if (!this.db) throw new Error('Database not initialized');

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.lastActivity) {
      updateFields.push('last_activity = ?');
      values.push(updates.lastActivity.toISOString());
    }

    if (updates.lastSaveTime) {
      updateFields.push('last_save_time = ?');
      values.push(updates.lastSaveTime.toISOString());
    }

    if (updates.isActive !== undefined) {
      updateFields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    if (updates.endTime) {
      updateFields.push('end_time = ?');
      values.push(updates.endTime.toISOString());
    }

    if (updates.disconnectReason) {
      updateFields.push('disconnect_reason = ?');
      values.push(updates.disconnectReason);
    }

    if (updateFields.length > 0) {
      values.push(sessionId);
      this.db.prepare(`
        UPDATE rpg_player_sessions SET ${updateFields.join(', ')} WHERE session_id = ?
      `).run(...values);
    }
  }

  getActivePlayerSessions(): RPGPlayerSession[] {
    if (!this.db) throw new Error('Database not initialized');

    const sessions = this.db.prepare(`
      SELECT * FROM rpg_player_sessions WHERE is_active = 1
    `).all() as any[];

    return sessions.map(session => ({
      sessionId: session.session_id,
      playerId: session.player_id,
      playerToken: session.player_token,
      startTime: new Date(session.start_time),
      endTime: session.end_time ? new Date(session.end_time) : undefined,
      lastActivity: new Date(session.last_activity),
      lastSaveTime: new Date(session.last_save_time),
      autoSaveInterval: session.auto_save_interval,
      isActive: Boolean(session.is_active),
      disconnectReason: session.disconnect_reason
    }));
  }

  endPlayerSession(sessionId: string, reason?: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare(`
      UPDATE rpg_player_sessions 
      SET is_active = 0, end_time = ?, disconnect_reason = ?
      WHERE session_id = ?
    `).run(new Date().toISOString(), reason || 'normal', sessionId);
  }

  // Chunk Activity Tracking
  recordChunkEntry(chunkX: number, chunkZ: number, playerId: string): number {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.prepare(`
      INSERT INTO rpg_chunk_activity (chunk_x, chunk_z, player_id, entered_at)
      VALUES (?, ?, ?, ?)
    `).run(chunkX, chunkZ, playerId, new Date().toISOString());

    // Update chunk player count
    this.updateChunkPlayerCount(chunkX, chunkZ, this.getChunkPlayerCount(chunkX, chunkZ));

    return result.lastInsertRowid as number;
  }

  recordChunkExit(activityId: number): void {
    if (!this.db) throw new Error('Database not initialized');

    const activity = this.db.prepare(`
      SELECT * FROM rpg_chunk_activity WHERE id = ?
    `).get(activityId) as any;

    if (activity && !activity.left_at) {
      const sessionDuration = Date.now() - new Date(activity.entered_at).getTime();
      
      this.db.prepare(`
        UPDATE rpg_chunk_activity 
        SET left_at = ?, session_duration = ?
        WHERE id = ?
      `).run(new Date().toISOString(), Math.floor(sessionDuration / 1000), activityId);

      // Update chunk player count
      this.updateChunkPlayerCount(activity.chunk_x, activity.chunk_z, 
        this.getChunkPlayerCount(activity.chunk_x, activity.chunk_z));
    }
  }

  getChunkPlayerCount(chunkX: number, chunkZ: number): number {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM rpg_chunk_activity 
      WHERE chunk_x = ? AND chunk_z = ? AND left_at IS NULL
    `).get(chunkX, chunkZ) as { count: number };

    return result.count;
  }

  // Database Maintenance
  cleanupOldSessions(daysOld: number = 7): number {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    
    const result = this.db.prepare(`
      DELETE FROM rpg_player_sessions 
      WHERE is_active = 0 AND (end_time < ? OR start_time < ?)
    `).run(cutoffDate, cutoffDate);

    return result.changes;
  }

  cleanupOldChunkActivity(daysOld: number = 30): number {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    
    const result = this.db.prepare(`
      DELETE FROM rpg_chunk_activity WHERE entered_at < ?
    `).run(cutoffDate);

    return result.changes;
  }

  // Performance monitoring
  getDatabaseStats(): {
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  } {
    if (!this.db) throw new Error('Database not initialized');

    const playerCount = this.db.prepare('SELECT COUNT(*) as count FROM rpg_players').get() as { count: number };
    const activeSessionCount = this.db.prepare('SELECT COUNT(*) as count FROM rpg_player_sessions WHERE is_active = 1').get() as { count: number };
    const chunkCount = this.db.prepare('SELECT COUNT(*) as count FROM rpg_world_chunks').get() as { count: number };
    const activeChunkCount = this.db.prepare('SELECT COUNT(*) as count FROM rpg_world_chunks WHERE player_count > 0').get() as { count: number };
    const activityCount = this.db.prepare('SELECT COUNT(*) as count FROM rpg_chunk_activity').get() as { count: number };

    return {
      playerCount: playerCount.count,
      activeSessionCount: activeSessionCount.count,
      chunkCount: chunkCount.count,
      activeChunkCount: activeChunkCount.count,
      totalActivityRecords: activityCount.count
    };
  }
}