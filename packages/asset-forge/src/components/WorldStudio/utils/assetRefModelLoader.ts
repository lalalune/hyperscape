/**
 * Asset-pack-aware model loader for studio markers.
 *
 * Bridges `assetRef` (the `<packId>/<entryId>` string carried on
 * agent-placed entities) to a renderable `THREE.Object3D`. The
 * resolver (`utils/assetRefResolver`) maps `assetRef` → the
 * pack manifest's `modelUrl`; `loadModelForScene` then loads + WebGPU-converts
 * the GLB. We cache the result per `assetRef` so repeated markers
 * sharing the same ref reuse one network/GPU upload.
 *
 * `getCachedAssetRefModel` is sync — used by the marker render path
 * to decide between "use real model now" vs "fall back to abstract
 * marker." `loadAssetRefModelOnce` is async — kicked off
 * fire-and-forget when the cache misses; subsequent renders pick
 * up the loaded model.
 *
 * Wires in HYPERIA_DECOUPLING.R0.QW2: previously `assetRefResolver`
 * existed but had zero callers, so the asset-pack ecosystem did
 * nothing at runtime. With this loader in the marker path, an
 * agent placement carrying `assetRef: "<pack>/<entry>"` now
 * actually renders that pack's GLB model.
 */

import type * as THREE from "three";

import { resolveAssetRef } from "../../../utils/assetRefResolver";
import { loadModelForScene } from "../../../utils/loadModelForScene";

/**
 * Loaded model cache keyed by full assetRef. `null` means we
 * tried to resolve/load and failed — caller falls back to
 * the legacy `tryLoadEntityModel` path or the abstract marker.
 */
const modelCache = new Map<string, THREE.Object3D | null>();

/** Concurrent loads share one promise per assetRef. */
const inFlight = new Map<string, Promise<THREE.Object3D | null>>();

/**
 * Synchronous read. Returns the cached `Object3D` (the *original*
 * — caller is expected to clone before adding to the scene), or
 * `null` if the cache holds a known-failed entry, or `undefined`
 * if we haven't attempted to load it yet.
 */
export function getCachedAssetRefModel(
  assetRef: string,
): THREE.Object3D | null | undefined {
  return modelCache.get(assetRef);
}

/**
 * Resolve + load a model for the given assetRef. Idempotent +
 * coalesced — concurrent calls share one network round-trip and
 * one GPU upload. Returns `null` on any failure (unknown pack,
 * missing entry, GLB load error). The caller is expected to fall
 * back to the legacy entity-model cache or an abstract marker.
 */
export async function loadAssetRefModelOnce(
  assetRef: string,
): Promise<THREE.Object3D | null> {
  if (modelCache.has(assetRef)) {
    return modelCache.get(assetRef) ?? null;
  }
  const existing = inFlight.get(assetRef);
  if (existing) return existing;
  const promise = (async (): Promise<THREE.Object3D | null> => {
    try {
      const url = await resolveAssetRef(assetRef);
      if (!url) {
        modelCache.set(assetRef, null);
        return null;
      }
      const model = await loadModelForScene(url);
      modelCache.set(assetRef, model);
      return model;
    } catch {
      modelCache.set(assetRef, null);
      return null;
    } finally {
      inFlight.delete(assetRef);
    }
  })();
  inFlight.set(assetRef, promise);
  return promise;
}

/** Test-only cache reset. */
export function _clearAssetRefModelCache(): void {
  modelCache.clear();
  inFlight.clear();
}
