/**
 * UI Injector Route - Injects login button into ElizaOS UI
 *
 * This route serves JavaScript that dynamically adds a login button
 * to the ElizaOS agent cards/interface
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

const injectorScript = `
(function() {
  'use strict';
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLoginButton);
  } else {
    injectLoginButton();
  }
  
  function injectLoginButton() {
    // Check if already injected
    if (document.getElementById('hyperscape-login-injected')) {
      return;
    }
    
    // Find agent cards/containers - common selectors in ElizaOS UI
    const selectors = [
      '[data-agent-id]',
      '[data-testid*="agent"]',
      '.agent-card',
      '.agent-item',
      'article[class*="agent"]',
      'div[class*="Agent"]',
    ];
    
    let agentElements = [];
    for (const selector of selectors) {
      agentElements = Array.from(document.querySelectorAll(selector));
      if (agentElements.length > 0) break;
    }
    
    // Also try to find elements by text content
    if (agentElements.length === 0) {
      const allElements = Array.from(document.querySelectorAll('*'));
      agentElements = allElements.filter(el => {
        const text = el.textContent || '';
        return text.includes('Agent') || text.includes('Character') || 
               el.getAttribute('id')?.includes('agent');
      });
    }
    
    // Function to add buttons to an element
    function addLoginButton(element, agentId) {
      // Check if buttons already exist
      if (element.querySelector('.hyperscape-login-btn')) {
        return;
      }

      // Create button container
      const container = document.createElement('div');
      container.style.cssText = 'display: inline-flex; gap: 6px; margin-left: 8px;';

      // Create login button
      const loginBtn = document.createElement('a');
      loginBtn.className = 'hyperscape-login-btn';
      loginBtn.href = '/hyperscape/auth?agentId=' + encodeURIComponent(agentId || '');
      loginBtn.target = '_blank';
      loginBtn.style.cssText = \`
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      \`;
      loginBtn.innerHTML = '🔐 Login';
      loginBtn.title = 'Login to Hyperscape';

      loginBtn.addEventListener('mouseenter', () => {
        loginBtn.style.transform = 'translateY(-1px)';
        loginBtn.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
      });

      loginBtn.addEventListener('mouseleave', () => {
        loginBtn.style.transform = 'translateY(0)';
        loginBtn.style.boxShadow = 'none';
      });

      // Create viewport button
      const viewportBtn = document.createElement('button');
      viewportBtn.className = 'hyperscape-viewport-btn';
      viewportBtn.style.cssText = \`
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      \`;
      viewportBtn.innerHTML = '📺 View';
      viewportBtn.title = 'View agent gameplay in real-time';

      viewportBtn.addEventListener('mouseenter', () => {
        viewportBtn.style.transform = 'translateY(-1px)';
        viewportBtn.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
      });

      viewportBtn.addEventListener('mouseleave', () => {
        viewportBtn.style.transform = 'translateY(0)';
        viewportBtn.style.boxShadow = 'none';
      });

      // Handle viewport button click
      viewportBtn.addEventListener('click', () => {
        openViewport(agentId);
      });

      container.appendChild(loginBtn);
      container.appendChild(viewportBtn);

      // Try to find a good place to insert the buttons
      const actionsContainer = element.querySelector('[class*="action"], [class*="button"], [class*="menu"]');
      if (actionsContainer) {
        actionsContainer.appendChild(container);
      } else {
        element.appendChild(container);
      }
    }

    // Function to open viewport iframe
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
        width: 480px;
        height: 360px;
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
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
      \`;
      header.innerHTML = \`
        <span style="font-size: 13px; font-weight: 600;">🎮 Agent Viewport</span>
        <div style="display: flex; gap: 4px;">
          <button id="expand-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">⛶</button>
          <button id="close-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">✕</button>
        </div>
      \`;

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.src = '/hyperscape/viewport/' + encodeURIComponent(agentId || '');
      iframe.style.cssText = \`
        width: 100%;
        height: 100%;
        border: none;
        flex: 1;
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
          viewportContainer.style.width = '480px';
          viewportContainer.style.height = '360px';
          isExpanded = false;
        } else {
          viewportContainer.style.width = '800px';
          viewportContainer.style.height = '600px';
          isExpanded = true;
        }
      });
    }
    
    // Try to extract agent ID from element
    function getAgentId(element) {
      // Try various attributes and text content
      let agentId = element.getAttribute('data-agent-id') ||
                    element.getAttribute('data-id') ||
                    element.getAttribute('id')?.replace(/[^0-9a-f-]/gi, '') ||
                    element.querySelector('[data-agent-id]')?.getAttribute('data-agent-id');
      
      // Try to extract UUID from text content
      if (!agentId) {
        const text = element.textContent || '';
        const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          agentId = uuidMatch[0];
        }
      }
      
      // Try to find in child elements
      if (!agentId) {
        const idElement = element.querySelector('[id*="agent"], [id*="character"], [data-id]');
        if (idElement) {
          agentId = idElement.getAttribute('id') || idElement.getAttribute('data-id');
        }
      }
      
      return agentId;
    }
    
    // Add buttons to found elements
    agentElements.forEach(element => {
      const agentId = getAgentId(element);
      addLoginButton(element, agentId);
    });
    
    // Also add a global button in the sidebar/header if found
    const sidebar = document.querySelector('aside, nav, [role="navigation"], [class*="sidebar"], [class*="nav"]');
    if (sidebar && !sidebar.querySelector('.hyperscape-login-btn')) {
      const globalButton = document.createElement('a');
      globalButton.className = 'hyperscape-login-btn';
      globalButton.href = '/hyperscape/auth';
      globalButton.target = '_blank';
      globalButton.style.cssText = \`
        display: block;
        padding: 10px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 500;
        margin: 10px;
        text-align: center;
      \`;
      globalButton.textContent = '🔐 Hyperscape Login';
      sidebar.insertBefore(globalButton, sidebar.firstChild);
    }
    
    // Mark as injected
    const marker = document.createElement('div');
    marker.id = 'hyperscape-login-injected';
    marker.style.display = 'none';
    document.body.appendChild(marker);
    
    // Use MutationObserver to add buttons to dynamically added agents
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node;
            if (selectors.some(sel => element.matches?.(sel)) || 
                element.textContent?.includes('Agent')) {
              const agentId = getAgentId(element);
              addLoginButton(element, agentId);
            }
            // Also check children
            const children = element.querySelectorAll?.(selectors.join(','));
            children?.forEach(child => {
              const agentId = getAgentId(child);
              addLoginButton(child, agentId);
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
`;

/**
 * UI Injector route - serves JavaScript to inject login button
 */
export const uiInjectorRoute: Route = {
  type: "GET",
  path: "/hyperscape/control-injector.js",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache");
      res.send(injectorScript);
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] UI injector route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).send("// Error loading injector script");
    }
  },
};
