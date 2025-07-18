import { EventEmitter } from 'eventemitter3';
import { createServerWorld } from '../core/createServerWorld';
import { createClientWorld } from '../core/createClientWorld';
import { World } from '../core/World';
import { WorldManager } from './WorldManager';
import { ConfigManager } from './ConfigManager';
import { StorageManager } from './StorageManager';

export interface HyperfyFrameworkOptions {
  /** Base directory for worlds */
  worldsDir?: string;
  /** Base directory for assets */
  assetsDir?: string;
  /** Default world configuration */
  defaultWorldConfig?: WorldConfig;
  /** Framework-level storage options */
  storage?: StorageConfig;
}

export interface WorldConfig {
  id: string;
  name: string;
  type: 'server' | 'client' | 'viewer';
  persistence?: PersistenceConfig;
  assets?: AssetConfig;
  systems?: SystemConfig[];
  settings?: Record<string, any>;
}

export interface PersistenceConfig {
  type: 'sqlite' | 'memory';
  path?: string;
  options?: Record<string, any>;
}

export interface AssetConfig {
  baseUrl?: string;
  localPath?: string;
  cacheSize?: number;
}

export interface SystemConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface StorageConfig {
  type: 'file' | 'memory';
  path?: string;
}

/**
 * Main Hyperfy Framework class
 * Provides a high-level API for creating and managing virtual worlds
 */
export class HyperfyFramework extends EventEmitter {
  private worldManager: WorldManager;
  private configManager: ConfigManager;
  private storageManager: StorageManager;
  private options: HyperfyFrameworkOptions;

  constructor(options: HyperfyFrameworkOptions = {}) {
    super();
    
    this.options = {
      worldsDir: options.worldsDir || './worlds',
      assetsDir: options.assetsDir || './assets',
      storage: options.storage || { type: 'file' },
      ...options
    };

    this.configManager = new ConfigManager(this.options);
    this.storageManager = new StorageManager(this.options.storage!);
    this.worldManager = new WorldManager(this, this.configManager, this.storageManager);
  }

  /**
   * Initialize the framework
   */
  async initialize(): Promise<void> {
    await this.storageManager.initialize();
    await this.worldManager.initialize();
    
    this.emit('initialized');
  }

  /**
   * Create a new world
   */
  async createWorld(config: WorldConfig): Promise<World> {
    return await this.worldManager.createWorld(config);
  }

  /**
   * Get an existing world
   */
  getWorld(worldId: string): World | undefined {
    return this.worldManager.getWorld(worldId);
  }

  /**
   * List all worlds
   */
  listWorlds(): WorldInfo[] {
    return this.worldManager.listWorlds();
  }

  /**
   * Destroy a world
   */
  async destroyWorld(worldId: string): Promise<void> {
    await this.worldManager.destroyWorld(worldId);
  }

  /**
   * Get the world manager
   */
  getWorldManager(): WorldManager {
    return this.worldManager;
  }

  /**
   * Get the config manager
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get the storage manager
   */
  getStorageManager(): StorageManager {
    return this.storageManager;
  }

  /**
   * Shutdown the framework
   */
  async shutdown(): Promise<void> {
    await this.worldManager.shutdown();
    await this.storageManager.shutdown();
    
    this.emit('shutdown');
  }
}

export interface WorldInfo {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  players: number;
  config: WorldConfig;
}