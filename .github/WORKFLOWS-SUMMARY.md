# GitHub Workflows Summary

## Overview
All workflows are configured to use **Bun** as the runtime and properly handle the monorepo structure with the correct build order.

## Package Structure
```
packages/
├── shared/          # Core engine (built first)
├── server/          # Game server (depends on shared)
├── client/          # Web client (depends on shared)
├── plugin-hyperscape/  # ElizaOS plugin
├── 3d-asset-forge/     # Asset generation
└── physx-js-webidl/    # Physics WASM
```

## Workflow Files

### 1. `ci.yml` - Continuous Integration
**Triggers:** Push/PR to main/develop  
**Jobs:**
- Lint → Test → Build → Docker
- Builds packages in dependency order: shared → server → client
- Uploads artifacts for 7 days

### 2. `deploy.yml` - Cloudflare Deployment
**Triggers:** Manual dispatch  
**Jobs:**
- Builds all packages
- Deploys server to Cloudflare Workers/Containers
- Deploys client to Cloudflare Pages
- Verifies production deployments

### 3. `integration.yml` - Integration Tests
**Triggers:** Push/PR to main/develop  
**Jobs:**
- Spins up Postgres service
- Starts server in background
- Runs integration test suite
- Uploads test results and logs

### 4. `typecheck.yml` - TypeScript Validation
**Triggers:** Push/PR to main/develop  
**Jobs:**
- Builds shared package for types
- Type checks all packages sequentially
- Ensures no TypeScript errors

### 5. `security.yml` - Security Scanning
**Triggers:** Push/PR + Weekly schedule  
**Jobs:**
- npm dependency audit
- CodeQL static analysis
- Automatic vulnerability detection

### 6. `dependabot.yml` - Automated Updates
**Schedule:**
- npm packages: Weekly
- GitHub Actions: Monthly
- Docker images: Monthly
- Groups related dependencies

## Environment Variables

### Required Secrets
- `CLOUDFLARE_API_TOKEN` - For deployments
- `CLOUDFLARE_ACCOUNT_ID` - Account identifier
- `PRODUCTION_URL` - Production URL (for verification)

### Runtime Environment
- `DATABASE_URL` - PostgreSQL connection (provided by service)
- `NODE_ENV` - Set to `test` or `production`
- `PORT` - Server port (default: 5555)

## Build Order
1. **shared** - Core types, systems, managers
2. **server** - Depends on shared types
3. **client** - Depends on shared types

All workflows respect this order automatically.

## Database Lifecycle
Postgres is managed via GitHub service containers:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: hyperscape
      POSTGRES_PASSWORD: hyperscape_test
      POSTGRES_DB: hyperscape_test
```

Automatically started before tests and torn down after.

## Docker Strategy
**Local Development:**
- Run Postgres in Docker: `bun run db:up`
- Run server locally: `bun run dev`

**Production:**
- Single Dockerfile using Bun
- Optimized for Cloudflare deployment
- Connects to managed Postgres via DATABASE_URL

## Testing Strategy
- **Unit tests** - Via vitest (test.ts files)
- **Integration tests** - Via test-integration.mjs
- **Type checking** - Via tsc --noEmit
- **Linting** - Via ESLint

## Artifact Retention
- Build artifacts: 7 days
- Test results: 14 days
- Logs: 7 days

## Status Badges
Add to README.md:
```markdown
![CI](https://github.com/YOUR_ORG/hyperscape-2/workflows/CI/badge.svg)
![Integration Tests](https://github.com/YOUR_ORG/hyperscape-2/workflows/Integration%20Tests/badge.svg)
![Type Check](https://github.com/YOUR_ORG/hyperscape-2/workflows/TypeScript%20Type%20Check/badge.svg)
![Security](https://github.com/YOUR_ORG/hyperscape-2/workflows/Security/badge.svg)
```

