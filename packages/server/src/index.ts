/**
 * Hyperia Server - Main entry point for the game server
 *
 * This is the primary server file that initializes and runs the Hyperia multiplayer game server.
 * It orchestrates all startup modules in the correct sequence.
 *
 * **Server Architecture**:
 * ```
 * Client (Browser) ←→ Fastify HTTP Server ←→ Hyperia World (ECS)
 *                          ↓                        ↓
 *                    WebSocket Handler        Game Systems
 *                          ↓                   (Combat, Inventory, etc.)
 *                    ServerNetwork                 ↓
 *                          ↓              PostgreSQL + Drizzle ORM
 *                    DatabaseSystem
 * ```
 *
 * **Initialization Sequence**:
 * 1. Load polyfills (make Node.js browser-compatible for Three.js)
 * 2. Load configuration (environment variables, paths)
 * 3. Initialize database (Docker PostgreSQL, Drizzle ORM, migrations)
 * 4. Create Hyperia World (ECS with all systems)
 * 5. Set up HTTP server (Fastify with static files)
 * 6. Register API routes (health, status, actions, uploads)
 * 7. Register WebSocket endpoint (multiplayer)
 * 8. Start listening for connections
 * 9. Register graceful shutdown handlers
 *
 * **Key Features**:
 * - **Hot Reload**: SIGUSR2 signal triggers graceful restart in development
 * - **Graceful Shutdown**: Cleans up database, WebSockets, Docker on SIGINT/SIGTERM
 * - **Modular Architecture**: Each concern is in its own module under /startup/
 * - **Production-Ready**: Proper error handling, logging, and resource cleanup
 * - **Static Assets**: Serves game assets with aggressive caching
 * - **WebSocket Multiplayer**: Real-time player synchronization
 * - **Privy Auth**: Optional wallet/social authentication
 * - **CDN Support**: Configurable asset CDN (R2, S3, local)
 *
 * **Environment Variables**:
 * See startup/config.ts for complete list of environment variables.
 *
 * **Modules**:
 * - startup/config.ts - Configuration and path resolution
 * - startup/database.ts - Database initialization and Docker management
 * - startup/world.ts - World creation and system registration
 * - startup/http-server.ts - Fastify setup and static file serving
 * - startup/api-routes.ts - REST API endpoint handlers
 * - startup/websocket.ts - WebSocket connection handling
 * - startup/shutdown.ts - Graceful shutdown and cleanup
 *
 * **Referenced by**: Package scripts (npm run dev, npm start), Docker containers
 */

// ============================================================================
// POLYFILLS - MUST BE FIRST
// ============================================================================
// Static imports are evaluated before module body execution. If any imported
// module (directly or via @hyperforge/shared) pulls in `three/webgpu`, Bun will
// crash unless WebGPU-ish globals exist. So we install polyfills first, then
// load the real startup module via dynamic import.
import "./shared/polyfills.js";

await import("./main.js");
