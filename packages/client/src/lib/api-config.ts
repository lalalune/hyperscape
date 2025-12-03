/**
 * API Configuration
 *
 * Centralized configuration for external service URLs.
 * All URLs have sensible defaults for local development.
 *
 * Usage:
 *   import { ELIZAOS_API, GAME_API_URL } from '@/lib/api-config';
 *   fetch(`${ELIZAOS_API}/agents`);
 *
 * Override via environment variables in .env:
 *   PUBLIC_ELIZAOS_URL=http://localhost:4001
 *   PUBLIC_API_URL=http://localhost:5555
 */

// =============================================================================
// ElizaOS AI Agent Server
// =============================================================================
// API endpoints: ${ELIZAOS_URL}/api/...
// Hyperscape routes: ${ELIZAOS_URL}/hyperscape/...

export const ELIZAOS_URL =
  import.meta.env.PUBLIC_ELIZAOS_URL || "http://localhost:4001";

export const ELIZAOS_API = `${ELIZAOS_URL}/api`;

// =============================================================================
// Hyperscape Game Server
// =============================================================================

export const GAME_API_URL =
  import.meta.env.PUBLIC_API_URL || "http://localhost:5555";

export const GAME_WS_URL =
  import.meta.env.PUBLIC_WS_URL || "ws://localhost:5555/ws";

// =============================================================================
// CDN for Static Assets
// =============================================================================

export const CDN_URL =
  import.meta.env.PUBLIC_CDN_URL || "http://localhost:8080";
