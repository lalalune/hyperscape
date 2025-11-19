/**
 * Auto-Inject Route - Automatically injects login button into ElizaOS UI
 *
 * Visit this page to automatically add login buttons to all agent cards
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

const injectPageHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hyperscape Login - Injecting...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
    }
    h1 { margin-bottom: 20px; }
    .status {
      padding: 20px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Injecting Hyperscape Login Buttons</h1>
    <div class="status" id="status">Loading injector script...</div>
    <p>This will add login buttons to all agent cards in the ElizaOS UI.</p>
    <p><a href="/" style="color: white; text-decoration: underline;">← Back to ElizaOS</a></p>
  </div>
  
  <script src="/hyperscape/control-injector.js"></script>
  <script>
    setTimeout(() => {
      document.getElementById('status').textContent = '✅ Buttons injected! Check your agent cards.';
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }, 1000);
  </script>
</body>
</html>
`;

export const injectRoute: Route = {
  type: "GET",
  path: "/hyperscape/inject",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      res.setHeader("Content-Type", "text/html");
      res.send(injectPageHTML);
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Inject route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).send("Internal server error");
    }
  },
};
