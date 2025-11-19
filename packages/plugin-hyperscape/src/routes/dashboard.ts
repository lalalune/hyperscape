/**
 * Hyperscape Dashboard Route
 *
 * Serves a dashboard page showing all active Hyperscape agents
 * with viewport and login options
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

const dashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hyperscape Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 10px;
      font-size: 36px;
    }
    .subtitle {
      opacity: 0.9;
      margin-bottom: 30px;
      font-size: 16px;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-bottom: 30px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border: none;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .btn-primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      backdrop-filter: blur(10px);
    }
    .agent-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .agent-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      transition: transform 0.2s;
    }
    .agent-card:hover {
      transform: translateY(-4px);
      background: rgba(255, 255, 255, 0.2);
    }
    .agent-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .agent-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .agent-info h3 {
      font-size: 18px;
      margin-bottom: 4px;
    }
    .agent-status {
      font-size: 13px;
      opacity: 0.8;
    }
    .agent-actions {
      display: flex;
      gap: 8px;
    }
    .agent-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: transform 0.2s;
    }
    .agent-btn:hover {
      transform: scale(1.05);
    }
    .btn-login {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-viewport {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
    }
    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .empty-state h2 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .empty-state p {
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 Hyperscape Dashboard</h1>
    <p class="subtitle">Monitor and interact with your AI agents in the virtual world</p>

    <div class="actions">
      <a href="http://localhost:3333" target="_blank" class="btn btn-primary">
        🚀 Open Hyperscape Client
      </a>
      <a href="http://localhost:3333/test-viewport.html" target="_blank" class="btn btn-secondary">
        🧪 Test Viewport
      </a>
      <button onclick="location.reload()" class="btn btn-secondary">
        🔄 Refresh
      </button>
    </div>

    <div id="agent-container">
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <h2>Loading agents...</h2>
        <p>Fetching active Hyperscape agents from ElizaOS</p>
      </div>
    </div>
  </div>

  <script>
    // Fetch agents from ElizaOS API
    async function loadAgents() {
      try {
        // Try to fetch agents from ElizaOS API
        const response = await fetch('/api/agents');
        if (!response.ok) throw new Error('Failed to fetch agents');

        const data = await response.json();
        const agents = Array.isArray(data) ? data : (data.agents || []);

        renderAgents(agents);
      } catch (error) {
        console.error('Error loading agents:', error);
        renderEmptyState();
      }
    }

    function renderAgents(agents) {
      const container = document.getElementById('agent-container');

      if (!agents || agents.length === 0) {
        renderEmptyState();
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'agent-grid';

      agents.forEach(agent => {
        const card = createAgentCard(agent);
        grid.appendChild(card);
      });

      container.innerHTML = '';
      container.appendChild(grid);
    }

    function createAgentCard(agent) {
      const card = document.createElement('div');
      card.className = 'agent-card';

      const agentId = agent.id || agent.agentId || 'unknown';
      const agentName = agent.name || agent.character?.name || 'Agent';
      const agentStatus = agent.status || 'online';

      card.innerHTML = \`
        <div class="agent-header">
          <div class="agent-avatar">🤖</div>
          <div class="agent-info">
            <h3>\${agentName}</h3>
            <div class="agent-status">Status: <strong>\${agentStatus}</strong></div>
          </div>
        </div>
        <div class="agent-actions">
          <a href="/hyperscape/auth?agentId=\${encodeURIComponent(agentId)}"
             target="_blank"
             class="agent-btn btn-login">
            🔐 Login
          </a>
          <button onclick="openViewport('\${agentId}')"
                  class="agent-btn btn-viewport">
            📺 View
          </button>
        </div>
      \`;

      return card;
    }

    function renderEmptyState() {
      const container = document.getElementById('agent-container');
      container.innerHTML = \`
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h2>No Active Agents</h2>
          <p>No Hyperscape agents are currently running. Start an agent from ElizaOS.</p>
        </div>
      \`;
    }

    function openViewport(agentId) {
      // Check if viewport already exists
      let viewportContainer = document.getElementById('hyperscape-viewport-' + agentId);

      if (viewportContainer) {
        // Toggle visibility
        const isHidden = viewportContainer.style.display === 'none';
        viewportContainer.style.display = isHidden ? 'block' : 'none';
        return;
      }

      // Create viewport container
      viewportContainer = document.createElement('div');
      viewportContainer.id = 'hyperscape-viewport-' + agentId;
      viewportContainer.style.cssText = \`
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 640px;
        height: 480px;
        background: #1f2937;
        border: 2px solid #667eea;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
      \`;

      // Create header
      const header = document.createElement('div');
      header.style.cssText = \`
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 10px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
      \`;
      header.innerHTML = \`
        <span style="font-size: 14px; font-weight: 600;">🎮 Agent Viewport - \${agentId}</span>
        <div style="display: flex; gap: 6px;">
          <button id="expand-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">⛶</button>
          <button id="close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">✕</button>
        </div>
      \`;

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.src = '/hyperscape/viewport/' + encodeURIComponent(agentId);
      iframe.style.cssText = \`
        width: 100%;
        height: 100%;
        border: none;
        flex: 1;
        background: #000;
      \`;
      iframe.allow = 'autoplay; fullscreen';

      viewportContainer.appendChild(header);
      viewportContainer.appendChild(iframe);
      document.body.appendChild(viewportContainer);

      // Make draggable
      let isDragging = false;
      let currentX, currentY, initialX, initialY;

      header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        initialX = e.clientX - viewportContainer.offsetLeft;
        initialY = e.clientY - viewportContainer.offsetTop;
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        viewportContainer.style.left = currentX + 'px';
        viewportContainer.style.top = currentY + 'px';
        viewportContainer.style.right = 'auto';
        viewportContainer.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // Close button
      header.querySelector('#close-btn').addEventListener('click', () => {
        viewportContainer.style.display = 'none';
      });

      // Expand button
      let isExpanded = false;
      header.querySelector('#expand-btn').addEventListener('click', () => {
        if (isExpanded) {
          viewportContainer.style.width = '640px';
          viewportContainer.style.height = '480px';
          isExpanded = false;
        } else {
          viewportContainer.style.width = '1024px';
          viewportContainer.style.height = '768px';
          isExpanded = true;
        }
      });

      console.log('✅ Viewport opened for agent:', agentId);
    }

    // Load agents on page load
    loadAgents();

    // Auto-refresh every 30 seconds
    setInterval(loadAgents, 30000);
  </script>
</body>
</html>
`;

export const dashboardRoute: Route = {
  type: "GET",
  path: "/hyperscape/control",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      logger.info("[HyperscapePlugin] Dashboard accessed");
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Cache-Control", "no-cache");
      res.send(dashboardHTML);
    } catch (error) {
      logger.error(
        "[HyperscapePlugin] Dashboard route error:",
        error instanceof Error ? error.message : String(error),
      );
      res
        .status(500)
        .send("<html><body><h1>Error loading dashboard</h1></body></html>");
    }
  },
};
