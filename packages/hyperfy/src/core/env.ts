/**
 * Unified environment variable access
 * Works in both browser and Node.js environments
 */

// Check if we're in a Node.js environment
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Helper to safely access environment variables
function getEnvVar(key: string, defaultValue?: string): string | undefined {
  // In Vite/browser environment, use import.meta.env
  if (typeof import.meta?.env !== 'undefined') {
    const value = import.meta.env[key];
    if (value !== undefined) {
      return value;
    }
  }

  // In Node.js environment, fall back to process.env
  if (isNode && typeof process.env !== 'undefined') {
    const value = process.env[key];
    if (value !== undefined) {
      return value;
    }
  }

  return defaultValue;
}

// Environment detection
export const ENV = {
  // Environment mode
  MODE: getEnvVar('MODE', 'development')!,
  NODE_ENV: getEnvVar('NODE_ENV', 'development')!,
  PROD: getEnvVar('PROD') === 'true' || getEnvVar('NODE_ENV') === 'production',
  DEV: getEnvVar('DEV') === 'true' || getEnvVar('NODE_ENV') === 'development',
  TEST: getEnvVar('TEST') === 'true' || getEnvVar('NODE_ENV') === 'test' || getEnvVar('VITEST') === 'true',

  // Server
  PORT: getEnvVar('PORT', '8787')!,
  WORLD: getEnvVar('WORLD', 'world')!,
  SERVER_URL: getEnvVar('SERVER_URL', 'http://localhost:8787')!,
  WORLD_SLUG: getEnvVar('WORLD_SLUG')!,
  ENABLE_HOT_RELOAD: getEnvVar('ENABLE_HOT_RELOAD', 'true')!,

  // LiveKit configuration (client-safe)
  LIVEKIT_URL: getEnvVar('LIVEKIT_URL') || getEnvVar('LIVEKIT_WS_URL'),
  LIVEKIT_API_KEY: getEnvVar('LIVEKIT_API_KEY'),

  // Note: Sensitive variables like JWT_SECRET, ADMIN_CODE, and LIVEKIT_API_SECRET
  // are now in env-server.ts and should only be imported on the server side

  // Public environment variables (exposed to client)
  PUBLIC_API_URL: getEnvVar('PUBLIC_API_URL'),
  PUBLIC_ASSETS_URL: getEnvVar('PUBLIC_ASSETS_URL', '/assets/')!,
  PUBLIC_MAX_UPLOAD_SIZE: getEnvVar('PUBLIC_MAX_UPLOAD_SIZE'),

  // Hyperfy configuration
  HYPERFY_ASSETS_URL: getEnvVar('HYPERFY_ASSETS_URL'),
  HYPERFY_ASSETS_DIR: getEnvVar('HYPERFY_ASSETS_DIR'),
  HYPERFY_NETWORK_RATE: getEnvVar('HYPERFY_NETWORK_RATE', '8')!,
  HYPERFY_MAX_DELTA_TIME: getEnvVar('HYPERFY_MAX_DELTA_TIME', String(1 / 30))!,
  HYPERFY_FIXED_DELTA_TIME: getEnvVar('HYPERFY_FIXED_DELTA_TIME', String(1 / 60))!,
  HYPERFY_LOG_LEVEL: getEnvVar('HYPERFY_LOG_LEVEL'),
  HYPERFY_PHYSICS_ENABLED: getEnvVar('HYPERFY_PHYSICS_ENABLED', 'true')!,
  HYPERFY_GRAVITY_X: getEnvVar('HYPERFY_GRAVITY_X', '0')!,
  HYPERFY_GRAVITY_Y: getEnvVar('HYPERFY_GRAVITY_Y', '-9.81')!,
  HYPERFY_GRAVITY_Z: getEnvVar('HYPERFY_GRAVITY_Z', '0')!,

  // Build configuration
  CLIENT_BUILD_DIR: getEnvVar('CLIENT_BUILD_DIR'),
  NO_CLIENT_SERVE: getEnvVar('NO_CLIENT_SERVE'),

  // Git information
  COMMIT_HASH: getEnvVar('COMMIT_HASH'),

  // Helper function to get any environment variable
  get: getEnvVar,

  // Helper to check if a variable exists
  has: (key: string): boolean => getEnvVar(key) !== undefined,

  // Get all public environment variables
  getPublicVars: (): Record<string, string> => {
    const publicVars: Record<string, string> = {};
    const envVars = isNode ? process.env : import.meta.env;

    if (envVars) {
      for (const [key, value] of Object.entries(envVars)) {
        if (key.startsWith('PUBLIC_') && typeof value === 'string') {
          publicVars[key] = value;
        }
      }
    }

    return publicVars;
  },
};

// Export type for TypeScript
export type EnvironmentVariables = typeof ENV
