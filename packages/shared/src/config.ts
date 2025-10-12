/**
 * Configuration system for Hyperscape
 * Handles environment-based settings and removes hardcoded values
 */

export interface HyperscapeConfig {
  assetsUrl: string;
  assetsDir: string | null;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  networkRate: number;
  maxDeltaTime: number;
  fixedDeltaTime: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  physics: {
    enabled: boolean;
    gravity: { x: number; y: number; z: number }
  };
}

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: HyperscapeConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfiguration(): HyperscapeConfig {
    const env = process.env.NODE_ENV || 'development';
    const isProduction = env === 'production';
    const isDevelopment = env === 'development';
    const isTest = env === 'test' || process.env.VITEST === 'true';

    return {
      // Asset configuration - no more hardcoded localhost!
      assetsUrl: process.env.HYPERSCAPE_ASSETS_URL || 
                 (isProduction ? 'https://assets.hyperscape.io/' : 'https://test-assets.hyperscape.io/'),
      assetsDir: process.env.HYPERSCAPE_ASSETS_DIR || (isTest ? './world/assets' : null),
      
      // Environment flags
      isProduction,
      isDevelopment,
      isTest,
      
      // Network configuration
      networkRate: parseFloat(process.env.HYPERSCAPE_NETWORK_RATE || '8'),
      maxDeltaTime: parseFloat(process.env.HYPERSCAPE_MAX_DELTA_TIME || String(1/30)),
      fixedDeltaTime: parseFloat(process.env.HYPERSCAPE_FIXED_DELTA_TIME || String(1/30)),
      
      // Logging configuration
      logLevel: (process.env.HYPERSCAPE_LOG_LEVEL || (isProduction ? 'warn' : 'info')) as 'debug' | 'info' | 'warn' | 'error',
      
      // Physics configuration
      physics: {
        enabled: process.env.HYPERSCAPE_PHYSICS_ENABLED !== 'false',
        gravity: {
          x: parseFloat(process.env.HYPERSCAPE_GRAVITY_X || '0'),
          y: parseFloat(process.env.HYPERSCAPE_GRAVITY_Y || '-9.81'),
          z: parseFloat(process.env.HYPERSCAPE_GRAVITY_Z || '0')
        }
      }
    };
  }

  get(): HyperscapeConfig {
    return this.config;
  }

  /**
   * Get a specific configuration value
   */
  getValue<K extends keyof HyperscapeConfig>(key: K): HyperscapeConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration (mainly for testing)
   */
  update(updates: Partial<HyperscapeConfig>): void {
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