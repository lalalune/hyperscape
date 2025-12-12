/**
 * WebSocket Module - Real-time multiplayer connection handling
 *
 * Registers the WebSocket endpoint and handles incoming connections.
 * Delegates connection management to ServerNetwork system.
 *
 * Security measures:
 * - IP-based connection rate limiting (prevents connection floods)
 * - Origin header validation (prevents cross-site WebSocket hijacking)
 * - Spectator mode rate limiting
 *
 * Usage:
 * ```typescript
 * registerWebSocket(fastify, world);
 * ```
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { World } from "@hyperscape/shared";
import type { NodeWebSocket } from "../types.js";

// JSON value type for proper typing
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// ============================================================================
// CONNECTION RATE LIMITING
// ============================================================================

/**
 * Connection rate limiter per IP address
 * Prevents connection flood attacks
 */
class ConnectionRateLimiter {
  private connections = new Map<string, { count: number; resetAt: number }>();
  private readonly maxConnectionsPerMinute: number;
  private readonly windowMs: number;

  constructor(maxConnectionsPerMinute = 10, windowMs = 60000) {
    this.maxConnectionsPerMinute = maxConnectionsPerMinute;
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if IP is allowed to connect
   * @returns true if allowed, false if rate limited
   */
  isAllowed(ip: string): boolean {
    const now = Date.now();
    const entry = this.connections.get(ip);

    if (!entry || now > entry.resetAt) {
      this.connections.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxConnectionsPerMinute) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining connections for IP
   */
  getRemaining(ip: string): number {
    const entry = this.connections.get(ip);
    if (!entry || Date.now() > entry.resetAt) {
      return this.maxConnectionsPerMinute;
    }
    return Math.max(0, this.maxConnectionsPerMinute - entry.count);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.connections) {
      if (now > entry.resetAt) {
        this.connections.delete(ip);
      }
    }
  }
}

// Separate rate limiters for players and spectators
const playerRateLimiter = new ConnectionRateLimiter(10, 60000); // 10 per minute
const spectatorRateLimiter = new ConnectionRateLimiter(5, 60000); // 5 per minute (stricter)

// ============================================================================
// ORIGIN VALIDATION
// ============================================================================

/**
 * Validate WebSocket origin header
 * Prevents cross-site WebSocket hijacking (CSWSH)
 */
function isValidOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  // No origin header - could be same-origin or non-browser client
  // Allow in development, require in production
  if (!origin) {
    return process.env.NODE_ENV === "development";
  }

  // Check against allowed origins
  for (const allowed of allowedOrigins) {
    if (allowed === "*") return true; // Wildcard (development only)
    if (origin === allowed) return true;
    // Support wildcard subdomains (e.g., *.hyperscape.io)
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2);
      if (origin.endsWith(domain)) return true;
    }
  }

  return false;
}

/**
 * Get client IP from request (handles proxies)
 */
function getClientIP(req: FastifyRequest): string {
  // Check common proxy headers
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // x-forwarded-for can be comma-separated list
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to direct connection IP
  return req.ip || "unknown";
}

// ============================================================================
// WEBSOCKET REGISTRATION
// ============================================================================

/**
 * Register WebSocket endpoint
 *
 * Sets up the /ws WebSocket endpoint for real-time multiplayer.
 * Connections are validated and passed to ServerNetwork for handling.
 *
 * @param fastify - Fastify server instance
 * @param world - Game world instance with ServerNetwork
 */
export function registerWebSocket(
  fastify: FastifyInstance,
  world: World,
): void {
  // Get allowed origins from environment or use defaults
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(",").map((o) => o.trim())
    : process.env.NODE_ENV === "development"
      ? ["*"] // Allow all in development
      : ["https://hyperscape.io", "https://*.hyperscape.io"];

  fastify.get("/ws", { websocket: true }, (socket, req: FastifyRequest) => {
    const ws = socket as unknown as NodeWebSocket;
    const clientIP = getClientIP(req);
    const query = req.query as Record<string, JSONValue>;
    const isSpectator = query.mode === "spectator";

    // Generate unique WebSocket ID
    const wsId = `SERVER-WS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    (ws as NodeWebSocket & { __wsId?: string }).__wsId = wsId;

    // SECURITY: Validate origin header (prevents CSWSH attacks)
    const origin = req.headers.origin;
    if (!isValidOrigin(origin, allowedOrigins)) {
      fastify.log.warn(
        `[WebSocket] Rejected connection from invalid origin: ${origin} (IP: ${clientIP})`,
      );
      ws.close(4003, "Invalid origin");
      return;
    }

    // SECURITY: Rate limit connections per IP
    const rateLimiter = isSpectator ? spectatorRateLimiter : playerRateLimiter;
    if (!rateLimiter.isAllowed(clientIP)) {
      fastify.log.warn(
        `[WebSocket] Rate limited connection from IP: ${clientIP} (spectator: ${isSpectator})`,
      );
      ws.close(4029, "Too many connections");
      return;
    }

    fastify.log.info(
      `[WebSocket] Connection established - ${wsId} (IP: ${clientIP}, remaining: ${rateLimiter.getRemaining(clientIP)})`,
    );

    // Basic null check
    if (!ws || typeof ws.send !== "function") {
      fastify.log.error("[WebSocket] Invalid WebSocket object received");
      return;
    }

    // Handle network connection - pass client IP for rate limiting
    const paramsWithIP = { ...query, clientIP };
    world.network.onConnection!(ws, paramsWithIP);
  });
}
