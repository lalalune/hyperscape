/**
 * Configuration system for Hyperfy
 * Handles environment-based settings and removes hardcoded values
 */

import { ENV } from './env';

export interface HyperfyConfig {
  assetsUrl: string
  assetsDir: string | null
  isProduction: boolean
  isDevelopment: boolean
  isTest: boolean
  networkRate: number
  maxDeltaTime: number
  fixedDeltaTime: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  physics: {
    enabled: boolean
    gravity: { x: number; y: number; z: number }
  }
}

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: HyperfyConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfiguration(): HyperfyConfig {
    const isProduction = ENV.PROD;
    const isDevelopment = ENV.DEV;
    const isTest = ENV.TEST;

    return {
      // Asset configuration - no more hardcoded localhost!
      assetsUrl:
        ENV.HYPERFY_ASSETS_URL || (isProduction ? 'https://assets.hyperfy.io/' : 'https://test-assets.hyperfy.io/'),
      assetsDir: ENV.HYPERFY_ASSETS_DIR || (isTest ? './world/assets' : null),

      // Environment flags
      isProduction,
      isDevelopment,
      isTest,

      // Network configuration
      networkRate: parseFloat(ENV.HYPERFY_NETWORK_RATE || '8'),
      maxDeltaTime: parseFloat(ENV.HYPERFY_MAX_DELTA_TIME || String(1 / 30)),
      fixedDeltaTime: parseFloat(ENV.HYPERFY_FIXED_DELTA_TIME || String(1 / 60)),

      // Logging configuration
      logLevel: (ENV.HYPERFY_LOG_LEVEL || (isProduction ? 'warn' : 'info')) as any,

      // Physics configuration
      physics: {
        enabled: ENV.HYPERFY_PHYSICS_ENABLED === 'true',
        gravity: {
          x: parseFloat(ENV.HYPERFY_GRAVITY_X || '0'),
          y: parseFloat(ENV.HYPERFY_GRAVITY_Y || '-9.81'),
          z: parseFloat(ENV.HYPERFY_GRAVITY_Z || '0'),
        },
      },
    };
  }

  get(): HyperfyConfig {
    return this.config;
  }

  /**
   * Get a specific configuration value
   */
  getValue<K extends keyof HyperfyConfig>(key: K): HyperfyConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration (mainly for testing)
   */
  update(updates: Partial<HyperfyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = this.loadConfiguration();
  }
}

// Export singleton instance
export const Config = ConfigurationManager.getInstance();
