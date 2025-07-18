import { EventEmitter } from 'eventemitter3';
import { World } from '../core/World';
import { createServerWorld } from '../core/createServerWorld';
import { createClientWorld } from '../core/createClientWorld';
import { createViewerWorld } from '../core/createViewerWorld';
import { ConfigManager } from './ConfigManager';
import { StorageManager } from './StorageManager';
import { databaseManager } from './DatabaseManager';
import { WorldConfig, WorldInfo } from './HyperfyFramework';
import fs from 'fs-extra';
import path from 'path';

/**
 * Manages multiple worlds within the Hyperfy framework
 */
export class WorldManager extends EventEmitter {
  private worlds: Map<string, World> = new Map();
  private worldConfigs: Map<string, WorldConfig> = new Map();
  private worldTimers: Map<string, NodeJS.Timeout> = new Map();
  private framework: any; // HyperfyFramework reference
  private configManager: ConfigManager;
  private storageManager: StorageManager;

  constructor(framework: any, configManager: ConfigManager, storageManager: StorageManager) {
    super();
    this.framework = framework;
    this.configManager = configManager;
    this.storageManager = storageManager;
  }

  /**
   * Initialize the world manager
   */
  async initialize(): Promise<void> {
    // Load existing world configurations
    await this.loadWorldConfigurations();
    
    this.emit('initialized');
  }

  /**
   * Create a new world
   */
  async createWorld(config: WorldConfig): Promise<World> {
    if (this.worlds.has(config.id)) {
      throw new Error(`World with id '${config.id}' already exists`);
    }

    // Validate configuration
    this.validateWorldConfig(config);

    // Create world instance based on type
    let world: World;
    switch (config.type) {
      case 'server':
        world = createServerWorld();
        break;
      case 'client':
        world = createClientWorld();
        break;
      case 'viewer':
        world = createViewerWorld();
        break;
      default:
        throw new Error(`Unknown world type: ${config.type}`);
    }

    // Set up world directories
    await this.setupWorldDirectories(config);

    // Configure world
    await this.configureWorld(world, config);

    // Store world and config
    this.worlds.set(config.id, world);
    this.worldConfigs.set(config.id, config);

    // Save configuration
    await this.saveWorldConfiguration(config);

    // Start world if it's a server
    if (config.type === 'server') {
      await this.startWorld(config.id);
    }

    this.emit('worldCreated', { worldId: config.id, config });
    
    return world;
  }

  /**
   * Get a world by ID
   */
  getWorld(worldId: string): World | undefined {
    return this.worlds.get(worldId);
  }

  /**
   * List all worlds
   */
  listWorlds(): WorldInfo[] {
    const worlds: WorldInfo[] = [];
    
    for (const [id, world] of this.worlds) {
      const config = this.worldConfigs.get(id);
      if (config) {
        worlds.push({
          id,
          name: config.name,
          type: config.type,
          status: 'running', // TODO: implement proper status tracking
          uptime: world.time,
          players: this.getWorldPlayerCount(world),
          config
        });
      }
    }
    
    return worlds;
  }

  /**
   * Destroy a world
   */
  async destroyWorld(worldId: string): Promise<void> {
    const world = this.worlds.get(worldId);
    if (!world) {
      throw new Error(`World '${worldId}' not found`);
    }

    // Stop world timer
    const timer = this.worldTimers.get(worldId);
    if (timer) {
      clearInterval(timer);
      this.worldTimers.delete(worldId);
    }

    // Destroy world
    world.destroy();

    // Remove from maps
    this.worlds.delete(worldId);
    this.worldConfigs.delete(worldId);

    this.emit('worldDestroyed', { worldId });
  }

  /**
   * Start a world's update loop
   */
  private async startWorld(worldId: string): Promise<void> {
    const world = this.worlds.get(worldId);
    if (!world) {
      throw new Error(`World '${worldId}' not found`);
    }

    // Start update loop
    const timer = setInterval(() => {
      const now = performance.now();
      world.tick(now);
    }, 1000 / 60); // 60 FPS

    this.worldTimers.set(worldId, timer);
  }

  /**
   * Validate world configuration
   */
  private validateWorldConfig(config: WorldConfig): void {
    if (!config.id || typeof config.id !== 'string') {
      throw new Error('World config must have a valid id');
    }
    
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('World config must have a valid name');
    }
    
