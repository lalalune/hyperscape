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

// Re-export core types for convenience
export { World } from '../core/World';
export { System } from '../core/systems/System';

// Convenience functions
export { createServerWorld } from '../core/createServerWorld';
export { createClientWorld } from '../core/createClientWorld';
export { createViewerWorld } from '../core/createViewerWorld';