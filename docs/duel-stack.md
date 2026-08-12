# Duel Stack (`bun run duel`)

`bun run duel` boots the Hyperia duel/stream stack. Set
`DUEL_WITH_HYPERBET=true` to add the local SOL-only betting runtime:

1. Hyperia game server + client with one authoritative streaming scheduler
2. Model-backed duel agents or deterministic model-free local agents
3. RTMP bridge and HLS fanout
4. Hyperbet SOL backend, synchronized from Hyperia
5. Hyperbet browser app, routed through the Hyperbet backend
6. Hyperbet SOL keeper, consuming Hyperia's authenticated internal feed

The duel launcher is native-SOL-only. It never invokes an alternate-chain
bootstrap and exposes no flag that can add one to the launch path.

## Run

```bash
bun run duel
DUEL_WITH_HYPERBET=true bun run duel
```

`bun run duel` now bootstraps streaming prerequisites automatically on first run:

- uses bundled `ffmpeg-static` binary by default (or `FFMPEG_PATH` if provided)
- auto-installs Playwright Chromium if the bundled browser is missing

No separate Docker stream container is required for stream fanout.

Recommended fresh-install prep command:

```bash
bun run install
```

This ensures assets are synced and Chromium is installed for local capture.

Database startup is fail-closed. With no explicit URL, the launcher uses the
single Docker container described by `POSTGRES_CONTAINER`, `POSTGRES_PORT`,
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_IMAGE`. An
existing container must match every value, and the requested host port must be
free before a new container is created. To use any pre-existing or hosted
PostgreSQL service, set `DUEL_DATABASE_MODE=remote`, provide
`DUEL_DATABASE_URL` (or `DATABASE_URL`), and set `USE_LOCAL_POSTGRES=false`.
The launcher never falls back to another process listening on a familiar port.

`GET /health` always executes the running `DatabaseSystem`'s bounded PostgreSQL
probe and returns its measured latency, pool counts, and explicit `healthy`,
`unhealthy`, `unavailable`, or `timeout` status. Database failure returns HTTP
503 by default. `HEALTH_CHECK_DB_TIMEOUT_MS` sets the bounded probe deadline
(minimum 250 ms). A deployment with a separate readiness endpoint may set
`HEALTH_CHECK_STRICT_DB=false` for a liveness-only HTTP 200 response, but the
payload remains `degraded` and never reports the database check as skipped.

When no supported model-provider credential is configured, `bun run duel`
creates the requested deterministic server-side sparbot roster and requires the
entire roster to be ready before capture or markets can start. Direct
`bun run dev:duel` uses two or more deterministic local test agents in the same
situation; it enables `LOAD_TEST_MODE` only for the non-production server it
starts. With `--skip-dev`, both the existing local server and the duel-bot
process must explicitly set `LOAD_TEST_MODE=true`. Ordinary and production
clients cannot claim this bypass. Any roster below two connected agents is a
startup failure, never a successful `0/0` matchmaker.

Optional flags:

```bash
bun run duel --bots=6 --betting-port=4179 --rtmp-port=8765
bun run duel --hyperbet-api-url=http://localhost:8080
bun run duel --skip-keeper
bun run duel --skip-stream
bun run duel --verify
```

The integrated launcher auto-detects a complete sibling
`hyperbet-solana-implementation` or `hyperbet` monorepo. Set
`DUEL_HYPERBET_ROOT` (or `--hyperbet-root`) to use another location.

The launcher generates a private 32-byte betting-feed credential when one is
not configured, verifies that unauthenticated access is rejected, and proves an
authenticated schema-v3 bootstrap before starting Hyperbet. To preserve feed
credentials across process restarts, configure
`DUEL_BETTING_FEED_ACCESS_TOKEN` in the runtime secret store. The value is never
sent to the browser or logged.

The Hyperbet backend is intentionally read-only with respect to keeper signing
roles. The separate keeper process must have all required SOL role variables;
mainnet requires distinct wallets. If required programs, roles, synchronized
state, parser/RPC health, or fresh keeper health are unavailable, the launcher
fails instead of reporting the stack online. `--skip-keeper` is an explicit
development override and does not represent launch-ready betting health.

## Streaming Outputs

Configure the following env vars (root `.env` or `packages/server/.env`):

- `RTMP_MULTIPLEXER_URL` (+ optional `RTMP_MULTIPLEXER_STREAM_KEY`, `RTMP_MULTIPLEXER_NAME`)
- `TWITCH_STREAM_KEY` (or `TWITCH_RTMP_STREAM_KEY`)
  Optional ingest override: `TWITCH_STREAM_URL` / `TWITCH_RTMP_URL` / `TWITCH_RTMP_SERVER`
- `YOUTUBE_STREAM_KEY` (or `YOUTUBE_RTMP_STREAM_KEY`)
  Optional ingest override: `YOUTUBE_STREAM_URL` / `YOUTUBE_RTMP_URL`
- `KICK_STREAM_KEY` (+ optional `KICK_RTMP_URL`)
- `PUMPFUN_RTMP_URL` (+ optional `PUMPFUN_STREAM_KEY`)
- `X_RTMP_URL` (+ optional `X_STREAM_KEY`)
- `RTMP_DESTINATIONS_JSON` for additional/custom fanout destinations
- `STREAMING_VIEWER_ACCESS_TOKEN` optional gate for live WebSocket stream/spectator viewers

Canonical bettor-facing stream policy (no env required):

- Canonical platform: owned `hls`
- Canonical public source: `/live/stream.m3u8`
- Default public delay: `4000ms`
- Optional external platform: `STREAMING_CANONICAL_PLATFORM` (`youtube` | `twitch`)
- Required with an external platform: `STREAMING_CANONICAL_SOURCE_URL`
- Optional override: `STREAMING_PUBLIC_DELAY_MS`

The source URL is returned by `/api/streaming/config`. It must be a public
HTTP(S) URL or root-relative public path and cannot contain credentials or a
fragment. Unsupported platforms, missing external sources, and malformed delay
overrides stop startup instead of falling back to another channel. External RTMP
destinations are fanout outputs and never silently replace the canonical source.

Optional client-side extra delay (usually keep `0` if server delay is enabled):

- `VITE_UI_SYNC_DELAY_MS`

Website/betting stream input:

- The marketing website does not mount a second stream player or wallet. Its
  `NEXT_PUBLIC_HYPERBET_URL` navigation and `/arena` compatibility page hand off
  to the one supported Hyperbet deployment.
- Standalone Hyperbet deployments set `VITE_STREAM_URL` to that same canonical
  source. `VITE_STREAM_SOURCES` is reserved for an explicitly reviewed fallback
  list; no platform or channel is supplied by default.

The integrated launcher forces Hyperia's reported platform to `hls` and injects
the exact same absolute HLS URL into Hyperia's public configuration and the
Hyperbet player. A generic inherited `VITE_STREAM_URL` cannot redirect only one
side of that topology, and the browser is never pointed at a same-origin path
owned by the Vite process.

When `STREAMING_PUBLIC_DELAY_MS > 0`, live `mode=streaming` WebSocket viewers are restricted to:

- loopback/local capture clients, or
- clients presenting `streamToken=<STREAMING_VIEWER_ACCESS_TOKEN>`

`stream-to-rtmp` automatically appends `streamToken` to capture URLs when `STREAMING_VIEWER_ACCESS_TOKEN` is set.

## Spectator + Betting URLs

- Canonical game stream view: `http://localhost:3333/stream.html`
- Hyperbet backend: `http://localhost:8080`
- Hyperbet app: `http://localhost:4179`
- Local HLS source: `http://localhost:5555/live/stream.m3u8`

