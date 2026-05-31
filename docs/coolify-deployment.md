# Coolify Deployment

This repo includes `docker-compose.coolify.yml` for a simple Coolify deployment
with the Hyperscape app container, Postgres, and MinIO object storage for
runtime conjure assets. Use `.env.coolify.example` as the production-oriented
copy/paste reference for Coolify environment variables.

## Services

- `hyperscape`: builds from `Dockerfile.server` and listens on port `5555`.
- `postgres`: `pgvector/pgvector:pg16` with a persistent named volume.
- `minio`: S3-compatible object storage with a persistent named volume.
- `minio-init`: creates the conjure bucket and enables public downloads.

Set at least:

```env
POSTGRES_PASSWORD=<strong-password>
MINIO_ROOT_PASSWORD=<strong-password-at-least-8-chars>
PUBLIC_AUTH0_DOMAIN=<your-auth0-tenant>.us.auth0.com
PUBLIC_AUTH0_CLIENT_ID=<your-auth0-spa-client-id>
JWT_SECRET=<random-32-byte-secret>
ADMIN_CODE=<private-admin-code>
```

`PUBLIC_API_URL`, `PUBLIC_WS_URL`, and `PUBLIC_CDN_URL` may be left unset for a
simple same-origin Coolify deployment. The server-generated `/env.js` will infer:

```env
PUBLIC_API_URL=https://<your-domain>
PUBLIC_WS_URL=wss://<your-domain>/ws
PUBLIC_CDN_URL=https://<your-domain>/game-assets
```

Set them explicitly only when the browser must use a different public API,
WebSocket, or asset domain.

The compose file sets these on the `hyperscape` app service:

```env
USE_LOCAL_POSTGRES=false
DATABASE_URL=postgresql://hyperscape:<password>@postgres:5432/hyperscape
DEFAULT_GOBLINS_ENABLED=false
AUTO_START_AGENTS=false
SPAWN_MODEL_AGENTS=true
MODEL_AGENT_PROVIDERS=hyades
MAX_MODEL_AGENTS=1
```

The `minio-init` service creates `S3_BUCKET_CONJURES` and enables anonymous
downloads for that bucket.

Leave `DEFAULT_GOBLINS_ENABLED=false` unless you intentionally want the
hardcoded starter test goblin cluster.

## Environment Files

The repo has several `.env.example` files because different packages can be
deployed independently:

| File | Purpose |
| --- | --- |
| `.env.coolify.example` | Production Coolify reference. Use this first for deployed Hyperscape, MinIO, and Asset Forge. |
| `.env.example` | Older root/local streaming and Vast.ai variables. Do not use as the primary Coolify source. |
| `packages/server/.env.example` | Local/server development reference with the full server variable surface. |
| `packages/client/.env.example` | Client-only Vite/Cloudflare Pages style deployment reference. |
| `packages/asset-forge/.env.example` | Asset Forge local/development reference, including generation provider options. |
| `packages/plugin-hyperscape/.env.example` | Plugin/agent integration reference. |
| `packages/website/.env.example` | Marketing website reference. |

For Coolify, prefer `.env.coolify.example` because it aligns the app, MinIO, and
Asset Forge variables around the same domains and bucket names.

## Hyades In-Game AI

Coolify deployments spawn the in-game LLM agent through Hyades by default. Set
these in Coolify secrets or environment variables:

```env
HYADES_LLM_ENDPOINT=http://<hyades-host>/v1
HYADES_LLM_MODEL=nemotron3-omni
HYADES_LLM_SMALL_MODEL=nemotron3-omni
HYADES_LLM_API_KEY=<hyades-key>
```

`AUTO_START_AGENTS=false` prevents stale database-backed OpenAI agents from
restarting automatically after deploy. `HYADES_RUNTIME_URL` can also be set to
`http://<hyades-host>`; the server will
derive `/v1` from it when `HYADES_LLM_ENDPOINT` is empty. Keep
`MODEL_AGENT_PROVIDERS=hyades` if OpenAI, Anthropic, or OpenRouter keys remain in
the environment but should not spawn agents.

## Assets and CDN

The production image copies `packages/server/world` into the app image, and the
server exposes those files at `/game-assets`. The simplest Coolify setup is to
use same-origin assets:

```env
PUBLIC_CDN_URL=https://<your-domain>/game-assets
```

If you want a separate self-hosted static asset service, common choices are:

- Caddy or nginx serving files from a mounted asset directory.
- MinIO behind Caddy/nginx if you want S3-compatible uploads and buckets.
- Garage if you want a lightweight distributed object store.

A single Caddy/nginx box is technically an asset server, not a global CDN. It
becomes CDN-like when you put Cloudflare or another edge cache in front of it.

For most Coolify deployments, prefer either same-origin `/game-assets` or
Cloudflare R2/custom-domain assets. Only add a separate CDN container if you need
to update large assets independently from app deploys.

## Runtime Conjure Storage

The static world assets still ship inside the app image and are served from
`/game-assets`. Fast conjure outputs are different: the conjure API can store
runtime GLBs and concept art in MinIO, then return the MinIO public URL to the
in-world conjure flow.

In the Asset Forge container, set:

```env
OBJECT_STORAGE_ENABLED=true
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=hyperscape
S3_SECRET_ACCESS_KEY=<same-value-as-MINIO_ROOT_PASSWORD>
S3_BUCKET_CONJURES=hyperscape-conjures
S3_PUBLIC_BASE_URL=https://<asset-domain>/hyperscape-conjures
CONJURE_STORAGE_PREFIX=conjures
```

`S3_ENDPOINT` is the URL Asset Forge uses for authenticated S3 uploads. If Asset
Forge runs in the same Docker Compose project or Docker network as MinIO, use
the private service name and API port:

```env
S3_ENDPOINT=http://minio:9000
```

If Asset Forge is deployed as a separate Coolify app and is not attached to the
same Docker network, use the public MinIO API domain instead:

```env
S3_ENDPOINT=https://assets.example.com
```

`S3_PUBLIC_BASE_URL` is different: it must be a browser-reachable URL for the
bucket. In Coolify, assign a domain to the `minio` service on port `9000`, for
example:

```text
https://assets.example.com -> minio:9000
```

Then set:

```env
S3_PUBLIC_BASE_URL=https://assets.example.com/hyperscape-conjures
```

Do not use the MinIO console port (`9001`) for asset URLs. If you expose the
console, give it a separate domain such as:

```text
https://minio-console.example.com -> minio:9001
```

Without a public base URL, Asset Forge leaves object storage disabled and the
caller should keep using its existing asset URL path.

## Supabase Storage

Do not deploy self-hosted Supabase only to replace MinIO. Hyperscape currently
needs a regular Postgres connection plus an S3-compatible object store for
generated Asset Forge outputs. Supabase Storage can expose an S3-compatible
endpoint, but self-hosted Supabase adds the Storage API, auth/config services,
and its own storage backend choices. A standalone S3-compatible service such as
MinIO, RustFS, Garage, Cloudflare R2, or AWS S3 is simpler for this repo.
