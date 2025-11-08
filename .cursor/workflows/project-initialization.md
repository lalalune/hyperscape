# Project Initialization Workflow

## Overview
This workflow guides the setup of a new Hyperscape project or feature.

## Steps

### 1. Environment Configuration
- Copy `.env.example` to `.env` in root and relevant packages
- Configure required API keys:
  - Privy App ID and Secret
  - OpenAI/Anthropic API keys (if using LLM features)
  - Database connection strings
- Verify environment variables are loaded correctly

### 2. Dependency Installation
```bash
# Install dependencies
bun install

# Verify installation
bun run build
```

### 3. Database Setup
```bash
# Generate migrations if schema changed
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio for verification
bun run db:studio
```

### 4. Initial Testing Verification
- Run test suite: `bun test`
- Verify all tests pass
- Check for linting errors: `bun run lint`
- Ensure no TypeScript errors: `bun run typecheck`

### 5. Development Server
```bash
# Start development servers
bun run dev          # Frontend + Backend
bun run dev:backend  # Backend only
bun run dev:client   # Frontend only
```

## Verification Checklist
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Database migrations applied
- [ ] All tests passing
- [ ] No linting errors
- [ ] Development server starts successfully

