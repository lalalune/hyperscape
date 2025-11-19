/**
 * Main UI Injector - Adds login button directly to ElizaOS main UI
 *
 * This route serves a script that can be injected into the main ElizaOS page
 * to add a login button that's always visible
 */

import type { Route } from "@elizaos/core";
import { logger } from "@elizaos/core";

const mainUIInjectorScript = `
(function() {
  'use strict';
  
  // Inject login button into main UI
  function injectMainLoginButton() {
    // Check if already injected
    if (document.getElementById('hyperscape-main-login-btn')) {
      return;
    }
    
    // Find the main header/nav/header area
    const headerSelectors = [
      'header',
      'nav',
      '[role="banner"]',
      '[class*="header"]',
      '[class*="Header"]',
      '[class*="nav"]',
      '[class*="Nav"]',
      'div[class*="top"]',
      'div[class*="Top"]',
    ];
    
    let header = null;
    for (const selector of headerSelectors) {
      header = document.querySelector(selector);
      if (header) break;
    }
    
    // If no header, try to find the root or first major container
    if (!header) {
      header = document.querySelector('#root') || document.body;
    }
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'hyperscape-main-login-btn';
    buttonContainer.style.cssText = \`
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      gap: 10px;
      align-items: center;
    \`;
    
    // Create login button
    const loginBtn = document.createElement('a');
    loginBtn.href = '/hyperscape/auth';
    loginBtn.target = '_blank';
    loginBtn.style.cssText = \`
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    \`;
    loginBtn.innerHTML = '🔐 Hyperscape Login';
    loginBtn.title = 'Login to Hyperscape';
    
    loginBtn.addEventListener('mouseenter', () => {
      loginBtn.style.transform = 'translateY(-2px)';
      loginBtn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
    });
    
    loginBtn.addEventListener('mouseleave', () => {
      loginBtn.style.transform = 'translateY(0)';
      loginBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
    });
    
    buttonContainer.appendChild(loginBtn);
    document.body.appendChild(buttonContainer);
    
    console.log('✅ Hyperscape login button added to main UI');
  }
  
  // Run immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMainLoginButton);
  } else {
    injectMainLoginButton();
  }
})();
`;

const injectorPageHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add Hyperscape Login Button</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
      font-size: 28px;
    }
    .instructions {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .instructions code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin: 10px 5px;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .success {
      background: #e8f5e9;
      color: #2e7d32;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
      display: none;
    }
    .success.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Add Hyperscape Login Button</h1>
    
    <div class="instructions">
      <p><strong>Option 1: Auto-Inject (Recommended)</strong></p>
      <p>Click the button below to automatically add a login button to the ElizaOS UI:</p>
      <button class="button" onclick="injectButton()">Add Login Button to UI</button>
    </div>
    
    <div class="instructions">
      <p><strong>Option 2: Manual Injection</strong></p>
      <p>Open the browser console (F12) on the ElizaOS page and paste this code:</p>
      <code id="codeSnippet">Loading...</code>
      <button class="button" onclick="copyCode()" style="margin-top: 10px;">Copy Code</button>
    </div>
    
    <div class="success" id="successMsg">
      ✅ Login button added! Check the top-right corner of the ElizaOS UI.
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <a href="/" class="button">← Back to ElizaOS</a>
    </div>
  </div>
  
  <script>
    const injectorScript = ${JSON.stringify(mainUIInjectorScript)};
    
    document.getElementById('codeSnippet').textContent = injectorScript.trim();
    
    function injectButton() {
      // Try to inject into the parent window (if opened from ElizaOS)
      try {
        if (window.opener && !window.opener.closed) {
          const script = window.opener.document.createElement('script');
          script.textContent = injectorScript;
          window.opener.document.head.appendChild(script);
          document.getElementById('successMsg').classList.add('show');
          setTimeout(() => {
            window.close();
          }, 2000);
          return;
        }
      } catch (e) {
        console.log('Cannot access parent window, using current window');
      }
      
      // Inject into current window
      const script = document.createElement('script');
      script.textContent = injectorScript;
      document.head.appendChild(script);
      document.getElementById('successMsg').classList.add('show');
    }
    
    function copyCode() {
      const code = document.getElementById('codeSnippet').textContent;
      navigator.clipboard.writeText(code).then(() => {
        alert('Code copied! Paste it in the browser console on the ElizaOS page.');
      });
    }
    
    // Auto-inject if opened from ElizaOS
    if (window.opener) {
      setTimeout(injectButton, 500);
    }
  </script>
</body>
</html>
`;

export const mainUIInjectorRoute: Route = {
  type: "GET",
  path: "/hyperscape/add-button",
  public: true,
  handler: async (req, res, runtime) => {
    try {
      res.setHeader("Content-Type", "text/html");
      res.send(injectorPageHTML);
    } catch (error) {
      logger.error(
        "[HyperscapeAuth] Main UI injector route error:",
        error instanceof Error ? error.message : String(error),
      );
      res.status(500).send("Internal server error");
    }
  },
};
