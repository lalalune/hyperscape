# Railway Dev And Prod

Railway hosts the Hyperscapes API and control-plane services. It is not the
renderer of record for the duel stream.

## Branch Mapping

- `main` -> shared production
- `develop`/`dev` -> shared development
- `enoomian/personal-staging-integration` -> personal staging when explicitly
  selected on the service source branch

## Responsibilities

Railway owns:

- `/health`
- `/api/streaming/state`
- `/api/streaming/state/events`
- `/api/streaming/capture/status`
- `/api/streaming/capture/smoke`
- `/api/hyperbet/config`
- wallet auth and HyperBet public routes

Railway does not own:

- headful stream-page rendering
- browser capture
- FFmpeg encode
- GPU-bound viewer delivery

Those live on the GPU capture host.

## Personal Staging Model

For `enoomian` personal staging:

- Cloudflare Pages serves the public `/stream` page
- `/stream` runs in the dedicated capture preset rather than the full generic
  client
- the GPU host runs the dedicated source worker service (`hyperscape-stream-source`)
- the API/game-control service is separate (`hyperscape-duel-api`)
- Railway points at the integrated branch and serves API/control-plane state
- viewer delivery uses authority-layer provider selection rather than assuming
  Cloudflare is always canonical
- self-hosted HLS is the current personal-staging canonical rail
- Cloudflare remains configured as a warm fallback and investigation rail
- `DUEL_OWNS_STREAM_CAPTURE=true` is reserved for explicit local integrated
  mode only; split topology is the default for staging/prod

## Required Railway Variables

Keep secrets in Railway only. Do not commit them to git.

Streaming delivery selection:

- `STREAM_DELIVERY_MODE=self_hls|external_hls`
- `STREAM_DELIVERY_PROVIDER`
- `STREAM_CANONICAL_PROVIDER_PRIORITY`
- `STREAM_FAILBACK_SOAK_MS`
- `STREAM_INGEST_RTMPS_URL`
- `STREAM_INGEST_STREAM_KEY`
- `STREAM_PLAYBACK_HLS_URL`
- `STREAM_PLAYBACK_LLHLS_URL`
- `STREAM_EXTERNAL_DELIVERY_PROVIDER`
- `STREAM_EXTERNAL_PLAYBACK_HLS_URL`
- `STREAM_EXTERNAL_PLAYBACK_LLHLS_URL`
- `STREAM_EXTERNAL_INGEST_RTMPS_URL`
- `STREAM_CLOUDFLARE_PROBE_ONLY`

Renderer health polling:

- `STREAM_RENDERER_HEALTH_URL`
- `STREAM_RENDERER_HEALTH_BEARER_TOKEN`
- `STREAM_RENDERER_HEALTH_POLL_MS`
- `STREAM_RENDERER_HEALTH_TIMEOUT_MS`
- `STREAM_RENDERER_HLS_FRESHNESS_MS`

Capture/encode defaults expected by the integrated branch:

- `FFMPEG_HWACCEL=nvidia`
- `STREAM_LOW_LATENCY=true`
- `STREAM_FPS=30`
- `HLS_TIME_SECONDS=1`
- `HLS_LIST_SIZE=6`
- `HLS_DELETE_THRESHOLD=24`

## Deployment Checks

After every Railway deploy verify:

1. `/health` returns `200`
2. `/api/streaming/capture/status` includes:
   - `metrics`
   - `hlsManifest`
   - `delivery`
   - `sourceRuntime` when the source worker is healthy
3. `/api/streaming/capture/smoke` includes:
   - `currentSceneUrl`
   - `activeBundle`
   - `deliveryMode`
   - `captureFpsP50/P95`
   - `encodeFpsP50/P95`
4. `/api/hyperbet/config` resolves
5. the returned `delivery.playbackUrl` matches the intended viewer path
6. `rendererHealth.ready=true` only when render, encode, and delivery are fresh
7. source-worker restarts should be health-driven rather than hidden behind
   the API/control-plane process
8. `channel.canonicalDestinationId` and `channel.fallbackDestinationId`
   represent the intended provider ordering for the environment
