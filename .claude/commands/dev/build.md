---
description: Build asset-forge for production
allowed-tools: [Bash]
---

# Production Build

Build asset-forge for production deployment with optimizations.

## Build Process

1. Clean previous builds
2. Build frontend with Vite (tree-shaking, minification)
3. Optimize assets and bundle

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Production Build ===" && echo "Cleaning previous build..." && bun run clean && echo "Building with Vite..." && bun run build 2>&1 && echo -e "\n✅ Build complete!" && echo && echo "Output directory: dist/" && du -sh dist/ && echo && echo "Next steps:" && echo "  - Run /deploy-check to verify readiness" && echo "  - Test with 'bun run preview'" || (echo -e "\n❌ Build failed" && echo "Common issues:" && echo "  - Type errors: run /check-types" && echo "  - Missing dependencies: run bun install" && echo "  - Environment vars: check .env" && exit 1)`
```

## Preview Build

Test the production build locally:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Preview Production Build ===" && echo "Starting preview server..." && echo "URL: http://localhost:4173" && bun run preview`
```

## Build Output

- **Location**: `dist/` directory
- **Optimizations**: Tree-shaking, minification, code splitting
- **Target**: Railway deployment
- **Assets**: Optimized images, fonts, stylesheets

## Build Verification

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && if [ -d dist ]; then echo "=== Build Output ===" && echo "Total size: $(du -sh dist | cut -f1)" && echo && echo "Largest files:" && find dist -type f -exec du -h {} + | sort -rh | head -10 && echo && echo "✅ Build verified"; else echo "❌ No build output - run /dev/build first"; fi`
```

## Post-Build

After successful build:

1. Run `/deploy-check` - Full deployment validation
2. Test with `bun run preview` - Local preview server
3. Verify bundle size is reasonable (< 5MB)
4. Check for deployment blockers

## See Also

- `/deploy-check` - Pre-deployment validation
- `/check-types` - Type verification before build
- `/test` - Run tests before building
