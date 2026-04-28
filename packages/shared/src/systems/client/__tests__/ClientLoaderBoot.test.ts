import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLoader } from "../ClientLoader";
import { EventType } from "../../../types/events";

function createMockWorld() {
  return {
    resolveURL: (url: string) => url,
    emit: vi.fn(),
    network: {
      send: vi.fn(),
    },
    camera: {},
    stage: {
      scene: {},
      octree: {},
    },
    setupMaterial: vi.fn(),
  } as const;
}

describe("ClientLoader boot safeguards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("indexedDB", undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("times out hanging fetches instead of waiting forever", async () => {
    const world = createMockWorld();
    const loader = new ClientLoader(world as never);

    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const filePromise = loader.loadFile("https://cdn.example.com/hanging.glb");
    const rejection = expect(filePromise).rejects.toThrow(
      "Request timed out after 15000ms",
    );

    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
  });

  it("does not emit READY early while preload work is still unresolved", async () => {
    const world = createMockWorld();
    const loader = new ClientLoader(world as never);
    let resolveCritical: ((value: unknown) => void) | null = null;

    vi.spyOn(loader, "load").mockImplementation(
      (_type: string, url: string) => {
        if (url === "critical.glb") {
          return new Promise((resolve) => {
            resolveCritical = resolve;
          }) as Promise<never>;
        }
        return Promise.resolve({} as never);
      },
    );

    loader.preload("model", "critical.glb");
    loader.preload("emote", "background.glb");

    loader.execPreload();
    await vi.advanceTimersByTimeAsync(20000);

    expect(world.emit).not.toHaveBeenCalledWith(EventType.READY);
    expect(world.network.send).not.toHaveBeenCalledWith("clientReady", {});

    resolveCritical?.({} as never);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(world.emit).toHaveBeenCalledWith(EventType.READY);
    expect(world.network.send).toHaveBeenCalledWith("clientReady", {});
  });
});
