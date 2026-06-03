# Railway Dev/Prod Deployment

This repository deploys Railway environments with branch-to-environment mapping:

- `main` -> `prod`
- `develop` or `dev` -> `dev`

Manual deploys are also supported via GitHub Actions (`Deploy to Railway`) with:

- `environment=prod`
- `environment=dev`

## Required GitHub Configuration

Set the following repository secret:

- `RAILWAY_TOKEN`

Set these repository variables for `dev`:

- `RAILWAY_DEV_SERVICE_ID`
- `RAILWAY_DEV_ENVIRONMENT_ID`

Legacy fallback is supported:

- `RAILWAY_STAGING_SERVICE_ID`
- `RAILWAY_STAGING_ENVIRONMENT_ID`

Production service/environment IDs are currently pinned in
`.github/workflows/deploy-railway.yml`.

## Railway Setup (One-Time)

1. In Railway, create or confirm two environments:
   - `production`
   - `development` (or your existing staging environment)
2. Confirm each environment has a service instance for this app.
3. Copy the `serviceId` and `environmentId` for development into GitHub variables.

## Point `hyperia.gg` to Production

1. In Railway:
   - Open the production service.
   - Go to `Settings -> Domains`.
   - Add `hyperia.gg` as a custom domain.
   - Optionally add `www.hyperia.gg` and redirect it to apex.
2. Railway will show the exact DNS record(s) required. Create those records at your DNS provider exactly as shown.
3. If you use Cloudflare DNS, set proxy to DNS-only until certificate issuance completes.
4. Wait for domain verification and TLS certificate status to become active in Railway.
5. Validate:
   - `https://hyperia.gg/status`
   - `wss://hyperia.gg/ws`

## Optional Dev Domain

Recommended custom domain for development:

- `dev.hyperia.gg`

Add it in the development Railway environment and create matching DNS records from Railway's instructions.
