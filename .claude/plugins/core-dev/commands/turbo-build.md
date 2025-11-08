---
description: Run Turbo monorepo build (ADR-0002)
---

# Turbo Build Orchestration

Using **Turborepo** (ADR-0002) for intelligent build caching and parallel execution.

I'll run the Turbo build with:
- Dependency-aware builds
- Intelligent caching
- Parallel execution across packages
- TypeScript compilation checks

Which packages should I build, or should I build all packages?

After building, I'll:
1. Report any TypeScript errors
2. Fix errors following strict typing standards (ADR-0006)
3. Ensure all builds succeed before completing
