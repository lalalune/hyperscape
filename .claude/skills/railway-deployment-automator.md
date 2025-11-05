# Railway Deployment Automator

## Activation
When the user mentions any of these, activate this skill:
- "deploy to railway"
- "railway deployment"
- "railway up"
- "deploy service to railway"
- "railway project setup"
- "configure railway deployment"
- "railway CI/CD"
- "railway github actions"

## Purpose
Automates Railway.app deployments with best practices, including service configuration, environment variable setup, private networking, and CI/CD integration.

## Context
Railway.app is a modern cloud platform that simplifies application deployment with zero-configuration infrastructure, automatic scaling, and built-in support for databases, Docker images, and GitHub integration. This skill helps developers deploy and manage applications on Railway efficiently from local development environments.

## Core Capabilities

### 1. Project Initialization & Linking
- Initialize new Railway projects
- Link existing local projects to Railway
- Configure multiple environments (development, staging, production)
- Set up service connections and dependencies

### 2. Deployment Workflows
- **Standard deployment**: Deploy from local directory
- **GitHub integration**: Automatic deployments from GitHub repositories
- **Docker deployment**: Deploy custom Docker images
- **Monorepo support**: Deploy specific services from monorepos

### 3. Environment Variable Management
- Set up environment-specific variables
- Configure shared variables across services
- Use reference variables for inter-service communication
- Import variables from .env files
- Manage secrets securely

### 4. Private Networking Configuration
- Configure private networking between services
- Set up DATABASE_URL with private domains
- Configure service-to-service communication
- Use RAILWAY_PRIVATE_DOMAIN for internal connections

### 5. Database Integration
- Connect Postgres databases
- Configure Redis instances
- Set up MongoDB connections
- Integrate MySQL databases

### 6. CI/CD Integration
- GitHub Actions workflows
- GitLab CI pipelines
- Project token management
- Automated deployment scripts

## Implementation Patterns

### Basic Deployment Setup

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project and link to Railway
railway init
railway link

# Deploy the application
railway up
```

### Environment Variable Configuration

```bash
# Run locally with Railway environment variables
railway run npm run dev

# Open shell with Railway variables
railway shell

# Set environment variables (use Railway Dashboard or GraphQL API)
# For CI/CD, use RAILWAY_TOKEN
export RAILWAY_TOKEN=your_project_token
railway up --service=api
```

### Private Networking Setup

```env
# Use private domains for inter-service communication
DATABASE_URL=postgresql://${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/mydb
REDIS_URL=redis://${{Redis.RAILWAY_PRIVATE_DOMAIN}}:6379
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}

# Important: Use http:// not https:// for private network
# Private networking only works at runtime, not during build
```

### Multi-Environment Deployment

```bash
# Switch to production environment
railway environment production

# Deploy to specific environment
railway up --environment=production

# Run command in specific environment
railway run --environment=staging npm run migrate
```

### GitHub Actions CI/CD

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm i -g @railway/cli

      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: railway up --service=${{ secrets.SERVICE_ID }}
```

### Service Configuration (railway.json)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Best Practices

### 1. Environment Separation
- **Always** use separate environments for development, staging, and production
- **Never** test destructive operations in production
- Use `railway environment` to switch contexts

### 2. Variable Management
- **Use reference variables** instead of hardcoding values
- **Use shared variables** for common configuration across services
- **Keep secrets** in Railway, not in .env files committed to git
- **Use private domains** for inter-service communication

### 3. Local Development
- **Use `railway run`** to test with production-like environment variables
- **Use `railway shell`** for interactive debugging with Railway variables
- **Test migrations** locally before deploying: `railway run npm run migrate`

### 4. Database Safety
- **Always backup** before running migrations: `railway connect Postgres` then `pg_dump`
- **Use Railway's backup feature** for production databases
- **Test migrations** in staging environment first

### 5. Deployment Safety
- **Use `--detach` flag** for CI/CD deployments to avoid timeouts
- **Monitor logs** during deployment: `railway logs`
- **Use health checks** to ensure service is running after deployment
- **Configure restart policies** for automatic recovery

### 6. Cost Optimization
- **Use private networking** to avoid egress fees for service-to-service communication
- **Configure resource limits** appropriately for each service
- **Use Railway's sleep feature** for non-production environments
- **Monitor usage** in Railway dashboard

### 7. Security
- **Never commit** RAILWAY_TOKEN to version control
- **Use project tokens** (not account tokens) for CI/CD
- **Rotate tokens regularly**
- **Use Railway's private networking** instead of exposing all services publicly

## Common Workflows

### 1. Deploy New Application

