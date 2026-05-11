/**
 * `assetRefModelLoader` — async assetRef → THREE.Object3D loader tests.
 *
 * The loader is the runtime bridge between agent-placed entities
 * carrying `assetRef: "<pack>/<entry>"` strings and the actual
 * rendered GLB model. Coalesced loads (concurrent calls share
 * one promise) + per-ref cache (success OR known-failed)
 * are the contract the marker render path depends on — without
 * coalescing, mounting 100 markers with the same assetRef would
 * fire 100 redundant network round-trips.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the dependencies before importing the module under test.
vi.mock("../../../../utils/assetRefResolver", () => ({
  resolveAssetRef: vi.fn(),
}));
vi.mock("../../../../utils/loadModelForScene", () => ({
  loadModelForScene: vi.fn(),
}));

import {
  _clearAssetRefModelCache,
  getCachedAssetRefModel,
  loadAssetRefModelOnce,
} from "../assetRefModelLoader";
import { resolveAssetRef } from "../../../../utils/assetRefResolver";
import { loadModelForScene } from "../../../../utils/loadModelForScene";

const mockResolveAssetRef = vi.mocked(resolveAssetRef);
const mockLoadModelForScene = vi.mocked(loadModelForScene);

beforeEach(() => {
  _clearAssetRefModelCache();
  vi.clearAllMocks();
});

afterEach(() => {
  _clearAssetRefModelCache();
});

const FAKE_MODEL = { isObject3D: true, name: "fake-model" } as never;

describe("getCachedAssetRefModel — sync cache read", () => {
  it("returns undefined when the ref has never been loaded", () => {
    expect(getCachedAssetRefModel("@pack/never-touched")).toBeUndefined();
  });

  it("returns the cached model after a successful load", async () => {
    mockResolveAssetRef.mockResolvedValue("https://example.com/m.glb");
    mockLoadModelForScene.mockResolvedValue(FAKE_MODEL);
    await loadAssetRefModelOnce("@pack/entry");
    expect(getCachedAssetRefModel("@pack/entry")).toBe(FAKE_MODEL);
  });

  it("returns null after a known failure (resolver returned null)", async () => {
    mockResolveAssetRef.mockResolvedValue(null);
    await loadAssetRefModelOnce("@unknown/entry");
    expect(getCachedAssetRefModel("@unknown/entry")).toBeNull();
  });
});

describe("loadAssetRefModelOnce — success path", () => {
  it("resolves + loads the model and returns it", async () => {
    mockResolveAssetRef.mockResolvedValue("https://example.com/m.glb");
    mockLoadModelForScene.mockResolvedValue(FAKE_MODEL);
    const result = await loadAssetRefModelOnce("@pack/entry");
    expect(result).toBe(FAKE_MODEL);
    expect(mockResolveAssetRef).toHaveBeenCalledWith("@pack/entry");
    expect(mockLoadModelForScene).toHaveBeenCalledWith(
      "https://example.com/m.glb",
    );
  });

  it("subsequent calls hit the cache (no re-resolve, no re-load)", async () => {
    mockResolveAssetRef.mockResolvedValue("https://example.com/m.glb");
    mockLoadModelForScene.mockResolvedValue(FAKE_MODEL);
    await loadAssetRefModelOnce("@pack/entry");
    await loadAssetRefModelOnce("@pack/entry");
    await loadAssetRefModelOnce("@pack/entry");
    expect(mockResolveAssetRef).toHaveBeenCalledTimes(1);
    expect(mockLoadModelForScene).toHaveBeenCalledTimes(1);
  });
});

describe("loadAssetRefModelOnce — failure paths", () => {
  it("returns null when resolveAssetRef returns null (unknown pack/entry)", async () => {
    mockResolveAssetRef.mockResolvedValue(null);
    const result = await loadAssetRefModelOnce("@unknown/entry");
    expect(result).toBeNull();
    // Loader should NOT have been called.
    expect(mockLoadModelForScene).not.toHaveBeenCalled();
  });

  it("returns null when resolveAssetRef throws", async () => {
    mockResolveAssetRef.mockRejectedValue(new Error("network fail"));
    const result = await loadAssetRefModelOnce("@flaky/entry");
    expect(result).toBeNull();
  });

  it("returns null when loadModelForScene throws", async () => {
    mockResolveAssetRef.mockResolvedValue("https://example.com/m.glb");
    mockLoadModelForScene.mockRejectedValue(new Error("GLB parse fail"));
    const result = await loadAssetRefModelOnce("@pack/entry");
    expect(result).toBeNull();
  });

  it("caches the failure — subsequent calls don't retry the resolver", async () => {
    mockResolveAssetRef.mockResolvedValue(null);
    await loadAssetRefModelOnce("@unknown/entry");
    await loadAssetRefModelOnce("@unknown/entry");
    await loadAssetRefModelOnce("@unknown/entry");
    expect(mockResolveAssetRef).toHaveBeenCalledTimes(1);
  });
});

describe("loadAssetRefModelOnce — concurrent-load coalescing", () => {
  it("concurrent calls for the same ref share one resolveAssetRef + loadModelForScene call", async () => {
    let resolveResolver: (v: string | null) => void;
    let resolveLoader: (v: unknown) => void;
    const resolverPromise = new Promise<string | null>((r) => {
      resolveResolver = r;
    });
    const loaderPromise = new Promise<unknown>((r) => {
      resolveLoader = r;
    });
    mockResolveAssetRef.mockReturnValue(
      resolverPromise as unknown as ReturnType<typeof resolveAssetRef>,
    );
    mockLoadModelForScene.mockReturnValue(
      loaderPromise as unknown as ReturnType<typeof loadModelForScene>,
    );

    // Fire 10 concurrent loads of the same ref before either
    // promise resolves.
    const promises = Array.from({ length: 10 }, () =>
      loadAssetRefModelOnce("@pack/concurrent"),
    );

    // Resolve the chain.
    resolveResolver!("https://example.com/m.glb");
    await new Promise((r) => setTimeout(r, 0));
    resolveLoader!(FAKE_MODEL);
    const results = await Promise.all(promises);

    // Every caller got the same model.
    for (const r of results) expect(r).toBe(FAKE_MODEL);
    // But only ONE round-trip + ONE GPU upload.
    expect(mockResolveAssetRef).toHaveBeenCalledTimes(1);
    expect(mockLoadModelForScene).toHaveBeenCalledTimes(1);
  });

  it("after the in-flight promise resolves, subsequent calls hit the success cache", async () => {
    mockResolveAssetRef.mockResolvedValue("https://example.com/m.glb");
    mockLoadModelForScene.mockResolvedValue(FAKE_MODEL);
    await loadAssetRefModelOnce("@pack/entry");
    // In-flight map should be empty; the next call hits the cache.
    const second = await loadAssetRefModelOnce("@pack/entry");
    expect(second).toBe(FAKE_MODEL);
    expect(mockResolveAssetRef).toHaveBeenCalledTimes(1);
  });
});

describe("_clearAssetRefModelCache (test-only)", () => {
  it("forces a fresh load after clearing", async () => {
    mockResolveAssetRef.mockResolvedValue("https://example.com/m.glb");
    mockLoadModelForScene.mockResolvedValue(FAKE_MODEL);
    await loadAssetRefModelOnce("@pack/entry");
    _clearAssetRefModelCache();
    expect(getCachedAssetRefModel("@pack/entry")).toBeUndefined();
    await loadAssetRefModelOnce("@pack/entry");
    // Second load attempts the resolver again.
    expect(mockResolveAssetRef).toHaveBeenCalledTimes(2);
  });
});
