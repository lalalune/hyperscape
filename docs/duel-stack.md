# Duel Stack

This document is the authoritative streaming model for the duel arena stack on
`enoomian` personal staging and the basis for the canonical production path.

## Source Of Truth

Hyperscapes owns duel truth across three layers:

1. simulation truth
   - duel lifecycle
   - fighter state
   - result data
2. renderer truth
   - stream-page readiness
   - render tick freshness
   - visual change freshness
   - capture and encoder cadence
3. broadcast truth
   - channel identity
   - destination roles
   - canonical public readiness
   - fallback readiness
   - mirror isolation

Hyperbet does not invent a second broadcast model. It consumes the additive
session/feed contract that Hyperscapes publishes.

## Runtime Topology

- Cloudflare Pages hosts the public `/stream` page.
- `/stream` is a dedicated capture preset, not a generic spectator client.
- The stream preset keeps the duel camera path and combat/world SFX, but strips
  non-essential client systems that do not improve viewer output.
- The GPU host runs the dedicated source worker service (`hyperscape-stream-source`)
  for browser capture and FFmpeg encode.
- The duel API/control-plane service (`hyperscape-duel-api`) runs the duel stack
  without capture ownership unless `DUEL_OWNS_STREAM_CAPTURE=true` is set
  explicitly for local ownership mode.
- Railway hosts the Hyperscapes API and control plane.
- The transport plane fans out one encoded stream to multiple independent
  destinations using the existing FFmpeg tee architecture.
- Self-hosted HLS remains available on the GPU host for smoke, fallback, and
  diagnostics.
- Provider selection is environment-driven rather than hard-wired:
  `self_hls` can be canonical while Cloudflare remains a warm fallback or
  research rail.
- Twitch, Kick, YouTube, and custom restream outputs are mirrors.

Railway is not the renderer of record for personal staging. The channel is
always on; duel transitions update the content carried by the channel rather
than restarting the broadcast identity.

## Channel Contract

Each emitted session/feed frame carries a server-authored channel snapshot:

- `channel.id`
- `channel.mode`
- `channel.presentationDelayMs`
- `channel.activeDuelId`
- `channel.activeDuelKey`
- `channel.canonicalDestinationId`
- `channel.fallbackDestinationId`
- `channel.destinations[]`
- `channel.publicPlaybackUrl`
- `channel.publicReadiness`

Each destination entry carries:

- `id`
- `name`
- `role`
- `provider`
- `transport`
- `playbackUrl`
- `ingestUrl`
- `connected`
- `transportHealthy`
- `playbackReady`
- `manifestStatus`
- `lastError`
- `updatedAt`

The channel contract is authoritative. Keepers and frontends relay and consume
it; they do not reconstruct equivalent state from local env vars.

## Destination Roles

- `canonical`
  - the only destination that controls betting-page public readiness
  - Cloudflare on `enoomian/staging`, with operator-only failover outside the bettor path
- `fallback`
  - warm standby rail tracked independently from canonical truth
  - promoted only by an explicit authority/operator path, never by the browser
- `mirror`
  - downstream promotional outputs
  - Twitch, Kick, YouTube, custom

Mirror failures must not change canonical public readiness. Fallback is tracked
independently and is not promoted automatically by the browser.

## Delivery Configuration

The runtime remains provider-neutral, but delivery config is now a bootstrap
helper for the source server and bridge, not a canonical truth surface.

Relevant bootstrap envs include:

- `STREAM_DELIVERY_MODE`
- `STREAM_DELIVERY_PROVIDER`
- `STREAM_CANONICAL_PROVIDER_PRIORITY`
- `STREAM_FAILBACK_SOAK_MS`
- `STREAM_INGEST_*`
- `STREAM_PLAYBACK_*`
- `STREAM_EXTERNAL_DELIVERY_PROVIDER`
- `STREAM_EXTERNAL_PLAYBACK_HLS_URL`
- `STREAM_EXTERNAL_PLAYBACK_LLHLS_URL`
- `STREAM_EXTERNAL_INGEST_RTMPS_URL`
- `STREAM_CLOUDFLARE_PROBE_ONLY`
- `DUEL_OWNS_STREAM_CAPTURE=true` for explicit local integrated-mode capture
  ownership only

