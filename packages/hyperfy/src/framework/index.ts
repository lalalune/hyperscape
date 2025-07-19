/**
 * Hyperfy Framework
 * 
 * Provides a high-level API for creating and managing virtual worlds
 */

export { HyperfyFramework } from './HyperfyFramework';
export { WorldManager } from './WorldManager';
export { ConfigManager } from './ConfigManager';
export { StorageManager } from './StorageManager';

export type {
  HyperfyFrameworkOptions,
  WorldConfig,
  WorldInfo,
  PersistenceConfig,
  AssetConfig,
  SystemConfig,
  StorageConfig
} from './HyperfyFramework';

// Note: World, System, and create functions are exported from main index.ts
// to avoid duplicate exports and conflicts