```bash
# Initialize and link project
railway init
railway link

# Set up environment variables
railway variables

# Deploy application
railway up

# View logs
railway logs
```

### 2. Update Existing Deployment

```bash
# Ensure you're linked to correct project
railway status

# Deploy updates
railway up

# Monitor deployment
railway logs --follow
```

### 3. Database Migration

```bash
# Run migration with Railway environment
railway run npm run migrate

# Or connect directly to database
railway connect Postgres
```

### 4. Debugging Production Issues

```bash
# View recent logs
railway logs

# Open shell with production variables
railway shell

# Run diagnostic commands
railway run npm run health-check
```

### 5. Multi-Service Deployment

```bash
# Deploy specific service
railway up --service=api

# Deploy all services in monorepo
railway up --service=api
railway up --service=worker
railway up --service=frontend
```

## Troubleshooting

### Build Failures
- Check build logs: `railway logs`
- Verify build command in railway.json
- Ensure all dependencies are in package.json
- Check if private networking is being used during build (not supported)

### Connection Issues
- Verify private networking configuration
- Check if using http:// (not https://) for private domains
- Ensure services are in same project and environment
- Verify reference variables are correctly formatted

### Environment Variable Issues
- Confirm variables are set in correct environment
- Check variable references syntax: `${{service.VARIABLE}}`
- Use `railway run env` to verify variables are available
- Ensure RAILWAY_TOKEN is set for CI/CD

### Deployment Hangs
- Use `--detach` flag for CI/CD: `railway up --detach`
- Check service status in Railway dashboard
- Verify start command is correct
- Check if application is listening on $PORT

## Integration with Other Services

### Postgres Database
```bash
# Add Postgres to project
railway add --database postgres

# Connect to database
railway connect Postgres

# Use in application
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Redis Cache
```bash
# Add Redis to project
railway add --database redis

# Use in application
REDIS_URL=${{Redis.REDIS_URL}}
```

### MinIO Object Storage
```bash
# Deploy MinIO template
# Then configure in your application
MINIO_ENDPOINT=${{MinIO.RAILWAY_PRIVATE_DOMAIN}}
MINIO_PORT=${{MinIO.PORT}}
MINIO_ACCESS_KEY=${{MinIO.MINIO_ROOT_USER}}
MINIO_SECRET_KEY=${{MinIO.MINIO_ROOT_PASSWORD}}
```

### Qdrant Vector Database
```bash
# Deploy Qdrant template
# Then configure in your application
QDRANT_URL=http://${{Qdrant.RAILWAY_PRIVATE_DOMAIN}}:${{Qdrant.PORT}}
QDRANT_API_KEY=${{Qdrant.QDRANT__SERVICE__API_KEY}}
```

## Output Format

When activated, provide:
1. **Current configuration analysis** - Review existing setup
2. **Deployment recommendations** - Best practices for the specific use case
3. **Step-by-step deployment plan** - Clear, ordered instructions
4. **Configuration examples** - Actual code snippets for railway.json, .env, etc.
5. **Verification steps** - How to confirm successful deployment
6. **Monitoring guidance** - How to monitor and debug the deployment

## Example Response

When user says: "Deploy my Next.js app to Railway with Postgres"

Response:
```
I'll help you deploy your Next.js application to Railway with Postgres. Here's the complete setup:

## 1. Installation & Setup

First, install the Railway CLI:
```bash
npm i -g @railway/cli
railway login
```

## 2. Initialize Project

```bash
# In your Next.js project root
railway init
```

## 3. Add Postgres Database

```bash
railway add --database postgres
```

## 4. Configure Environment Variables

Create these variables in Railway Dashboard:
- `DATABASE_URL`: ${{Postgres.DATABASE_URL}} (auto-configured)
- `NODE_ENV`: production
- `NEXTAUTH_URL`: https://${{RAILWAY_STATIC_URL}}
- `NEXTAUTH_SECRET`: [generate secure secret]

## 5. Create railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 6. Deploy

```bash
railway up
```

## 7. Run Database Migrations

```bash
railway run npx prisma migrate deploy
```

## 8. Verify Deployment

```bash
railway logs
railway status
railway open
```

Your Next.js app is now deployed! Access it via the URL shown in `railway open`.

## Next Steps:
- Set up custom domain in Railway Dashboard
- Configure GitHub auto-deployments
- Set up staging environment
- Configure monitoring and alerts
```

## Notes
- Always verify Railway CLI version compatibility with latest features
- Check Railway status page for platform issues if deployments fail
- Use Railway Discord/Help Station for complex issues
- Keep Railway CLI updated: `npm update -g @railway/cli`