Those envs define destination bootstrapping on the source server. They are not
for keepers or frontends to use when deciding whether canonical betting
playback is healthy.

## Renderer Health Model

The stream page publishes a heartbeat and the capture pipeline persists richer
status snapshots. Health is phase-aware:

- `IDLE`, `OPEN`, `LOCKED`
  - require fresh render tick and fresh delivery/manifests
- `FIGHT`, `RESOLUTION`
  - also require recent visual change
  - also require acceptable capture and encoder cadence

Current degraded reasons include:

- `render_tick_stale`
- `visual_change_stale`
- `capture_fps_low`
- `encoder_fps_low`
- `manifest_stale`
- `asset_origin_incomplete`

Renderer health and broadcast readiness are related but not identical. A
healthy renderer with an unhealthy canonical destination is a distribution-plane
incident, not a simulation or renderer incident.

## Canonical Public Readiness

Canonical betting readiness is derived only from the canonical destination.

For external-delivery canonical providers such as Cloudflare, readiness
requires both:

- healthy bridge transport to the canonical destination
- a positive public playback probe against the canonical playback manifest

For self-hosted HLS canonical delivery, readiness depends on local manifest
freshness plus local transport health. Mirrors do not participate in canonical
readiness.

Missing canonical readiness must be treated as not ready.

## Required Health Checks

For the renderer/capture worker:

- `GET /api/streaming/capture/status`
- `GET /api/streaming/capture/smoke`
- `GET /api/streaming/rtmp/status`
- `GET /live/stream.m3u8`
- `capture/status` should reflect source-worker readiness before canonical
  public playback is considered healthy

For the API/control plane:

- `GET /health`
- `GET /api/streaming/state`
- `GET /api/streaming/state/events`
- `GET /api/hyperbet/config`
- betting feed/session payloads must include `channel.publicReadiness`

For the canonical public rail:

- probe the canonical playback manifest exposed in `channel.publicPlaybackUrl`
- verify public playback readiness independently from ingest connectivity

For the rendered page:

- `/stream` must visibly move through a full duel
- during active combat, `visualChangeAgeMs < 1000`
- during active combat, `captureFps >= 24`
- during active combat, `encodeFps >= 24`

## Personal Staging Rule

On `enoomian` personal staging:

- Pages hosts the public client
- the GPU box runs the source worker service that renders and encodes
- Railway serves the API and control plane
- self-hosted HLS is the current canonical betting viewer path
- Cloudflare Stream is configured as a warm fallback and investigation rail
- canonical selection is driven by
  `STREAM_CANONICAL_PROVIDER_PRIORITY=self_hls,cloudflare_stream`
- `STREAM_CLOUDFLARE_PROBE_ONLY=false` keeps Cloudflare exercised in parallel
  without letting it poison canonical readiness while it is unhealthy
- mirrors are optional and independent
- health-driven source-worker restarts are handled by the source worker
  process supervisor, not the API control plane

## Operational Outcomes

### Canonical Down, Mirrors Healthy

- betting playback is unavailable
- mirror viewers may still be healthy
- this is a canonical distribution incident

### Mirror Down, Canonical Healthy

- betting playback remains healthy
- only that mirror destination is degraded
- do not relabel this as a betting outage

### Renderer Healthy, Canonical Not Ready

- duel truth and renderer output continue
- betting playback remains unavailable until public readiness recovers
- investigate canonical destination transport health and manifest probe results

### Duel Transition

- the channel remains continuous
- only `activeDuelId` and content-related state change
- transport identity and routing policy should not reset
