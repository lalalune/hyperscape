# Hyperscape Documentation Site

API documentation for Hyperscape, auto-generated from TypeScript source using TypeDoc + Docusaurus.

## Quick Start

```bash
# Generate API docs from source
bun run docs:generate

# Dev server at http://localhost:3402
bun run docs:dev

# Production build
bun run docs:build
```

## Structure

- `docs/` - Markdown documentation (auto-generated API docs go in `docs/api/`)
- `src/pages/` - Custom React pages
- `static/` - Static assets

## Configuration

- `typedoc.json` (root) - TypeDoc settings for API extraction
- `docusaurus.config.ts` - Site configuration
- `sidebars.ts` - Navigation structure

## Deployment

Auto-deployed to GitHub Pages via `.github/workflows/deploy-docs.yml` on push to `main`.
