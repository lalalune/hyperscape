/**
 * Test Configuration and Shared Constants for Hyperia E2E Tests
 *
 * Contains server URLs, ports, timeouts, and health check utilities.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default client port (Vite dev server) */
export const CLIENT_PORT = Number(process.env.VITE_PORT ?? 3333);

/** Default server port (Fastify game server) */
export const SERVER_PORT = Number(process.env.PORT ?? 5555);

/** Base URL for the Hyperia client */
export const BASE_URL =
  process.env.TEST_URL ?? `http://localhost:${CLIENT_PORT}`;

/** Base URL for the Hyperia game server API */
export const SERVER_URL =
  process.env.TEST_SERVER_URL ?? `http://localhost:${SERVER_PORT}`;

/** Default test timeout (2 minutes per test) */
export const TEST_TIMEOUT_MS = 2 * 60 * 1000;

/** Long test timeout for full flows (5 minutes) */
export const LONG_TEST_TIMEOUT_MS = 5 * 60 * 1000;

// =============================================================================
// TEST WALLET ADDRESSES
// =============================================================================

/** Anvil Account #0 address (default deployer) */
export const EVM_TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/** Anvil Account #1 address (secondary) */
export const EVM_SECONDARY_ADDRESS =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

// =============================================================================
// SERVER HEALTH CHECKS
// =============================================================================

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if the Hyperia client is reachable.
 * Retries multiple times to handle slow startup.
 */
export async function assertClientHealthy(
  maxRetries: number = 20,
  retryDelay: number = 2000,
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(BASE_URL, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 304) {
        return;
      }
      lastError = new Error(`Client returned HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    if (i < maxRetries - 1) {
      console.log(
        `[assertClientHealthy] Waiting for client (attempt ${i + 1}/${maxRetries})...`,
      );
      await sleep(retryDelay);
    }
  }

  throw new Error(
    `Client health check failed after ${maxRetries} attempts: ${lastError?.message ?? "unknown error"}`,
  );
}

/**
 * Check if the Hyperia game server is reachable.
 * Hits the API health endpoint.
 */
export async function assertServerHealthy(
  maxRetries: number = 20,
  retryDelay: number = 2000,
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try the server root or a known API endpoint
      const res = await fetch(`${SERVER_URL}/api/health`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => fetch(SERVER_URL, { signal: AbortSignal.timeout(5000) }));
      if (res.ok || res.status === 404) {
        return; // Server is up (404 = server responds but route not found = still healthy)
      }
      lastError = new Error(`Server returned HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }

    if (i < maxRetries - 1) {
      console.log(
        `[assertServerHealthy] Waiting for server (attempt ${i + 1}/${maxRetries})...`,
      );
      await sleep(retryDelay);
    }
  }

  throw new Error(
    `Server health check failed after ${maxRetries} attempts: ${lastError?.message ?? "unknown error"}`,
  );
}

/**
 * Assert both client and server are healthy.
 */
export async function assertInfrastructureHealthy(): Promise<void> {
  await Promise.all([assertClientHealthy(), assertServerHealthy()]);
}
