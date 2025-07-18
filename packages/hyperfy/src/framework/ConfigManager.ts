import { HyperfyFrameworkOptions } from './HyperfyFramework';
import fs from 'fs-extra';
import path from 'path';

/**
 * Manages configuration for the Hyperfy framework
 */
export class ConfigManager {
  private options: HyperfyFrameworkOptions;
  private config: Record<string, any> = {};

  constructor(options: HyperfyFrameworkOptions) {
    this.options = options;
  }

  /**
   * Get the worlds directory
   */
  getWorldsDirectory(): string {
    return this.options.worldsDir || './worlds';
  }

  /**
   * Get the assets directory
   */
  getAssetsDirectory(): string {
    return this.options.assetsDir || './assets';
  }

  /**
   * Get a configuration value
   */
  get<T = any>(key: string, defaultValue?: T): T {
    return this.config[key] ?? defaultValue;
  }

  /**
   * Set a configuration value
   */
  set(key: string, value: any): void {
    this.config[key] = value;
  }

  /**
   * Load configuration from file
   */
  async loadConfig(configPath: string): Promise<void> {
    if (await fs.exists(configPath)) {
      try {
        const config = await fs.readJson(configPath);
        this.config = { ...this.config, ...config };
      } catch (error) {
        console.error(`Failed to load config from ${configPath}:`, error);
      }
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(configPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, this.config, { spaces: 2 });
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * Clear all configuration
   */
  clear(): void {
    this.config = {};
  }
}