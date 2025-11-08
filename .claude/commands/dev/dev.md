---
description: Start asset-forge development servers (frontend + backend)
allowed-tools: [Bash]
argument-hint: [frontend|backend|all]
---

# Development Server

Start development servers for asset-forge with hot module replacement (HMR).

## Usage

- `/dev` or `/dev all` - Start both frontend and backend [RECOMMENDED]
- `/dev frontend` - Frontend only (Vite dev server)
- `/dev backend` - Backend only (Elysia API server)

## Start Both Servers (Default)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Starting Development Servers ===" && echo "Frontend: http://localhost:5173" && echo "Backend:  http://localhost:3004" && echo "Swagger:  http://localhost:3004/swagger" && echo && echo "Starting servers with HMR..." && bun run dev`
```

## Frontend Only (Vite)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Starting Frontend Dev Server ===" && echo "URL: http://localhost:5173" && echo "Hot reload enabled" && echo && bun run dev:frontend`
```

## Backend Only (Elysia)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Starting Backend API Server ===" && echo "API:     http://localhost:3004" && echo "Swagger: http://localhost:3004/swagger" && echo && bun run dev:backend`
```

## Server Endpoints

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3004
- **API Docs (Swagger)**: http://localhost:3004/swagger
- **Health Check**: http://localhost:3004/health

## Prerequisites

Before starting:

1. **Environment variables**: `.env` file configured (run `/ops/env-check`)
2. **Database**: Migrations applied (run `/db/migrate`)
3. **Dependencies**: Installed (run `bun install`)

## Troubleshooting

**Port already in use:**
```bash
!`lsof -ti:5173 | xargs kill -9 2>/dev/null && echo "✓ Killed process on port 5173" || echo "Port 5173 is free"`
```

**Database not found:**
```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && bun run db:migrate && echo "✓ Database created"`
```

## See Also

- `/ops/env-check` - Verify environment setup
- `/db/migrate` - Apply database migrations
- `/api-test` - Test API endpoints
