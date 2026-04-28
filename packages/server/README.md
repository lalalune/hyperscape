# Hyperscape Server

This package is the Hyperscapes API and control plane. For the duel-streaming
stack it should be read as the canonical source of lifecycle, renderer, and
delivery truth consumed by Hyperbet. The source worker is separate in staging
and production unless `DUEL_OWNS_STREAM_CAPTURE=true` is set for local
integrated ownership.

## Streaming Architecture

- Cloudflare Pages hosts the public stream page.
- The GPU host runs the dedicated source worker service for browser capture
  and FFmpeg encode.
- Railway runs this server package and publishes the canonical stream session.
- Cloudflare Stream is the canonical bettor playback rail on `enoomian/staging`.
- Self-hosted HLS remains available for operator smoke, debug, and explicit
  failover only.
- Automatic provider failover is disabled by default; bettors should not
  auto-cycle between playback providers.

This server is not the renderer of record.
The split topology is the default operating model.

## Same-Origin PhysX Requirement

The stream page must load PhysX JS and WASM same-origin from the Pages-hosted
client. Do not relax CSP to permit arbitrary script origins. If same-origin
loading is broken, the renderer should degrade instead of silently widening
policy.

## Delivery Configuration

Provider-neutral delivery envs:

- `STREAM_DELIVERY_MODE=self_hls|external_hls`
- `STREAM_DELIVERY_PROVIDER`
- `STREAM_CANONICAL_PROVIDER_PRIORITY`
- `STREAM_ENABLE_AUTOMATIC_FAILOVER`
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

Selection order for playback:

1. the canonical Cloudflare playback URL selected by persisted authority
   reconciliation
2. regular HLS derived from that same playback object when LL-HLS falls back
   in the player
3. self-hosted HLS only when an explicit operator/debug path enables failover

`hls-cdn-sync.ts` is fallback/object-store sync only.

## Capture And Encode Defaults

Personal staging expects:

- `FFMPEG_HWACCEL=nvidia`
- `STREAM_LOW_LATENCY=true`
- `STREAM_FPS=30`
- `HLS_TIME_SECONDS=1`
- `HLS_LIST_SIZE=6`
- `HLS_DELETE_THRESHOLD=24`

## Health Contract

The canonical capture status now includes additive fields that Hyperbet and
operator surfaces consume:

- `canonicalAuthority`
  - `providerLive`
  - `playbackProbeReady`
  - `decision`
  - `reason`
  - `revision`
- `sourceRuntime`
- `rendererHealth`
- `metrics`
  - `captureFps`
  - `encodeFps`
  - `droppedFrames`
  - `latestFrameAt`
  - `latestRenderTickAt`
  - `latestDuelStateTickAt`
  - `latestVisualChangeAt`
  - `visualChangeAgeMs`
  - `hlsManifest`
- `delivery`
  - `mode`
  - `provider`
  - `playbackUrl`
  - `canonicalDestination`
  - `fallbackDestination`

`publicReadiness` is the final server-side delivery gate for bettor playback.
It should be read as:

1. `sourceRuntime.ready`
2. persisted Cloudflare lifecycle / lifecycle-poll evidence
3. canonical playback probe health

It is not the same thing as player live-edge sync. Hyperbet derives bettor
"live synced" UX from player telemetry on top of this server gate.

Phase-aware degradation can emit:

- `render_tick_stale`
- `visual_change_stale`
- `capture_fps_low`
- `encoder_fps_low`
- `manifest_stale`
- `asset_origin_incomplete`

## Cloudflare Authority Reconciliation

Cloudflare authority truth is persisted under these storage keys:

- `streaming:cloudflare:lifecycle`
- `streaming:cloudflare:last-webhook`
- `streaming:cloudflare:last-lifecycle-poll`
- `streaming:cloudflare:last-playback-probe`
- `streaming:cloudflare:reconciliation`

The reconciliation decision is the operator-debug source of truth. Decision
ordering is:

1. `source_unready`
2. `provider_not_live`
3. `probe_unready`
4. `authority_stale`

When `STREAM_ENABLE_AUTOMATIC_FAILOVER=false`, fallback destinations may still
be emitted for compatibility, but they are not the normal bettor rail.

## Endpoints

Operationally important endpoints:

- `GET /health`
- `GET /api/streaming/state`
- `GET /api/streaming/state/events`
- `GET /api/streaming/capture/status`
- `GET /api/streaming/rtmp/status`
- `GET /api/hyperbet/config`

## Deployment Rule

Keep secrets and delivery URLs in Railway, Pages, and GPU-host runtime config.
Do not hardcode them in the repo and do not commit staging-only secrets.
