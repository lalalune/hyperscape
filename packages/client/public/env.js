// Runtime environment configuration
// This file is loaded at runtime to override build-time environment variables.
// In development, defaults are used. In production, this file is generated
// by the deployment platform (Cloudflare Pages, Vercel, etc.) with actual values.
//
// Example production content:
//   window.env = {
//     PUBLIC_CDN_URL: "https://assets.hyperia.club",
//     PUBLIC_WS_URL: "wss://hyperia.gg/ws",
//     PUBLIC_API_URL: "https://hyperia.gg",
//   };
//
// In local Vite dev, serve sane runtime defaults so the client does not inherit
// stale workspace-root PUBLIC_* values intended for the game server process.
(() => {
  const env = typeof window.env === "object" && window.env ? window.env : {};
  const currentPort = window.location.port;
  const isLocalDevServer =
    currentPort === "3333" || currentPort === "4173" || currentPort === "5173";

  if (isLocalDevServer) {
    const host = window.location.hostname || "127.0.0.1";
    env.PUBLIC_API_URL ||= `http://${host}:5555`;
    env.PUBLIC_WS_URL ||= `ws://${host}:5556/ws`;
    env.PUBLIC_CDN_URL ||= `http://${host}:5555/game-assets`;
  }

  window.env = env;
})();
