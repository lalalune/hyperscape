/**
 * Session Key API Routes
 *
 * REST API endpoints for session key management.
 * Enables gasless gameplay by allowing users to grant session keys
 * to the game server.
 *
 * Endpoints:
 * - POST /api/session/create - Request a new session key
 * - POST /api/session/confirm - Confirm session with owner signature
 * - POST /api/session/revoke - Revoke active session
 * - GET /api/session/status - Check session status
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Address, Hex } from "viem";
import {
  SessionKeyManager,
  createSessionKeyPair,
  generateSessionAuthorizationMessage,
  GAME_PERMISSION_SETS,
  type SessionKeyPermission,
} from "@hyperscape/shared/blockchain";

// ============ Types ============

interface CreateSessionRequest {
  walletAddress: Address;
  permissions?: string[];
  duration?: number;
}

interface ConfirmSessionRequest {
  walletAddress: Address;
  sessionKeyAddress: Address;
  signature: Hex;
}

interface RevokeSessionRequest {
  walletAddress: Address;
}

interface SessionStatusRequest {
  walletAddress: Address;
}

// ============ Session Manager Instance ============

let sessionManager: SessionKeyManager | null = null;

function getSessionManager(): SessionKeyManager {
  if (!sessionManager) {
    sessionManager = new SessionKeyManager();
  }
  return sessionManager;
}

// ============ Pending Sessions (awaiting signature) ============

interface PendingSession {
  sessionKeyAddress: Address;
  sessionKeyPrivateKey: Hex;
  permissions: SessionKeyPermission[];
  expiresAt: number;
  message: string;
  createdAt: number;
}

const pendingSessions = new Map<string, PendingSession>();

// Clean up expired pending sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of pendingSessions) {
    // Remove pending sessions older than 5 minutes
    if (now - session.createdAt > 5 * 60 * 1000) {
      pendingSessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============ Route Registration ============

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Create a new session key request
   * Returns a message for the user to sign
   */
  fastify.post<{ Body: CreateSessionRequest }>(
    "/api/session/create",
    async (request: FastifyRequest<{ Body: CreateSessionRequest }>, reply: FastifyReply) => {
      const { walletAddress, permissions = ["gameplay"], duration = 86400 } = request.body;

      if (!walletAddress) {
        return reply.status(400).send({ error: "walletAddress is required" });
      }

      // Get world address for permissions
      const worldAddress = process.env.WORLD_ADDRESS as Address;
      if (!worldAddress) {
        return reply.status(500).send({ error: "Server not configured for sessions" });
      }

      // Build permissions based on requested permission sets
      let sessionPermissions: SessionKeyPermission[] = [];

      for (const perm of permissions) {
        switch (perm) {
          case "gameplay":
            sessionPermissions = [
              ...sessionPermissions,
              ...GAME_PERMISSION_SETS.GAMEPLAY(worldAddress),
            ];
            break;
          case "inventory":
            sessionPermissions = [
              ...sessionPermissions,
              ...GAME_PERMISSION_SETS.INVENTORY(worldAddress),
            ];
            break;
          case "equipment":
            sessionPermissions = [
              ...sessionPermissions,
              ...GAME_PERMISSION_SETS.EQUIPMENT(worldAddress),
            ];
            break;
          case "combat":
            sessionPermissions = [
              ...sessionPermissions,
              ...GAME_PERMISSION_SETS.COMBAT(worldAddress),
            ];
            break;
          case "gathering":
            sessionPermissions = [
              ...sessionPermissions,
              ...GAME_PERMISSION_SETS.GATHERING(worldAddress),
            ];
            break;
          default:
            console.warn(`[Session] Unknown permission set: ${perm}`);
        }
      }

      // Generate session key pair
      const { privateKey, address: sessionKeyAddress } = createSessionKeyPair();

      // Calculate expiration
      const expiresAt = Math.floor(Date.now() / 1000) + duration;
      const chainId = parseInt(process.env.CHAIN_ID || "420691");

      // Generate authorization message
      const message = generateSessionAuthorizationMessage(
        sessionKeyAddress,
        sessionPermissions,
        expiresAt,
        chainId
      );

      // Store pending session
      const pendingKey = walletAddress.toLowerCase();
      pendingSessions.set(pendingKey, {
        sessionKeyAddress,
        sessionKeyPrivateKey: privateKey,
        permissions: sessionPermissions,
        expiresAt,
        message,
        createdAt: Date.now(),
      });

      console.log(`[Session] Created pending session for ${walletAddress}`);

      return reply.send({
        sessionKeyAddress,
        message,
        expiresAt,
        permissions: permissions,
      });
    }
  );

  /**
   * Confirm session with owner's signature
   */
  fastify.post<{ Body: ConfirmSessionRequest }>(
    "/api/session/confirm",
    async (request: FastifyRequest<{ Body: ConfirmSessionRequest }>, reply: FastifyReply) => {
      const { walletAddress, sessionKeyAddress, signature } = request.body;

      if (!walletAddress || !sessionKeyAddress || !signature) {
        return reply.status(400).send({
          error: "walletAddress, sessionKeyAddress, and signature are required",
        });
      }

      // Get pending session
      const pendingKey = walletAddress.toLowerCase();
      const pending = pendingSessions.get(pendingKey);

      if (!pending) {
        return reply.status(404).send({ error: "No pending session found" });
      }

      if (pending.sessionKeyAddress.toLowerCase() !== sessionKeyAddress.toLowerCase()) {
        return reply.status(400).send({ error: "Session key address mismatch" });
      }

      const manager = getSessionManager();

      // Create the session using the pre-generated key pair (validates signature internally)
      const session = await manager.createSession(
        walletAddress,
        pending.permissions,
        signature,
        pending.expiresAt - Math.floor(Date.now() / 1000),
        { address: pending.sessionKeyAddress, privateKey: pending.sessionKeyPrivateKey }
      );

      // Clear pending session
      pendingSessions.delete(pendingKey);

      console.log(`[Session] Confirmed session for ${walletAddress}`);

      return reply.send({
        success: true,
        sessionKeyAddress: session.address,
        expiresAt: session.expiresAt,
        permissions: pending.permissions.length,
      });
    }
  );

  /**
   * Revoke active session
   */
  fastify.post<{ Body: RevokeSessionRequest }>(
    "/api/session/revoke",
    async (request: FastifyRequest<{ Body: RevokeSessionRequest }>, reply: FastifyReply) => {
      const { walletAddress } = request.body;

      if (!walletAddress) {
        return reply.status(400).send({ error: "walletAddress is required" });
      }

      const manager = getSessionManager();
      await manager.revokeSession(walletAddress);

      console.log(`[Session] Revoked session for ${walletAddress}`);

      return reply.send({ success: true });
    }
  );

  /**
   * Check session status
   */
  fastify.get<{ Querystring: SessionStatusRequest }>(
    "/api/session/status",
    async (request: FastifyRequest<{ Querystring: SessionStatusRequest }>, reply: FastifyReply) => {
      const walletAddress = request.query.walletAddress;

      if (!walletAddress) {
        return reply.status(400).send({ error: "walletAddress query param is required" });
      }

      const manager = getSessionManager();
      const session = await manager.getSession(walletAddress);

      if (!session) {
        return reply.send({
          hasSession: false,
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const isExpired = now > session.expiresAt;

      return reply.send({
        hasSession: !isExpired,
        sessionKeyAddress: session.address,
        expiresAt: session.expiresAt,
        expiresIn: Math.max(0, session.expiresAt - now),
        transactionCount: session.transactionCount,
        permissionCount: session.permissions.length,
      });
    }
  );
}

export default sessionRoutes;
