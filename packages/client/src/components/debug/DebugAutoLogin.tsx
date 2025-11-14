import { useEffect } from "react";

/**
 * Debug component to auto-skip login and character creation
 * Activated via ?debug=true query parameter
 */
export function DebugAutoLogin({ onAutoLogin }: { onAutoLogin?: () => void }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get("debug") === "true";

    if (isDebug && onAutoLogin) {
      console.log("[DEBUG] Auto-login enabled");
      // Auto-login after 2 seconds
      setTimeout(() => {
        onAutoLogin();
      }, 2000);
    }
  }, [onAutoLogin]);

  return null;
}

/**
 * Check if debug mode is enabled
 */
export function isDebugMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "true" || process.env.NODE_ENV === "test";
}

/**
 * Auto-create test character if debug mode
 */
export function getDebugCharacter() {
  return {
    name: "TestPlayer_" + Math.random().toString(36).slice(2, 8),
    class: "warrior",
    autoJoin: true,
  };
}
