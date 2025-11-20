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
  <title>Hyperscape Control Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b0a15;
      color: rgba(232, 235, 244, 0.92);
      min-height: 100vh;
      position: relative;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background: rgba(11, 10, 21, 0.85);
      z-index: 0;
    }

    .header {
      background: linear-gradient(180deg, rgba(30, 20, 10, 0.9) 0%, rgba(20, 15, 10, 0.7) 100%);
      padding: 1.5rem 2rem;
      border-bottom: 1px solid rgba(139, 69, 19, 0.6);
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo-icon {
      font-size: 2rem;
      filter: drop-shadow(0 0 10px rgba(242, 208, 138, 0.5));
    }

    .logo-text h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0;
      color: #f2d08a;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .logo-text p {
      opacity: 0.8;
      font-size: 0.8rem;
      color: rgba(242, 208, 138, 0.8);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border-radius: 0.5rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      border: 1px solid rgba(242, 208, 138, 0.3);
      cursor: pointer;
      font-size: 0.875rem;
      font-family: 'Rubik', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .btn-primary {
      background: linear-gradient(135deg, rgba(139, 69, 19, 0.9) 0%, rgba(101, 50, 15, 0.95) 100%);
      color: #f2d08a;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, rgba(160, 80, 20, 0.9) 0%, rgba(120, 60, 20, 0.95) 100%);
      border-color: rgba(242, 208, 138, 0.6);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5), 0 0 10px rgba(242, 208, 138, 0.2);
    }

    .btn-secondary {
      background: rgba(242, 208, 138, 0.1);
      color: #f2d08a;
      border-color: rgba(242, 208, 138, 0.3);
    }

    .btn-secondary:hover {
      background: rgba(242, 208, 138, 0.2);
      border-color: rgba(242, 208, 138, 0.5);
      box-shadow: 0 0 10px rgba(242, 208, 138, 0.2);
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
      position: relative;
      z-index: 1;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid rgba(242, 208, 138, 0.2);
      padding-bottom: 0.5rem;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f2d08a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }

    .agent-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .agent-card {
      background: rgba(20, 15, 10, 0.75);
      border: 1px solid rgba(139, 69, 19, 0.4);
      border-radius: 0.75rem;
      padding: 1.5rem;
      transition: all 0.3s;
      position: relative;
      overflow: hidden;
    }

    .agent-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, transparent, #f2d08a, transparent);
      opacity: 0.5;
    }

    .agent-card:hover {
      border-color: #f2d08a;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 15px rgba(242, 208, 138, 0.1);
      transform: translateY(-4px);
    }

    .agent-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .agent-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2a1a0a 0%, #1a1005 100%);
      border: 2px solid rgba(242, 208, 138, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }

    .agent-info h3 {
      font-size: 1.25rem;
      margin: 0 0 0.25rem 0;
      color: #f2d08a;
    }

    .agent-status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid transparent;
    }

    .status-active {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border-color: rgba(34, 197, 94, 0.3);
    }

    .status-inactive {
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border-color: rgba(148, 163, 184, 0.3);
    }

    .agent-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .agent-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid rgba(242, 208, 138, 0.3);
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-family: 'Rubik', sans-serif;
    }

    .btn-login {
      background: rgba(242, 208, 138, 0.1);
      color: #f2d08a;
    }

    .btn-login:hover {
      background: rgba(242, 208, 138, 0.2);
      box-shadow: 0 0 10px rgba(242, 208, 138, 0.2);
    }

    .btn-viewport {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border-color: rgba(34, 197, 94, 0.3);
    }

    .btn-viewport:hover {
      background: rgba(34, 197, 94, 0.2);
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: rgba(15, 10, 5, 0.5);
      border-radius: 0.75rem;
      border: 2px dashed rgba(139, 69, 19, 0.3);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.5;
      filter: grayscale(100%) sepia(100%) hue-rotate(350deg) saturate(50%);
    }

    .empty-title {
      font-size: 1.5rem;
      margin: 0 0 0.5rem 0;
      color: #f2d08a;
    }

    .empty-text {
      color: rgba(232, 235, 244, 0.5);
      margin: 0;
    }

    .loading {
      text-align: center;
      padding: 4rem 2rem;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(139, 69, 19, 0.3);
      border-top-color: #f2d08a;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
      box-shadow: 0 0 15px rgba(242, 208, 138, 0.2);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Viewport styles */
    .viewport-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 640px;
      height: 480px;
      background: #000;
      border: 2px solid #f2d08a;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 20px rgba(242, 208, 138, 0.3);
      z-index: 10000;
      display: flex;
      flex-direction: column;
    }

    .viewport-header {
      background: linear-gradient(180deg, rgba(30, 20, 10, 1) 0%, rgba(20, 15, 10, 1) 100%);
      color: #f2d08a;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
      border-bottom: 1px solid rgba(242, 208, 138, 0.3);
    }

    .viewport-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .viewport-controls {
      display: flex;
      gap: 8px;
    }

    .viewport-btn {
      background: rgba(242, 208, 138, 0.1);
      border: 1px solid rgba(242, 208, 138, 0.3);
      color: #f2d08a;
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
      transition: all 0.2s;
    }

    .viewport-btn:hover {
      background: rgba(242, 208, 138, 0.3);
      color: #fff;
    }

    .viewport-iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
      background: #000;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }
      .agent-grid {
        grid-template-columns: 1fr;
      }
      .viewport-container {
        width: 90vw;
        height: 60vh;
        bottom: 10px;
        right: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <div class="logo">
        <div class="logo-icon">⚔️</div>
        <div class="logo-text">
          <h1>Hyperscape</h1>
          <p>Control Panel</p>
        </div>
      </div>
      <div class="header-actions">
        <a href="http://localhost:3333" target="_blank" class="btn btn-primary">
          🚀 Game Client
        </a>
        <button onclick="location.reload()" class="btn btn-secondary">
          🔄 Refresh
        </button>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="section-header">
      <h2 class="section-title">🤖 AI Agents</h2>
    </div>

    <div id="agent-container">
      <div class="empty-state">
        <div class="empty-icon">🤖</div>
        <h2 class="empty-title">Loading agents...</h2>
        <p class="empty-text">Fetching active Hyperscape agents from ElizaOS</p>
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
      const isActive = agentStatus === 'online' || agentStatus === 'active';
      const statusClass = isActive ? 'status-active' : 'status-inactive';
      const statusDot = isActive ? '🟢' : '⚪';

      card.innerHTML = \`
        <div class="agent-header">
          <div class="agent-avatar">⚔️</div>
          <div class="agent-info">
            <h3>\${agentName}</h3>
            <div class="agent-status \${statusClass}">\${statusDot} \${agentStatus}</div>
          </div>
        </div>
        <div class="agent-actions">
          <a href="/hyperscape/auth?agentId=\${encodeURIComponent(agentId)}"
             target="_blank"
             class="agent-btn btn-login">
            🔐 Login
          </a>
          <button onclick="openViewport('\${agentId}', '\${agentName}')"
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
          <div class="empty-icon">📭</div>
          <h2 class="empty-title">No Active Agents</h2>
          <p class="empty-text">No Hyperscape agents are currently running. Start an agent from ElizaOS.</p>
        </div>
      \`;
    }

    function openViewport(agentId, agentName) {
      // Check if viewport already exists
      let viewportContainer = document.getElementById('hyperscape-viewport-' + agentId);

      if (viewportContainer) {
        // Toggle visibility
        const isHidden = viewportContainer.style.display === 'none';
        viewportContainer.style.display = isHidden ? 'flex' : 'none';
        return;
      }

      // Create viewport container
      viewportContainer = document.createElement('div');
      viewportContainer.id = 'hyperscape-viewport-' + agentId;
      viewportContainer.className = 'viewport-container';

      // Create header
      const header = document.createElement('div');
      header.className = 'viewport-header';
      header.innerHTML = \`
        <div class="viewport-title">⚔️ \${agentName || agentId}</div>
        <div class="viewport-controls">
          <button class="viewport-btn" id="expand-btn-\${agentId}">⛶</button>
          <button class="viewport-btn" id="close-btn-\${agentId}">✕</button>
        </div>
      \`;

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.src = '/hyperscape/viewport/' + encodeURIComponent(agentId);
      iframe.className = 'viewport-iframe';
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
      const closeBtn = document.getElementById('close-btn-' + agentId);
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          viewportContainer.style.display = 'none';
        });
      }

      // Expand button
      let isExpanded = false;
      const expandBtn = document.getElementById('expand-btn-' + agentId);
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
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
      }

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
