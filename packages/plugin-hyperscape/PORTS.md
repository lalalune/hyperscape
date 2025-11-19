# Port Configuration Guide

This document outlines all port assignments for the Hyperscape ecosystem to ensure services don't interfere with each other.

## Port Assignments

### Hyperscape Services

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| **Hyperscape Server** | `5555` | HTTP/WebSocket | Main game server (Fastify) |
| **Hyperscape Client** | `3333` | HTTP | Vite dev server for React client |
| **CDN/Assets** | `8080` | HTTP | Static asset CDN (optional, Docker) |
| **PostgreSQL** | `5432` | TCP | Database (Docker container) |

### ElizaOS Services

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| **ElizaOS Server** | `3000` | HTTP | ElizaOS API server (if running) |
| **ElizaOS UI** | `4000` | HTTP | ElizaOS frontend UI (if running) |

## WebSocket Endpoints

- **Hyperscape Game Server**: `ws://localhost:5555/ws`
- **ElizaOS** (if running): `ws://localhost:3000` (if WebSocket enabled)

## Configuration Files

### Hyperscape Server (`packages/server/env.example`)
```bash
PORT=5555                    # Hyperscape server port
PUBLIC_CDN_URL=http://localhost:8080  # CDN port (optional)
PUBLIC_WS_URL=ws://localhost:5555/ws  # WebSocket URL
```

### Hyperscape Client (`packages/client/vite.config.ts`)
```typescript
port: Number(env.VITE_PORT) || 3333  # Vite dev server port
```

### Plugin Configuration (`packages/plugin-hyperscape/src/index.ts`)
```typescript
HYPERSCAPE_SERVER_URL: z.string().url().default('ws://localhost:5555/ws')
```

## CORS Configuration

The Hyperscape server allows connections from these origins:
- `http://localhost:3000` (ElizaOS server)
- `http://localhost:3333` (Hyperscape client)
- `http://localhost:5555` (Hyperscape server)
- `http://localhost:7777` (Additional dev port)
- Any `localhost` port (development)

## Running Multiple Services

### Development Setup

1. **Start Hyperscape Server** (port 5555):
   ```bash
   cd packages/server
   bun run dev
   ```

2. **Start Hyperscape Client** (port 3333):
   ```bash
   cd packages/client
   bun run dev
   ```

3. **Start ElizaOS** (port 3000, optional):
   ```bash
   elizaos start
   ```

4. **Start CDN** (port 8080, optional):
   ```bash
   bun run cdn:up
   ```

### Port Conflicts

If you need to change ports:

1. **Change Hyperscape Server Port**:
   ```bash
   # In packages/server/.env
   PORT=5556  # Change to desired port
   ```

2. **Change Hyperscape Client Port**:
   ```bash
   # In packages/client/.env
   VITE_PORT=3334  # Change to desired port
   ```

3. **Update Plugin Configuration**:
   ```bash
   # In your ElizaOS character config or .env
   HYPERSCAPE_SERVER_URL=ws://localhost:5556/ws
   ```

## Testing Ports

To verify ports are available:

```bash
# Check if port is in use
lsof -i :5555  # Hyperscape server
lsof -i :3333  # Hyperscape client
lsof -i :3000  # ElizaOS
lsof -i :8080  # CDN
```

## Summary

✅ **No Conflicts**: All services use different ports:
- Hyperscape Server: `5555`
- Hyperscape Client: `3333`
- ElizaOS: `3000` (if running)
- CDN: `8080` (optional)
- PostgreSQL: `5432` (Docker)

The plugin correctly defaults to `ws://localhost:5555/ws` to connect to the Hyperscape server.

