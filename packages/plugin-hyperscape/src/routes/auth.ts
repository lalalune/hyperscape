/**
 * Authentication Routes for Hyperscape Plugin
 *
 * Provides Privy login integration for ElizaOS agents
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";
import type { HyperscapeService } from "../services/HyperscapeService.js";

/**
 * Login page HTML with Privy SDK integration
 */
const loginPageHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hyperscape Login</title>
  <script src="https://sdk.privy.io/js/v1.privy.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 24px;
    }
    p {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .status {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .status.loading {
      background: #e3f2fd;
      color: #1976d2;
    }
    .status.success {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status.error {
      background: #ffebee;
      color: #c62828;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .close-btn {
      background: #f5f5f5;
      color: #333;
      margin-top: 15px;
      padding: 10px 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Hyperscape Login</h1>
    <p>Authenticate with Privy to connect your agent to Hyperscape</p>
    
    <div id="status" class="status loading" style="display: none;">
      Initializing Privy...
    </div>
    
    <button id="loginBtn" onclick="handleLogin()" disabled>
      Login with Privy
    </button>
    
    <button class="close-btn" onclick="window.close()">
      Close
    </button>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agentId');
    const callbackUrl = urlParams.get('callback') || '/hyperscape/auth/callback';
    
    let privy = null;
    
    // Initialize Privy
    async function initPrivy() {
      try {
        const statusEl = document.getElementById('status');
        statusEl.style.display = 'block';
        statusEl.textContent = 'Initializing Privy...';
        
        // Get Privy App ID from environment or use default
        const privyAppId = '${process.env.PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || ""}';
        
        if (!privyAppId) {
          throw new Error('Privy App ID not configured');
        }
        
        privy = new Privy({
          appId: privyAppId,
          config: {
            appearance: {
              theme: 'light',
              accentColor: '#667eea',
            },
            loginMethods: ['wallet', 'email', 'sms', 'google', 'twitter', 'discord'],
            embeddedWallets: {
              createOnLogin: 'users-without-wallets'
            }
          }
        });
        
        await privy.ready();
        
        // Check if already authenticated
        if (privy.authenticated) {
          await handleAuthSuccess();
        } else {
          statusEl.style.display = 'none';
          document.getElementById('loginBtn').disabled = false;
        }
      } catch (error) {
        console.error('Privy initialization error:', error);
        const statusEl = document.getElementById('status');
        statusEl.style.display = 'block';
        statusEl.className = 'status error';
        statusEl.textContent = 'Failed to initialize Privy: ' + error.message;
      }
    }
    
    // Handle login button click
    async function handleLogin() {
      if (!privy) {
        alert('Privy not initialized');
        return;
      }
      
      try {
        const statusEl = document.getElementById('status');
        statusEl.style.display = 'block';
        statusEl.className = 'status loading';
        statusEl.textContent = 'Opening Privy login...';
        document.getElementById('loginBtn').disabled = true;
        
        await privy.login();
        
        if (privy.authenticated) {
          await handleAuthSuccess();
        }
      } catch (error) {
        console.error('Login error:', error);
        const statusEl = document.getElementById('status');
        statusEl.style.display = 'block';
        statusEl.className = 'status error';
        statusEl.textContent = 'Login failed: ' + error.message;
        document.getElementById('loginBtn').disabled = false;
      }
    }
    
    // Handle successful authentication
    async function handleAuthSuccess() {
      try {
        const statusEl = document.getElementById('status');
        statusEl.style.display = 'block';
        statusEl.className = 'status loading';
        statusEl.textContent = 'Getting access token...';
        
        const accessToken = await privy.getAccessToken();
        const user = privy.user;
        
        if (!accessToken || !user) {
          throw new Error('Failed to get access token');
        }
        
        statusEl.textContent = 'Saving credentials...';
        
        // Send token to callback endpoint
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId: agentId,
            authToken: accessToken,
            privyUserId: user.id,
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save credentials');
        }
        
        statusEl.className = 'status success';
        statusEl.textContent = '✅ Login successful! You can close this window.';
        
        // Notify parent window if opened as popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'HYPERSCAPE_LOGIN_SUCCESS',
            agentId: agentId,
          }, '*');
        }
        
        // Auto-close after 2 seconds
        setTimeout(() => {
          window.close();
        }, 2000);
      } catch (error) {
        console.error('Auth success handler error:', error);
        const statusEl = document.getElementById('status');
        statusEl.style.display = 'block';
        statusEl.className = 'status error';
        statusEl.textContent = 'Error: ' + error.message;
        document.getElementById('loginBtn').disabled = false;
      }
    }
    
    // Initialize on load
    initPrivy();
  </script>
</body>
</html>
`;

/**
 * Login route - serves the login page
 */
export const loginRoute: Route = {
  type: "GET",
  path: "/hyperscape/auth/login",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const query = req.query as { agentId?: string };
      const agentId = query?.agentId || runtime.agentId;

      if (!agentId) {
        res.status(400).send("Missing agentId parameter");
        return;
      }

      // Replace placeholder with actual Privy App ID
      const privyAppId =
        process.env.PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || "";
      const html = loginPageHTML.replace(
        '${process.env.PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID || ""}',
        privyAppId,
      );

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Login route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).send("Internal server error");
    }
  },
};

/**
 * Callback route - receives auth tokens and stores them
 */
export const callbackRoute: Route = {
  type: "POST",
  path: "/hyperscape/auth/callback",
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
      await runtime.setSetting("HYPERSCAPE_AUTH_TOKEN", authToken);
      await runtime.setSetting("HYPERSCAPE_PRIVY_USER_ID", privyUserId);

      // Update service if it's already running
      const service =
        runtime.getService<HyperscapeService>("hyperscapeService");
      if (service) {
        service.setAuthToken(authToken, privyUserId);

        // Reconnect with new auth token if not connected
        if (!service.isConnected()) {
          const serverUrl =
            process.env.HYPERSCAPE_SERVER_URL || "ws://localhost:5555/ws";
          await service.connect(serverUrl).catch((err) => {
            logger.error(
              "[HyperscapeAuth] Reconnection error:",
              err instanceof Error ? err.message : String(err),
            );
          });
        }
      }

      logger.info(`[HyperscapeAuth] Auth tokens saved for agent ${agentId}`);

      res.json({
        success: true,
        message: "Authentication successful",
      });
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Callback route error:",
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
  type: "GET",
  path: "/hyperscape/auth/status",
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

      const authToken = await runtime.getSetting("HYPERSCAPE_AUTH_TOKEN");
      const privyUserId = await runtime.getSetting("HYPERSCAPE_PRIVY_USER_ID");

      res.json({
        success: true,
        authenticated: !!(authToken && privyUserId),
        hasToken: !!authToken,
        hasUserId: !!privyUserId,
      });
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Status route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  },
};
