# Railway Environment Manager

## Activation
When the user mentions any of these, activate this skill:
- "railway environment"
- "railway variables"
- "environment setup railway"
- "railway env sync"
- "railway staging production"
- "reference variables railway"
- "shared variables railway"
- "railway local development"

## Purpose
Manages environment variables, multi-environment configurations, and local development workflows on Railway. Provides best practices for variable management, environment separation, and secure configuration handling.

## Context
Railway supports multiple environments (development, staging, production) within a single project. Environment variables can be service-specific, shared across services, or reference other services' variables. Proper environment management is critical for secure, maintainable deployments.

## Core Capabilities

### 1. Environment Management
- Create and manage multiple environments
- Switch between environments
- Clone environments
- Environment-specific configurations

### 2. Variable Configuration
- Service-specific variables
- Shared variables across services
- Reference variables
- Secret management

### 3. Local Development
- Sync Railway variables locally
- Run commands with Railway environment
- Test with production-like configuration
- Development environment setup

### 4. Multi-Service Configuration
- Inter-service communication
- Private networking variables
- Database connection strings
- Service discovery

### 5. Security & Best Practices
- Secret rotation
- Environment isolation
- Variable validation
- Access control

## Implementation Patterns

### 1. Environment Setup

```bash
# List all environments
railway environment

# Create new environment
railway environment create staging

# Switch to environment
railway environment staging

# Set default environment
railway environment production --default

# Clone environment (copy variables)
# Note: Done via Railway Dashboard
# Project Settings → Environments → Clone Environment
```

### 2. Variable Configuration Patterns

#### Service-Specific Variables

```env
# Application configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Feature flags
FEATURE_BETA_UI=false
FEATURE_NEW_AUTH=true

# Application secrets
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here
ENCRYPTION_KEY=your-encryption-key-here

# External API keys
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG....
```

#### Database Connection Variables

```env
# Using Railway's auto-generated DATABASE_URL
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Or using private domain for better performance
DATABASE_URL=postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}

# Multiple databases
PRIMARY_DATABASE_URL=${{Postgres.DATABASE_URL}}
ANALYTICS_DATABASE_URL=${{AnalyticsDB.DATABASE_URL}}
CACHE_URL=${{Redis.REDIS_URL}}
```

#### Inter-Service Communication

```env
# API service URL (private network)
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}

# Worker service URL
WORKER_URL=http://${{worker.RAILWAY_PRIVATE_DOMAIN}}:${{worker.PORT}}

# Frontend URL (public)
FRONTEND_URL=https://${{frontend.RAILWAY_STATIC_URL}}

# Important: Always use http:// (not https://) for private network
# CORS origins
CORS_ORIGINS=${{frontend.RAILWAY_STATIC_URL}},${{admin.RAILWAY_STATIC_URL}}
```

#### Shared Variables

```env
# Set in Project Settings → Shared Variables
# These are available to ALL services

# Environment identifier
ENVIRONMENT=production

# Global configuration
APP_NAME=MyApplication
API_VERSION=v1
LOG_LEVEL=info

# Global secrets (use sparingly)
MASTER_ENCRYPTION_KEY=...
```

### 3. Local Development Setup

#### Using railway run

```bash
# Run development server with Railway variables
railway run npm run dev

# Run with specific environment
railway environment staging
railway run npm run dev

# Run database migrations
railway run npx prisma migrate deploy

# Run seed scripts
railway run npm run seed

# Run tests with Railway environment
railway run npm test
```

#### Using railway shell

```bash
# Open shell with Railway variables
railway shell

# Now all variables are available
echo $DATABASE_URL
echo $OPENAI_API_KEY

# Run any command
npm run dev
psql $DATABASE_URL
node scripts/test-connection.js

# Exit shell
exit
```

#### Environment File Generation

```typescript
// scripts/sync-env.ts
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

/**
 * Generate .env.local file from Railway environment
 * WARNING: This exposes production secrets locally - use with caution
 */
async function syncEnvironment() {
  try {
    // Get Railway variables
    const output = execSync('railway variables', { encoding: 'utf-8' });

    // Parse and format as .env
    const lines = output
      .split('\n')
      .filter(line => line.includes('='))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        return `${key.trim()}=${value.trim()}`;
      });

    // Write to .env.local
    writeFileSync('.env.local', lines.join('\n'));

    console.log('✅ Environment synced to .env.local');
    console.log('⚠️  WARNING: .env.local contains secrets - never commit this file');
  } catch (error) {
    console.error('❌ Failed to sync environment:', error);
    process.exit(1);
  }
}

syncEnvironment();
```

```bash
# Run sync script
railway run node scripts/sync-env.ts

# Add to .gitignore
echo ".env.local" >> .gitignore
```

