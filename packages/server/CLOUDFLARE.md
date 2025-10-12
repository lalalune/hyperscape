# Cloudflare Deployment (Incomplete)

The Cloudflare deployment setup has been temporarily disabled because it's incomplete.

## Missing Components

1. **@cloudflare/containers** package not in dependencies
2. **Dockerfile.cloudflare** referenced in wrangler.toml but doesn't exist
3. **R2 bucket IDs** not configured in wrangler.toml
4. **KV namespace IDs** not configured

## Files Disabled

- `src/worker.ts.disabled` - Cloudflare Worker edge layer
- `wrangler.toml.disabled` - Cloudflare configuration

## To Re-enable

1. Add `@cloudflare/containers` to package.json dependencies
2. Create `Dockerfile.cloudflare` (can copy/modify existing Dockerfile)
3. Set up Cloudflare R2 buckets and get IDs
4. Set up Cloudflare KV namespaces and get IDs  
5. Update wrangler.toml with actual bucket/KV IDs
6. Rename `.disabled` files back to original names
7. Run `wrangler deploy`

## Current Deployment

The server currently deploys as a standard Node.js/Bun application with:
- Local or remote PostgreSQL database
- Local file storage for assets
- Docker for local PostgreSQL (optional)

