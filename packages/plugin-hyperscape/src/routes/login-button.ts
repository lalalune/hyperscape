/**
 * Login Button Route - Simple page with login button
 *
 * Provides a simple HTML page with a login button that can be accessed
 * from the ElizaOS UI or bookmarked
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

const loginButtonHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hyperscape Login</title>
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
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .agent-id {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      margin: 20px 0;
      font-family: monospace;
      font-size: 14px;
      word-break: break-all;
      color: #666;
    }
    .login-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: transform 0.2s, box-shadow 0.2s;
      margin-top: 20px;
    }
    .login-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .login-button:active {
      transform: translateY(0);
    }
    .status {
      padding: 12px;
      border-radius: 8px;
      margin-top: 20px;
      font-size: 14px;
      display: none;
    }
    .status.success {
      background: #e8f5e9;
      color: #2e7d32;
      display: block;
    }
    .status.error {
      background: #ffebee;
      color: #c62828;
      display: block;
    }
    .back-link {
      display: inline-block;
      margin-top: 20px;
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Hyperscape Login</h1>
    <p>Authenticate your agent to connect to Hyperscape</p>
    
    <div class="agent-id" id="agentId">Loading agent ID...</div>
    
    <button class="login-button" id="loginBtn" onclick="openLogin()">
      Login with Privy
    </button>
    
    <div class="status" id="status"></div>
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
        💡 <strong>Tip:</strong> This page automatically adds login buttons to all agent cards in the ElizaOS UI.
        <br>Just keep this tab open and check your agent cards!
      </p>
      <a href="/" class="back-link">← Back to ElizaOS</a>
      <span style="margin: 0 10px; color: #999;">|</span>
      <a href="/hyperscape/inject" class="back-link" style="font-weight: 600;">🔄 Re-inject Buttons</a>
    </div>
  </div>

  <script>
    // Auto-inject login buttons into ElizaOS UI when this page loads
    (function() {
      const script = document.createElement('script');
      script.src = '/hyperscape/control-injector.js';
      script.onload = () => {
        console.log('Hyperscape login buttons injected into UI');
        // Show success message
        const statusEl = document.getElementById('status');
        if (statusEl) {
          statusEl.textContent = '✅ Login buttons added to ElizaOS UI! Check your agent cards.';
          statusEl.className = 'status success';
        }
      };
      document.head.appendChild(script);
    })();
  </script>
  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agentId') || 'YOUR_AGENT_ID';
    
    document.getElementById('agentId').textContent = 'Agent ID: ' + agentId;
    
    // Check auth status on load
    async function checkAuthStatus() {
      try {
        const response = await fetch('/hyperscape/auth/status?agentId=' + encodeURIComponent(agentId));
        const data = await response.json();
        
        if (data.authenticated) {
          const statusEl = document.getElementById('status');
          statusEl.className = 'status success';
          statusEl.textContent = '✅ Already authenticated!';
          document.getElementById('loginBtn').textContent = 'Re-authenticate';
        }
      } catch (error) {
        console.error('Failed to check auth status:', error);
      }
    }
    
    function openLogin() {
      const loginUrl = '/hyperscape/auth/login?agentId=' + encodeURIComponent(agentId);
      const popup = window.open(
        loginUrl,
        'HyperscapeLogin',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      // Listen for success message from popup
      const messageListener = (event) => {
        if (event.data && event.data.type === 'HYPERSCAPE_LOGIN_SUCCESS') {
          const statusEl = document.getElementById('status');
          statusEl.className = 'status success';
          statusEl.textContent = '✅ Login successful! Your agent is now authenticated.';
          popup.close();
          window.removeEventListener('message', messageListener);
          
          // Refresh status
          setTimeout(checkAuthStatus, 1000);
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Check if popup was blocked
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        alert('Popup blocked! Please allow popups for this site and try again.');
      }
    }
    
    // Check status on load
    checkAuthStatus();
  </script>
</body>
</html>
`;

/**
 * Login button page route
 */
export const loginButtonRoute: Route = {
  type: "GET",
  path: "/hyperscape/auth",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      const query = req.query as { agentId?: string };
      const agentId = query?.agentId || runtime.agentId;

      res.setHeader("Content-Type", "text/html");
      res.send(loginButtonHTML);
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Login button route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).send("Internal server error");
    }
  },
};
