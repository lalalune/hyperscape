/**
 * Viewport Route - Serves embedded Hyperscape client for agent viewing
 *
 * This route serves the built Hyperscape client with embedded configuration,
 * allowing ElizaOS to display agent gameplay in an iframe viewport.
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import * as path from "path";
import * as fs from "fs/promises";
import * as jwt from "jsonwebtoken";
import {
  type EmbeddedViewportConfig,
  type ViewportQueryParams,
  viewportQuerySchema,
  DEFAULT_VIEWPORT_CONFIG,
  parseHiddenUI,
} from "../config/viewportConfig.js";

/**
 * Generate a short-lived session token for viewport access
 */
function generateSessionToken(agentId: string, characterId?: string): string {
  const secret = process.env.JWT_SECRET || "hyperscape-dev-secret";
  const payload = {
    agentId,
    characterId,
    type: "viewport-session",
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, secret, {
    expiresIn: "15m", // 15 minute expiry
  });
}

/**
 * Viewport route - serves embedded Hyperscape client
 */
export const viewportRoute: Route = {
  type: "GET",
  path: "/hyperscape/viewport/:agentId",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const { agentId } = req.params as { agentId: string };

      logger.info(
        `[HyperscapeViewport] Serving viewport for agent: ${agentId}`,
      );

      // Parse query parameters
      const queryParams = viewportQuerySchema.parse(req.query || {});

      // Get agent's authentication credentials
      const authToken = await runtime.getSetting("HYPERSCAPE_AUTH_TOKEN");
      const privyUserId = await runtime.getSetting("HYPERSCAPE_PRIVY_USER_ID");
      const characterId = await runtime.getSetting("HYPERSCAPE_CHARACTER_ID");

      // Check if agent is authenticated
      if (!authToken) {
        logger.warn(`[HyperscapeViewport] Agent ${agentId} not authenticated`);
        res.status(401).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Required</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 40px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 12px;
              }
              a {
                color: white;
                text-decoration: underline;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔐 Authentication Required</h1>
              <p>This agent needs to login to Hyperscape first.</p>
              <p><a href="/hyperscape/auth?agentId=${encodeURIComponent(agentId)}">Login with Privy →</a></p>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // Get WebSocket URL
      const wsUrl =
        process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:5555/ws";

      // Generate session token for this viewport
      const sessionToken = generateSessionToken(agentId, characterId);

      // Parse hidden UI elements
      const hiddenUI = parseHiddenUI(queryParams.hiddenUI);

      // Build embedded viewport configuration
      const config: EmbeddedViewportConfig = {
        agentId,
        authToken,
        characterId,
        wsUrl,
        mode: queryParams.mode,
        followEntity: queryParams.followEntity || characterId,
        hiddenUI,
        quality: queryParams.quality,
        sessionToken,
      };

      // Path to client build
      const clientDistPath = path.join(__dirname, "../../../../client/dist");
      const indexPath = path.join(clientDistPath, "index.html");

      // Check if client build exists
      try {
        await fs.access(indexPath);
      } catch (error) {
        logger.error(
          "[HyperscapeViewport] Client build not found at:",
          indexPath,
        );
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Build Error</title></head>
          <body>
            <h1>Client Build Not Found</h1>
            <p>The Hyperscape client needs to be built first.</p>
            <p>Run: <code>cd packages/client && bun run build</code></p>
          </body>
          </html>
        `);
        return;
      }

      // Read client index.html
      let html = await fs.readFile(indexPath, "utf-8");

      // Inject viewport configuration
      const configScript = `
        <script>
          // Embedded viewport configuration
          window.__HYPERSCAPE_CONFIG__ = ${JSON.stringify(config)};
          window.__HYPERSCAPE_EMBEDDED__ = true;

          // Performance optimizations for viewport
          window.__HYPERSCAPE_VIEWPORT_SETTINGS__ = {
            targetFPS: ${DEFAULT_VIEWPORT_CONFIG.targetFPS},
            quality: "${queryParams.quality}",
            renderOnlyWhenVisible: true
          };

          console.log('[HyperscapeViewport] Embedded mode active for agent:', '${agentId}');
        </script>
      `;

      // Inject before </head>
      html = html.replace("</head>", `${configScript}</head>`);

      // Set response headers
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("X-Frame-Options", "SAMEORIGIN"); // Allow iframe embedding from same origin
      res.setHeader("X-Content-Type-Options", "nosniff");

      logger.info(
        `[HyperscapeViewport] Viewport served for agent ${agentId} in ${config.mode} mode`,
      );

      res.send(html);
    } catch (error) {
      logger.error(
        "[HyperscapeViewport] Error serving viewport:",
        error instanceof Error ? error.message : String(error),
      );

      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Viewport Error</title></head>
        <body>
          <h1>Error Loading Viewport</h1>
          <p>${error instanceof Error ? error.message : "Unknown error"}</p>
        </body>
        </html>
      `);
    }
  },
};