## Runtime APIs

Public Hyperia telemetry:

- `GET /api/streaming/state`
- `GET /api/streaming/duel-context`
- `GET /api/streaming/agent/:characterId/inventory`
- `GET /api/streaming/agent/:characterId/monologues?limit=20`

Private Hyperia-to-keeper synchronization (bearer token required):

- `GET /api/internal/bet-sync/state`
- `GET /api/internal/bet-sync/events?since=<sequence>`

The browser talks to the Hyperbet backend for synchronized stream state,
markets, points/history, settlement history, invites, and Solana RPC/sender
proxy routes. It does not receive the private feed credential.

## Verification

From a clean checkout, run the complete local launch gate with Docker running,
Git LFS installed, Node from `.node-version`, and Bun 1.3.14:

```bash
bun run duel:smoke:clean
bun run duel:smoke:clean --with-hyperbet
bun run duel:smoke:clean --with-hyperbet --with-keeper
```

This single command performs a frozen dependency install, requires the full
game asset pack, installs the bundled Chromium capture browser (and Linux
system dependencies in CI), builds the production monorepo, and launches an
isolated fresh stack. It provisions a uniquely named PostgreSQL container and
volume, uses six dedicated ports (eight when Hyperbet is included), starts the
production server and client plus exactly two deterministic agents, waits for
a browser-rendered combat duel and healthy advancing HLS/audio capture, and
then removes only the processes, container, volume, HLS output, runtime
directory, and client runtime-env change created by that invocation. The
command fails if any owned resource leaks.

The clean smoke is deliberately a loopback-only, model-free, no-money launch
test by default. Synthetic contestants are accepted only when production
artifacts are combined with the smoke's explicit loopback, authority,
load-test, and betting-disabled invariants.

`--with-hyperbet` extends that no-money boundary with the real synchronized
Hyperbet backend and browser app. It explicitly disables transaction authority,
does not mount the Solana provider, scan/reconnect wallets, poll the cluster or
keeper, or expose wallet identity/signing functions to the market panel. It
removes wallet and transaction controls while preserving public matchup data.
The player prefers hls.js for Chromium's MPEG-TS live path and uses native HLS
only when Media Source Extensions are unavailable. The automated verifier
requires a fresh authoritative backend source observation, both authoritative
agent names in the browser, the exact declared Hyperia HLS URL, a playing video
whose `currentTime` advances, meaningful UI content, the spectator label, no
wallet/transaction call to action, no console warning/error or page error, and
no failed or HTTP 4xx/5xx browser request.

`--with-keeper` is a separate transaction-enabled gate. It requires
`--with-hyperbet`, executable fight-oracle and duel-market programs on the
selected Solana cluster, and every required keeper role. Missing programs or
roles stop startup before the scheduler is released or the launcher reports
online. Run this mode only against an intentionally provisioned environment;
unlike spectator mode, the keeper can submit SOL transactions.

Run the full startup verifier against a running stack:

```bash
bun run duel:verify
bun run duel:verify --require-destinations=twitch,youtube
bun run duel:test:hyperbet-backend
```

This validates server/client/betting uptime, active duel combat, RTMP bridge status evidence, and telemetry endpoints.
RTMP bridge status is best-effort by default, and can be made strict with `--require-destinations`.
The backend smoke test launches an isolated real Hyperbet service against a
synthetic authoritative Hyperia source, proves fresh source polling and proxy
state, verifies that keeper authority secrets are not injected, then cleans up
all temporary state.