### 4. Multi-Environment Configuration

#### Environment-Specific Settings

```typescript
// lib/config.ts
export const config = {
  environment: process.env.ENVIRONMENT || 'development',
  isProduction: process.env.ENVIRONMENT === 'production',
  isStaging: process.env.ENVIRONMENT === 'staging',
  isDevelopment: process.env.ENVIRONMENT === 'development',

  // Database
  database: {
    url: process.env.DATABASE_URL!,
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2'),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10'),
  },

  // API
  api: {
    port: parseInt(process.env.PORT || '3000'),
    url: process.env.API_URL || 'http://localhost:3000',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  // Services
  services: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    },
  },

  // Feature flags (environment-specific)
  features: {
    betaUI: process.env.FEATURE_BETA_UI === 'true',
    newAuth: process.env.FEATURE_NEW_AUTH === 'true',
    analytics: process.env.FEATURE_ANALYTICS !== 'false', // enabled by default
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.ENVIRONMENT !== 'production',
  },
};

// Validation
export function validateConfig(): void {
  const required = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

#### Environment-Specific Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:staging": "railway environment staging && railway run npm run dev",
    "dev:production": "railway environment production && railway run npm run dev",

    "build": "next build",
    "build:staging": "railway environment staging && railway up",
    "build:production": "railway environment production && railway up",

    "migrate": "prisma migrate deploy",
    "migrate:staging": "railway environment staging && railway run npm run migrate",
    "migrate:production": "railway environment production && railway run npm run migrate",

    "seed": "ts-node prisma/seed.ts",
    "seed:staging": "railway environment staging && railway run npm run seed",

    "db:push": "prisma db push",
    "db:push:staging": "railway environment staging && railway run npm run db:push",

    "sync-env": "railway run node scripts/sync-env.ts",
    "sync-env:staging": "railway environment staging && npm run sync-env",
    "sync-env:production": "railway environment production && npm run sync-env"
  }
}
```

### 5. Variable Management Utilities

```typescript
// lib/railway-utils.ts

/**
 * Check if running in Railway environment
 */
export function isRailway(): boolean {
  return !!process.env.RAILWAY_ENVIRONMENT;
}

/**
 * Get current Railway environment
 */
export function getRailwayEnvironment(): string | undefined {
  return process.env.RAILWAY_ENVIRONMENT;
}

/**
 * Check if running in specific environment
 */
export function isEnvironment(env: string): boolean {
  return process.env.ENVIRONMENT === env ||
         process.env.RAILWAY_ENVIRONMENT === env;
}

/**
 * Get Railway service information
 */
export function getRailwayServiceInfo() {
  return {
    projectId: process.env.RAILWAY_PROJECT_ID,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
    serviceId: process.env.RAILWAY_SERVICE_ID,
    serviceName: process.env.RAILWAY_SERVICE_NAME,
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
    staticUrl: process.env.RAILWAY_STATIC_URL,
    privateDomain: process.env.RAILWAY_PRIVATE_DOMAIN,
  };
}

/**
 * Build private service URL
 */
export function getPrivateServiceUrl(
  serviceName: string,
  port?: number
): string {
  const domain = process.env[`${serviceName.toUpperCase()}_RAILWAY_PRIVATE_DOMAIN`];
  const servicePort = port || process.env[`${serviceName.toUpperCase()}_PORT`];

  if (!domain) {
    throw new Error(`Private domain not found for service: ${serviceName}`);
  }

  return `http://${domain}${servicePort ? `:${servicePort}` : ''}`;
}

/**
 * Get service URL (private for Railway, localhost for local)
 */
export function getServiceUrl(
  serviceName: string,
  localPort: number
): string {
  if (isRailway()) {
    return getPrivateServiceUrl(serviceName);
  }
  return `http://localhost:${localPort}`;
}
```

### 6. Environment Variable Validation

```typescript
// lib/env-validation.ts
import { z } from 'zod';

// Define schema for environment variables
const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),

  // Server
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),

  // Database
  DATABASE_URL: z.string().url(),

  // APIs
  OPENAI_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),

  // Optional
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),

  // Feature Flags
  FEATURE_BETA_UI: z.string().transform(v => v === 'true').default('false'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );

      console.error('❌ Environment validation failed:');
      issues.forEach(issue => console.error(`  - ${issue}`));

      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
}

