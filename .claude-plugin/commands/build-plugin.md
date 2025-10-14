---
description: Build plugin-hyperscape with optional watch mode
allowed-tools:
  - Bash(cd packages/plugin-hyperscape*)
  - Bash(bun run *)
  - Bash(npm run *)
  - Read(packages/plugin-hyperscape/package.json)
argument-hint: "[mode] - Optional: 'dev' for watch mode, or omit for standard build"
model: sonnet
---

cd packages/plugin-hyperscape && bun run ${1:-build}

Build modes:
- `/build-plugin` - Standard build
- `/build-plugin dev` - Watch mode for development

Output: dist/ folder with compiled JavaScript and type declarations