    if (!['server', 'client', 'viewer'].includes(config.type)) {
      throw new Error('World type must be server, client, or viewer');
    }
  }

  /**
   * Set up world directories
   */
  private async setupWorldDirectories(config: WorldConfig): Promise<void> {
    const worldDir = this.getWorldDirectory(config.id);
    const assetsDir = path.join(worldDir, 'assets');
    const collectionsDir = path.join(worldDir, 'collections');

    // Create directories
    await fs.ensureDir(worldDir);
    await fs.ensureDir(assetsDir);
    await fs.ensureDir(collectionsDir);

    // Copy default assets if they don't exist
    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    const defaultAssetsDir = path.join(currentDir, '../world/assets');
    const defaultCollectionsDir = path.join(currentDir, '../world/collections');
    
    if (await fs.exists(defaultAssetsDir)) {
      await fs.copy(defaultAssetsDir, assetsDir);
    }
    
    if (await fs.exists(defaultCollectionsDir)) {
      await fs.copy(defaultCollectionsDir, collectionsDir);
    }
  }

  /**
   * Configure a world with the given configuration
   */
  private async configureWorld(world: World, config: WorldConfig): Promise<void> {
    const worldDir = this.getWorldDirectory(config.id);
    const assetsDir = path.join(worldDir, 'assets');
    
    // Set up world options
    const worldOptions = {
      assetsDir,
      assetsUrl: config.assets?.baseUrl || '/assets/',
      storage: this.storageManager.getWorldStorage(config.id),
      db: config.persistence ? await this.createDatabase(config) : undefined
    };

    // Initialize world
    await world.init(worldOptions);

    // Set world ID
    (world as any).id = config.id;

    // Apply settings
    if (config.settings) {
      Object.assign(world.settings, config.settings);
    }
  }

  /**
   * Create database for world
   */
  private async createDatabase(config: WorldConfig): Promise<any> {
    if (!config.persistence) {
      return undefined;
    }

    if (config.persistence.type === 'sqlite') {
      const dbPath = config.persistence.path || 
        path.join(this.getWorldDirectory(config.id), 'db.sqlite');
      return await databaseManager.getDatabase(dbPath);
    }

    return undefined;
  }

  /**
   * Get world directory path
   */
  private getWorldDirectory(worldId: string): string {
    return path.join(this.configManager.getWorldsDirectory(), worldId);
  }

  /**
   * Get player count for a world
   */
  private getWorldPlayerCount(world: World): number {
    // TODO: implement proper player counting
    return 0;
  }

  /**
   * Load world configurations from disk
   */
  private async loadWorldConfigurations(): Promise<void> {
    const worldsDir = this.configManager.getWorldsDirectory();
    
    if (!(await fs.exists(worldsDir))) {
      return;
    }

    const worldDirs = await fs.readdir(worldsDir);
    
    for (const worldDir of worldDirs) {
      const worldPath = path.join(worldsDir, worldDir);
      const configPath = path.join(worldPath, 'world.json');
      
      if (await fs.exists(configPath)) {
        try {
          const config = await fs.readJson(configPath);
          this.worldConfigs.set(config.id, config);
        } catch (error) {
          console.error(`Failed to load world config from ${configPath}:`, error);
        }
      }
    }
  }

  /**
   * Save world configuration to disk
   */
  private async saveWorldConfiguration(config: WorldConfig): Promise<void> {
    const worldDir = this.getWorldDirectory(config.id);
    const configPath = path.join(worldDir, 'world.json');
    
    await fs.ensureDir(worldDir);
    await fs.writeJson(configPath, config, { spaces: 2 });
  }

  /**
   * Shutdown the world manager
   */
  async shutdown(): Promise<void> {
    // Stop all world timers
    for (const timer of this.worldTimers.values()) {
      clearInterval(timer);
    }
    this.worldTimers.clear();

    // Destroy all worlds
    for (const world of this.worlds.values()) {
      world.destroy();
    }
    this.worlds.clear();
    this.worldConfigs.clear();

    // Close all database connections
    await databaseManager.closeAllDatabases();

    this.emit('shutdown');
  }
}