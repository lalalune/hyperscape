import { StorageConfig } from './HyperfyFramework';
import { Storage } from '../server/Storage';
import fs from 'fs-extra';
import path from 'path';

/**
 * Manages storage for the Hyperfy framework
 */
export class StorageManager {
  private config: StorageConfig;
  private globalStorage: Storage | undefined;
  private worldStorages: Map<string, Storage> = new Map();

  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Initialize the storage manager
   */
  async initialize(): Promise<void> {
    if (this.config.type === 'file') {
      const storagePath = this.config.path || './storage/global.json';
      await fs.ensureDir(path.dirname(storagePath));
      this.globalStorage = new Storage(storagePath);
    } else {
      // Memory storage - implement as needed
      this.globalStorage = new Storage(':memory:');
    }
  }

  /**
   * Get global storage
   */
  getGlobalStorage(): Storage {
    if (!this.globalStorage) {
      throw new Error('Storage manager not initialized');
    }
    return this.globalStorage;
  }

  /**
   * Get world-specific storage
   */
  getWorldStorage(worldId: string): Storage {
    if (!this.worldStorages.has(worldId)) {
      let storagePath: string;
      
      if (this.config.type === 'file') {
        const baseDir = this.config.path ? path.dirname(this.config.path) : './storage';
        storagePath = path.join(baseDir, `world-${worldId}.json`);
      } else {
        storagePath = `:memory:${worldId}`;
      }
      
      const storage = new Storage(storagePath);
      this.worldStorages.set(worldId, storage);
    }
    
    return this.worldStorages.get(worldId)!;
  }

  /**
   * Remove world storage
   */
  async removeWorldStorage(worldId: string): Promise<void> {
    const storage = this.worldStorages.get(worldId);
    if (storage) {
      // Persist any remaining data
      await storage.persist();
      this.worldStorages.delete(worldId);
    }
  }

  /**
   * Shutdown the storage manager
   */
  async shutdown(): Promise<void> {
    // Persist all storages
    if (this.globalStorage) {
      await this.globalStorage.persist();
    }
    
    for (const storage of this.worldStorages.values()) {
      await storage.persist();
    }
    
    this.worldStorages.clear();
  }
}