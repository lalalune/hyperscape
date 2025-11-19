// Hyperscape Login Button - Auto-inject into ElizaOS UI
// This script automatically adds a login button to the top-right corner

(function () {
  "use strict";

  function injectLoginButton() {
    // Check if already injected
    if (document.getElementById("hyperscape-main-login-btn")) {
      return;
    }

    // Create button container
    const container = document.createElement("div");
    container.id = "hyperscape-main-login-btn";
    container.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999";

    // Create login button
    const button = document.createElement("a");
    button.href = "/hyperscape/login";
    button.target = "_blank";
    button.style.cssText =
      "display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 4px 12px rgba(102,126,234,0.3);transition:transform 0.2s,box-shadow 0.2s";
    button.innerHTML = "🔐 Hyperscape Login";
    button.title = "Login to Hyperscape";

    button.addEventListener("mouseenter", () => {
      button.style.transform = "translateY(-2px)";
      button.style.boxShadow = "0 6px 16px rgba(102,126,234,0.4)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "translateY(0)";
      button.style.boxShadow = "0 4px 12px rgba(102,126,234,0.3)";
    });

    container.appendChild(button);
    document.body.appendChild(container);

    console.log("✅ Hyperscape login button added");
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectLoginButton);
  } else {
    injectLoginButton();
  }
})();
