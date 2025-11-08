---
description: Clean build artifacts, node_modules, and temporary files
allowed-tools: [Bash]
argument-hint: [all|dist|node_modules|cache]
---

# Clean Project

Remove build artifacts, dependencies, and temporary files.

## Usage

- `/ops/clean` or `/ops/clean all` - Clean everything
- `/ops/clean dist` - Remove only build output
- `/ops/clean node_modules` - Remove dependencies (requires reinstall)
- `/ops/clean cache` - Clear Bun/Vite caches

## Clean All (Full Clean)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Full Clean ===" && echo "Removing dist..." && rm -rf dist && echo "Removing node_modules..." && rm -rf node_modules && echo "Removing caches..." && rm -rf .vite node_modules/.cache && echo "Removing temp files..." && rm -rf tmp temp .tmp && echo "✅ Full clean complete"`
```

## Clean Build Output Only

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Cleaning build output..." && rm -rf dist && echo "✅ dist/ removed" && ls -la | grep -E "^d" | grep -v node_modules`
```

## Clean Dependencies

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "⚠️  Removing node_modules..." && rm -rf node_modules && echo "✅ node_modules removed" && echo "Run 'bun install' to reinstall"`
```

## Clean Caches

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Cleaning caches..." && rm -rf .vite node_modules/.cache .turbo .parcel-cache && echo "✅ Caches cleared"`
```

## Clean Database (DESTRUCTIVE)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "⚠️  This will delete the database!" && echo "Use /db/reset --confirm instead for safer database reset"`
```

## Clean Logs

```bash
!`cd /Users/home/hyperscape-5 && echo "Cleaning old logs..." && find logs -type f -name "*.log" -mtime +7 -delete 2>/dev/null && echo "✅ Old logs removed"`
```

## What Gets Cleaned

### All Clean Removes:

1. **Build Output**
   - `dist/` - Production build
   - `build/` - Alternative build directory
   - `.next/` - Next.js build (if applicable)

2. **Dependencies**
   - `node_modules/` - Installed packages
   - `.pnpm-store/` - PNPM store (if applicable)

3. **Caches**
   - `.vite/` - Vite cache
   - `node_modules/.cache/` - Various caches
   - `.turbo/` - Turborepo cache
   - `.parcel-cache/` - Parcel cache

4. **Temporary Files**
   - `tmp/` - Temporary directory
   - `temp/` - Temporary directory
   - `.tmp/` - Hidden temporary directory
   - `*.log` - Old log files

5. **TypeScript**
   - `*.tsbuildinfo` - TypeScript build info

## Selective Clean

Clean specific file types:

```bash
# Clean TypeScript build info
!`cd /Users/home/hyperscape-5/packages/asset-forge && find . -name "*.tsbuildinfo" -delete && echo "✅ TypeScript build info cleared"`

# Clean source maps
!`cd /Users/home/hyperscape-5/packages/asset-forge && find dist -name "*.map" -delete 2>/dev/null && echo "✅ Source maps removed"`

# Clean test coverage
!`cd /Users/home/hyperscape-5/packages/asset-forge && rm -rf coverage .nyc_output && echo "✅ Coverage reports cleared"`
```

## Disk Space Before/After

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Disk Space ===" && echo "Before:" && du -sh . && echo "node_modules:" && du -sh node_modules 2>/dev/null || echo "No node_modules" && echo "dist:" && du -sh dist 2>/dev/null || echo "No dist"`
```

## Full Reset Workflow

Complete reset including reinstall:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Full Reset Workflow ===" && echo "[1/4] Cleaning..." && rm -rf dist node_modules .vite node_modules/.cache && echo "[2/4] Reinstalling dependencies..." && bun install && echo "[3/4] Running migrations..." && bun run db:migrate && echo "[4/4] Building..." && bun run build && echo "✅ Full reset complete"`
```

## When to Clean

Clean when you experience:
- Build errors that don't make sense
- Dependency version conflicts
- Cache-related issues
- Stale build artifacts
- After major dependency updates
- After switching branches with different deps

## Safety Notes

- **NEVER** clean in production
- Always commit changes before cleaning
- `node_modules` requires reinstall after removal
- Database clean is destructive (use `/db/reset` instead)
- Cleaning during dev server run may cause issues

## See Also

- `/dev/build` - Rebuild after cleaning
- `/db/reset` - Database reset (DESTRUCTIVE)
- @packages/asset-forge/package.json - Dependencies to reinstall
