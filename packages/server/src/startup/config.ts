/**
 * Configuration Module - Environment and path resolution
 *
 * Centralizes all environment variable loading and path resolution for the server.
 * Ensures consistent configuration across all server modules.
 *
 * Responsibilities:
 * - Load environment variables from .env files
 * - Resolve file paths for assets, world data, and build outputs
 * - Create necessary directories
 * - Copy built-in assets if needed
 * - Export typed configuration object
 *
 * Usage:
 * ```typescript
 * const config = await loadConfig();
 * console.log(config.port, config.worldDir, config.assetsDir);
 * ```
 */

import dotenv from "dotenv";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Server configuration interface
 * Contains all paths, ports, and settings needed by server modules
 */
export interface ServerConfig {
  /** Server HTTP port */
  port: number;

  /** World data directory path */
  worldDir: string;

  /** Assets directory path (models, music, textures) */
  assetsDir: string;

  /** Hyperscape root directory */
  hyperscapeRoot: string;

  /** Built-in assets directory */
  builtInAssetsDir: string;

  /** Package root directory (for public/ and world/ access) */
  __dirname: string;

  /** Use local PostgreSQL via Docker */
  useLocalPostgres: boolean;

  /** Explicit database URL (overrides Docker) */
  databaseUrl?: string;

  /** CDN base URL for assets */
  cdnUrl: string;

  /** Assets URL (CDN + trailing slash) */
  assetsUrl: string;

  /** System plugins path */
  systemsPath?: string;

  /** Admin code for protected endpoints */
  adminCode?: string;

  /** JWT secret for token signing */
  jwtSecret?: string;

  /** Auto-save interval in seconds */
  saveInterval: number;

  /** Node environment */
  nodeEnv: string;

  /** Commit hash for deployment tracking */
  commitHash?: string;
}

/**
 * Load and validate server configuration
 *
 * Loads environment variables from multiple locations (workspace root, parent dirs),
 * resolves all necessary paths, creates directories, and copies built-in assets.
 *
 * @returns Promise resolving to complete server configuration
 * @throws Error if critical directories cannot be created
 */
export async function loadConfig(): Promise<ServerConfig> {
  // Load environment variables from multiple possible locations
  // Priority: local .env > parent .env > workspace root .env
  dotenv.config({ path: ".env" });
  dotenv.config({ path: "../../../.env" }); // Root workspace .env
  dotenv.config({ path: "../../.env" }); // Parent directory .env

  // ES module equivalent of __dirname
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Resolve paths correctly for both dev (src/server/) and build (build/)
  // When built: __dirname is .../hyperscape/build/startup
  // When dev: __dirname is .../hyperscape/packages/server/src/startup
  let hyperscapeRoot: string;
  if (__dirname.includes("/build/")) {
    // Built version: go up from build/startup/ to root
    hyperscapeRoot = path.join(__dirname, "../..");
  } else if (__dirname.includes("/src/server/")) {
    // Dev version: go up from src/server/startup/ to packages/server/
    hyperscapeRoot = path.join(__dirname, "../../..");
  } else {
    // Fallback: assume we're in startup directory
    hyperscapeRoot = path.join(__dirname, "../../..");
  }

  // Environment variables with defaults
  const WORLD = process.env["WORLD"] || "world";
  const PORT = parseInt(process.env["PORT"] || "5555", 10);
  const USE_LOCAL_POSTGRES =
    (process.env["USE_LOCAL_POSTGRES"] || "true") === "true";
  const DATABASE_URL = process.env["DATABASE_URL"];
  const CDN_URL = process.env["PUBLIC_CDN_URL"] || "http://localhost:8080";
  const SYSTEMS_PATH = process.env["SYSTEMS_PATH"];
  const ADMIN_CODE = process.env["ADMIN_CODE"];
  const JWT_SECRET = process.env["JWT_SECRET"];
  const SAVE_INTERVAL = parseInt(process.env["SAVE_INTERVAL"] || "60", 10);
  const NODE_ENV = process.env["NODE_ENV"] || "development";
  const COMMIT_HASH = process.env["COMMIT_HASH"];

  // Resolve world and assets directories
  const worldDir = path.isAbsolute(WORLD)
    ? WORLD
    : path.join(hyperscapeRoot, WORLD);
  const assetsDir = path.join(worldDir, "assets");
  const builtInAssetsDir = path.join(hyperscapeRoot, "src/world/assets");

  // Create world folders if needed
  await fs.ensureDir(worldDir);
  await fs.ensureDir(assetsDir);

  // Copy over built-in assets (only if assets directory is empty)
  const assetFiles = await fs.readdir(assetsDir).catch(() => []);
  if (assetFiles.length === 0 && (await fs.pathExists(builtInAssetsDir))) {
    await fs.copy(builtInAssetsDir, assetsDir);
  }

  // Construct assets URL with trailing slash
  const assetsUrl = CDN_URL.endsWith("/") ? CDN_URL : `${CDN_URL}/`;

  return {
    port: PORT,
    worldDir,
    assetsDir,
    hyperscapeRoot,
    builtInAssetsDir,
    __dirname: hyperscapeRoot, // Package root (for public/ access)
    useLocalPostgres: USE_LOCAL_POSTGRES,
    databaseUrl: DATABASE_URL,
    cdnUrl: CDN_URL,
    assetsUrl,
    systemsPath: SYSTEMS_PATH,
    adminCode: ADMIN_CODE,
    jwtSecret: JWT_SECRET,
    saveInterval: SAVE_INTERVAL,
    nodeEnv: NODE_ENV,
    commitHash: COMMIT_HASH,
  };
}

/**
 * Get public environment variables for client
 *
 * Filters all environment variables starting with PUBLIC_ and returns them
 * as a record. Used by /env.js endpoint to expose config to the client.
 *
 * @returns Record of public environment variables
 */
export function getPublicEnvs(): Record<string, string> {
  const publicEnvs: Record<string, string> = {};

  for (const key in process.env) {
    if (key.startsWith("PUBLIC_")) {
      const value = process.env[key];
      if (value) {
        publicEnvs[key] = value;
      }
    }
  }

  return publicEnvs;
}
