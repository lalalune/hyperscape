---
description: Pre-deployment validation checklist with all quality checks
allowed-tools: [Bash, Read, Grep]
---

# Pre-Deployment Checklist

Comprehensive validation before deploying asset-forge to production. **All checks must pass** before deployment.

## Quick Check (All-in-One)

Run all quality checks sequentially (recommended before deployment):

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== PRE-DEPLOYMENT CHECKLIST ===" && echo "Running all validation checks..." && echo && FAILED=0 && echo "[1/6] TypeScript Type Check..." && bun tsc --noEmit 2>&1 >/dev/null && echo "✅ Types OK" || (echo "❌ Type errors found" && FAILED=1) && echo && echo "[2/6] Test Suite..." && bun test 2>&1 >/dev/null && echo "✅ Tests OK" || (echo "❌ Tests failed" && FAILED=1) && echo && echo "[3/6] Linting..." && bun run lint 2>&1 >/dev/null && echo "✅ Lint OK" || (echo "❌ Lint errors" && FAILED=1) && echo && echo "[4/6] Production Build..." && bun run build 2>&1 >/dev/null && echo "✅ Build OK" || (echo "❌ Build failed" && FAILED=1) && echo && echo "[5/6] Environment Variables..." && test -f .env && echo "✅ .env exists" || echo "⚠️  .env missing" && echo && echo "[6/6] Git Status..." && cd /Users/home/hyperscape-5 && git status -s && echo && if [ $FAILED -eq 0 ]; then echo "=== ✅ ALL CHECKS PASSED - READY TO DEPLOY ==="; else echo "=== ❌ DEPLOYMENT BLOCKED - FIX ERRORS ABOVE ==="; exit 1; fi`
```

## Individual Checks

Run each check separately for detailed analysis.

### 1. TypeScript Type Check

Verify no type errors:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Checking TypeScript types..." && bun tsc --noEmit 2>&1 && echo "✅ No type errors" || echo "❌ Fix type errors before deployment"`
```

**Requirements**:
- Zero type errors
- No `any` types in codebase
- All functions have explicit return types

### 2. Test Suite

All tests must pass:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Running test suite..." && bun test 2>&1 | tee /tmp/deploy-test.log && (grep -q "FAIL" /tmp/deploy-test.log && echo "❌ Tests failed" && exit 1 || echo "✅ All tests passed")`
```

**Requirements**:
- All tests pass (100%)
- No skipped tests
- Coverage maintained or improved

### 3. Code Quality (Lint)

Check code style and quality:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Linting code..." && bun run lint 2>&1 && echo "✅ No lint errors" || echo "❌ Fix lint errors before deployment"`
```

**Requirements**:
- Zero ESLint errors
- Zero warnings (if possible)
- Import order correct

### 4. Production Build

Verify build succeeds:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Building for production..." && bun run build 2>&1 && test -d dist && echo "✅ Build successful - dist/ created" || echo "❌ Build failed"`
```

**Requirements**:
- Build completes without errors
- `dist/` directory created
- Assets properly bundled and minified

### 5. Environment Variables

Check required environment variables:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Checking environment variables..." && test -f .env && echo "✅ .env file exists" || echo "❌ .env missing" && echo && echo "Required variables:" && (test -n "$DATABASE_URL" && echo "✅ DATABASE_URL" || echo "❌ DATABASE_URL missing") && (test -n "$PRIVY_APP_ID" && echo "✅ PRIVY_APP_ID" || echo "❌ PRIVY_APP_ID missing") && (test -n "$PRIVY_APP_SECRET" && echo "✅ PRIVY_APP_SECRET" || echo "❌ PRIVY_APP_SECRET missing") && (test -n "$MESHY_API_KEY" && echo "✅ MESHY_API_KEY" || echo "❌ MESHY_API_KEY missing")`
```

**Required Variables**:
- `DATABASE_URL` - SQLite database path
- `PRIVY_APP_ID` - Privy authentication app ID
- `PRIVY_APP_SECRET` - Privy authentication secret
- `MESHY_API_KEY` - MeshyAI 3D generation API key
- `VITE_PRIVY_APP_ID` - Frontend Privy config

### 6. Git Status

Verify repository state:

```bash
!`cd /Users/home/hyperscape-5 && echo "Git status:" && git status && echo && echo "Uncommitted changes:" && git diff --stat && echo && echo "Branch:" && git branch --show-current`
```

**Requirements**:
- No uncommitted changes (clean working tree)
- On correct branch (main or release branch)
- Latest commits pulled from remote

### 7. Database Migrations

Check migration status:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Checking migrations..." && ls -la server/db/migrations/*.sql 2>/dev/null | tail -5 && echo && echo "Latest migration:" && ls -t server/db/migrations/*.sql 2>/dev/null | head -1 | xargs basename`
```

**Requirements**:
- All migrations applied
- No pending schema changes
- Migration files committed to repo

### 8. Security Audit

Check for security issues:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Security checklist:" && echo && echo "Checking for secrets in code..." && (grep -r "sk_.*" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null && echo "⚠️  Possible secrets found" || echo "✅ No secrets in code") && echo && echo "Checking for console.log..." && (grep -r "console\.log" src/ server/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | xargs -I {} echo "Found {} console.log statements") && echo && echo "Checking .gitignore..." && (test -f /Users/home/hyperscape-5/.gitignore && grep -q ".env" /Users/home/hyperscape-5/.gitignore && echo "✅ .env in .gitignore" || echo "⚠️  Add .env to .gitignore")`
```

**Security Requirements**:
- No API keys hardcoded in source
- No secrets in repository
- `.env` in `.gitignore`
- Rate limiting configured
- CORS properly configured
- Security headers enabled

### 9. Performance Check

Verify bundle size and performance:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Checking bundle size..." && if [ -d dist ]; then du -sh dist/ && echo && echo "Largest files:" && find dist -type f -exec du -h {} + | sort -rh | head -10; else echo "Build dist/ first"; fi`
```

**Performance Requirements**:
- Bundle size reasonable (< 5MB total)
- No duplicate dependencies
- Tree-shaking effective
- Images optimized

## Final Checklist

Before deploying, verify:

- [ ] All type errors fixed (`/check-types`)
- [ ] All tests pass (`/test`)
- [ ] No lint errors (`/lint`)
- [ ] Production build succeeds (`/dev/build`)
- [ ] Environment variables configured
- [ ] Git working tree clean
- [ ] Migrations applied and committed
- [ ] No security issues found
- [ ] Bundle size acceptable
- [ ] Database backed up
- [ ] Rollback plan prepared

## Deployment Commands

After all checks pass:

### Railway Deployment

```bash
# Deploy to Railway
!`cd /Users/home/hyperscape-5/packages/asset-forge && railway up`
```

### Manual Deployment

```bash
# Build and prepare for deployment
!`cd /Users/home/hyperscape-5/packages/asset-forge && bun run build && echo "Ready to deploy"`
```

## Rollback Plan

If deployment fails:

1. Revert to previous commit
2. Restore database from backup
3. Redeploy previous working version
4. Investigate issues in staging

## See Also

- `/dev/build` - Production build
- `/test` - Run test suite
- `/check-types` - Type checking
- `/lint` - Code quality
- `/ops/env-check` - Environment validation
- `/migrate` - Database migrations
