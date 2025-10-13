# GitHub Actions CI/CD

This directory contains the GitHub Actions workflows for the Hyperscape monorepo.

## Monorepo Structure

The workflows are configured for the following core packages:
- **`shared`** - Core game engine and shared utilities (ECS, systems, managers)
- **`server`** - WebSocket game server (Fastify + PostgreSQL + LiveKit)
- **`client`** - React web client (Vite + Three.js + VRM avatars)

Additional packages:
- **`asset-forge`** - Asset generation pipeline (Meshy AI + manual tools)
- **`plugin-hyperscape`** - ElizaOS plugin for AI agent integration
- **`physx-js-webidl`** - PhysX physics engine WASM bindings

## Workflows

### 🔄 CI Workflow (`ci.yml`)
Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
- **Lint**: Runs ESLint across all packages
- **Test**: Runs all tests with Postgres service
- **Build**: Builds all packages and uploads artifacts
- **Docker**: Builds Docker image (main branch only)

### 🚀 Deploy Workflow (`deploy.yml`)
Manual deployment workflow for Cloudflare.

**Triggers:** Manual dispatch only

**Environments:**
- `staging` - Deploy to staging environment
- `production` - Deploy to production environment

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token for deployments
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `PRODUCTION_URL` - Production URL for verification (production only)

### 🔗 Integration Tests (`integration.yml`)
Runs integration tests to validate system components.

**Features:**
- Server health checks
- Asset pipeline validation
- DataManager verification
- Postgres database service
- Screenshot and log artifacts
- 30-minute timeout for long-running tests

### ✅ Type Check (`typecheck.yml`)
Validates TypeScript types across all packages.

**Features:**
- Checks all packages with tsconfig.json
- Builds shared package first for type dependencies
- Ensures strong typing is maintained

### 🔒 Security (`security.yml`)
Automated security scanning.

**Schedule:** Weekly on Mondays + every push/PR

**Features:**
- npm dependency audit
- CodeQL static analysis for JavaScript/TypeScript
- Automatic vulnerability detection

### 🔒 Dependabot (`dependabot.yml`)
Automated dependency updates.

**Updates:**
- NPM packages (weekly)
- GitHub Actions (monthly)
- Docker images (monthly)
- Grouped TypeScript and testing dependencies

## Setting Up Secrets

### Repository Secrets
Navigate to: `Settings → Secrets and variables → Actions → Repository secrets`

Add the following secrets:
```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```

### Environment Secrets
Create environments: `Settings → Environments`

**Staging Environment:**
- No required secrets (uses defaults)

**Production Environment:**
- `PRODUCTION_URL` - Your production URL for verification
- Enable "Required reviewers" for protection

## Local Testing

Test the CI pipeline locally:

```bash
# Install dependencies
bun install

# Run linting
bun run lint

# Start Postgres for testing
cd packages/server && bun run db:up && cd ../..

# Run tests
bun run test

# Build packages (in order)
cd packages/shared && bun run build && cd ../..
cd packages/server && bun run build && cd ../..
cd packages/client && bun run build && cd ../..

# Or use turbo to build all at once
bun run build
```

## Package Build Order

The monorepo has dependencies between packages:
1. **`shared`** - Must be built first (core types and utilities)
2. **`server`** - Depends on shared
3. **`client`** - Depends on shared

The workflows respect this build order automatically.

## Manual Deployment

To deploy manually:

1. Go to `Actions → Deploy to Cloudflare`
2. Click "Run workflow"
3. Select environment (staging/production)
4. Click "Run workflow"

## Troubleshooting

### Test Failures
- Check uploaded artifacts in the workflow run
- Review `test-logs` artifact for detailed logs
- Check `playwright-report` for visual test results

### Build Failures
- Ensure all TypeScript types are correct
- Check that all dependencies are listed in package.json
- Verify build scripts work locally first

### Deployment Failures
- Verify Cloudflare secrets are set correctly
- Check Cloudflare account has necessary permissions
- Review deployment logs in the workflow run

