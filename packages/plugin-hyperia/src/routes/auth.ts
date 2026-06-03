/**
 * Authentication API Routes for Hyperia Plugin
 *
 * Provides backend API endpoints for managing agent authentication
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import {
  type HyperiaService,
  resolveDefaultHyperiaServerUrl,
} from "../services/HyperiaService.js";

/**
 * Callback route - receives auth tokens and stores them
 */
export const callbackRoute: Route = {
  name: "hyperia-auth-callback",
  type: "POST",
  path: "/hyperia/auth/callback",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const body = req.body as {
        agentId?: string;
        authToken?: string;
        privyUserId?: string;
      };

      const agentId = body.agentId || runtime.agentId;
      const { authToken, privyUserId } = body;

      if (!agentId || !authToken || !privyUserId) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: agentId, authToken, privyUserId",
        });
        return;
      }

      // Verify this runtime matches the agentId
      if (runtime.agentId !== agentId) {
        res.status(403).json({
          success: false,
          error: "Agent ID mismatch",
        });
        return;
      }

      // Store auth tokens in agent settings
      await runtime.setSetting("HYPERIA_AUTH_TOKEN", authToken);
      await runtime.setSetting("HYPERIA_PRIVY_USER_ID", privyUserId);

      // Update service if it's already running
      const service = runtime.getService<HyperiaService>("hyperiaService");
      if (service) {
        service.setAuthToken(authToken, privyUserId);

        // Reconnect with new auth token if not connected
        if (!service.isConnected()) {
          const serverUrl =
            process.env.HYPERIA_SERVER_URL || resolveDefaultHyperiaServerUrl();
          await service.connect(serverUrl).catch((err) => {
            logger.error(
              "[HyperiaAuth] Reconnection error:",
              err instanceof Error ? err.message : String(err),
            );
          });
        }
      }

      logger.info(`[HyperiaAuth] Auth tokens saved for agent ${agentId}`);

      res.json({
        success: true,
        message: "Authentication successful",
      });
    } catch (error) {
      logger.error(
        "[HyperiaAuth] Callback route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
};

/**
 * Status route - check if agent is authenticated
 */
export const statusRoute: Route = {
  name: "hyperia-auth-status",
  type: "GET",
  path: "/hyperia/auth/status",
  public: false,
  handler: async (req, res, runtime) => {
    try {
      const query = req.query as { agentId?: string };
      const agentId = query?.agentId || runtime.agentId;

      if (!agentId) {
        res.status(400).json({
          success: false,
          error: "Missing agentId parameter",
        });
        return;
      }

      // Verify this runtime matches the agentId
      if (runtime.agentId !== agentId) {
        res.status(403).json({
          success: false,
          authenticated: false,
          error: "Agent ID mismatch",
        });
        return;
      }

      const authToken = await runtime.getSetting("HYPERIA_AUTH_TOKEN");
      const privyUserId = await runtime.getSetting("HYPERIA_PRIVY_USER_ID");

      res.json({
        success: true,
        authenticated: !!(authToken && privyUserId),
        hasToken: !!authToken,
        hasUserId: !!privyUserId,
      });
    } catch (error) {
      logger.error(
        "[HyperiaAuth] Status route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
};
