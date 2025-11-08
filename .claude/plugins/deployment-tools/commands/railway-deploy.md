---
description: Deploy to Railway using RAILPACK (ADR-0003)
---

# Railway Deployment

Deploying with **RAILPACK builder** (ADR-0003), no Docker/Nixpacks.

## Pre-Deployment Checklist

Per CLAUDE.md compliance:
- [ ] All tests pass (no failing tests allowed)
- [ ] No `any` types in production code
- [ ] All features have comprehensive tests
- [ ] Error logs properly handled
- [ ] API keys in environment variables
- [ ] No hardcoded data in source code
- [ ] Documentation is current

## Deployment Process

1. **Check build status** - Ensure all packages build successfully
2. **Run test suite** - Verify all tests pass
3. **Verify migrations** - Check database migrations are ready
4. **Deploy to Railway** - Push to main branch or manual deploy
5. **Monitor deployment** - Check Railway logs for errors

I'll use Deepwiki to research Railway RAILPACK configuration and ensure:
- Proper build commands in package.json
- Environment variables configured
- Database connections working
- Health checks passing

Ready to deploy? I'll guide you through the checklist first.