// Usage in your app
// import { validateEnv } from './lib/env-validation';
// const env = validateEnv();
```

## Best Practices

### 1. Environment Isolation
- **Create separate environments** for development, staging, and production
- **Never share production secrets** with development
- **Use environment-specific feature flags**
- **Test in staging** before deploying to production
- **Clone environments** carefully (secrets may need different values)

### 2. Variable Naming Conventions
- **Use SCREAMING_SNAKE_CASE** for all environment variables
- **Prefix service-specific variables**: `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`
- **Use descriptive names**: `DATABASE_POOL_MAX` instead of `DB_MAX`
- **Group related variables**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- **Boolean flags**: `FEATURE_NAME=true/false` or `ENABLE_FEATURE=true/false`

### 3. Secret Management
- **Never commit secrets** to version control
- **Rotate secrets regularly** (at least quarterly)
- **Use strong secrets**: min 32 characters, random
- **Limit secret access**: only services that need them
- **Use Railway's secret management** (not plain text)

### 4. Reference Variables
- **Always use reference variables** for inter-service communication
- **Use RAILWAY_PRIVATE_DOMAIN** for private networking
- **Example**: `API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`
- **Benefits**: Automatic updates, no hardcoding, DRY principle

### 5. Local Development
- **Use railway run** instead of syncing .env files
- **Never commit .env.local** with production secrets
- **Use separate API keys** for development
- **Test with railway shell** before deployment
- **Document required variables** in README.md

### 6. Variable Organization
```env
# ============================================
# Environment Configuration
# ============================================
ENVIRONMENT=production
NODE_ENV=production
LOG_LEVEL=info

# ============================================
# Server Configuration
# ============================================
PORT=3000
HOST=0.0.0.0

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ============================================
# External Services
# ============================================
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...

# ============================================
# Internal Services (Private Network)
# ============================================
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
WORKER_URL=http://${{worker.RAILWAY_PRIVATE_DOMAIN}}:${{worker.PORT}}

# ============================================
# Feature Flags
# ============================================
FEATURE_BETA_UI=false
FEATURE_NEW_AUTH=true
```

## Common Workflows

### 1. Create New Environment

```bash
# Create staging environment
# (Done via Railway Dashboard)
# Project → Settings → Environments → Create Environment → "staging"

# Switch to staging
railway environment staging

# Copy variables from production
# (Done via Railway Dashboard)
# Environments → staging → Actions → Import from production

# Update environment-specific variables
# (Update via Railway Dashboard or GraphQL API)
```

### 2. Add New Service

```bash
# Add service to project
railway add

# Configure service variables
# In Railway Dashboard:
# 1. Select service
# 2. Variables tab
# 3. Add service-specific variables
# 4. Add references to other services

# Example variables for new API service:
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
FRONTEND_URL=https://${{frontend.RAILWAY_STATIC_URL}}
```

### 3. Migrate to Private Networking

```bash
# Before: Using public URLs
API_URL=https://api-production.up.railway.app

# After: Using private networking
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}

# Benefits:
# - Faster (no public internet)
# - No egress fees
# - More secure
# - Auto-updates if service changes
```

### 4. Environment-Specific Deployments

```bash
# Deploy to staging
railway environment staging
railway up

# Test in staging
curl https://staging-app.up.railway.app/health

# Deploy to production
railway environment production
railway up

# Monitor deployment
railway logs --follow
```

## Troubleshooting

### Variable Not Available
- Check variable is set in correct environment
- Verify service has access to variable
- For reference variables, check syntax: `${{service.VARIABLE}}`
- Restart service after adding variables

### Private Networking Issues
- Use http:// not https:// for private domains
- Verify services are in same project and environment
- Check reference variable syntax
- Ensure RAILWAY_PRIVATE_DOMAIN is used, not RAILWAY_STATIC_URL

### Local Development Issues
- Run `railway login` to authenticate
- Verify project is linked: `railway status`
- Check environment: `railway environment`
- Use `railway shell` to debug variable availability

### Reference Variable Errors
- Ensure referenced service exists
- Check service name spelling
- Verify variable exists on referenced service
- Use exact syntax: `${{ServiceName.VARIABLE_NAME}}`

## Security Checklist

- [ ] No secrets in version control (.env files in .gitignore)
- [ ] Production secrets separate from development
- [ ] Strong secrets (min 32 characters)
- [ ] Secrets rotated regularly
- [ ] Private networking for inter-service communication
- [ ] Variable validation on application startup
- [ ] Limited access to production environment
- [ ] Audit logs enabled for variable changes
- [ ] No secrets in client-side code
- [ ] Railway project tokens secured

## Resources

- Railway Variables Docs: https://docs.railway.com/guides/variables
- Railway Environments: https://docs.railway.com/guides/environments
- Railway CLI Reference: https://docs.railway.com/reference/cli-api
- Railway Private Networking: https://docs.railway.com/guides/private-networking

## Notes
- Environment variables are encrypted at rest on Railway
- Reference variables auto-update when source changes
- Private networking is free (no egress charges)
- Shared variables are useful but use sparingly (can cause coupling)
- Always validate environment variables on application startup
- Consider using type-safe environment variable libraries (zod, envalid)
