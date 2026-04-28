// Runtime environment configuration
// This file is loaded at runtime to override build-time environment variables.
// In development, defaults are used. In production, runtime host-specific
// overrides keep manually deployed Pages builds pointed at the correct backend.
//
// Example production content:
//   window.env = {
//     PUBLIC_CDN_URL: "https://assets.hyperscape.club",
//     PUBLIC_WS_URL: "wss://hyperscape.gg/ws",
//     PUBLIC_API_URL: "https://hyperscape.gg",
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
    const hostname = window.location.hostname || "127.0.0.1";
    const host = hostname || "127.0.0.1";
    env.PUBLIC_API_URL ||= `http://${host}:5555`;
    env.PUBLIC_WS_URL ||= `ws://${host}:5556/ws`;
    env.PUBLIC_CDN_URL ||= `http://${host}:5555/game-assets`;
    env.PUBLIC_ELIZAOS_URL ||= `http://${host}:5555`;
  }

  window.env = env;
})();
