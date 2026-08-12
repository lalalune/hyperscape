import { describe, expect, it } from "vitest";
import {
  isEmbeddedSpectatorViewport,
  isStreamPageRoute,
  isStreamingLikeViewport,
  resolveClientViewportRuntimeProfile,
  resolveStreamingRenderFrameRate,
  shouldStreamVegetationBackgroundLods,
} from "../clientViewportMode";

function makeWindow(pathname: string, search = ""): Window {
  return { location: { pathname, search } } as unknown as Window;
}

describe("client viewport mode", () => {
  it("recognizes the canonical stream page without relying on a global window", () => {
    const win = makeWindow("/stream.html");
    expect(isStreamPageRoute(win)).toBe(true);
    expect(isStreamingLikeViewport(win)).toBe(true);
  });

  it("recognizes only explicit embedded spectator viewports", () => {
    expect(
      isEmbeddedSpectatorViewport(
        makeWindow("/", "?embedded=true&mode=spectator"),
      ),
    ).toBe(true);
    expect(
      isEmbeddedSpectatorViewport(
        makeWindow("/", "?embedded=true&mode=streaming"),
      ),
    ).toBe(false);
  });

  it("omits exploration-only startup work for stream and spectator viewports", () => {
    for (const win of [
      makeWindow("/stream.html"),
      makeWindow("/", "?embedded=true&mode=spectator"),
    ]) {
      expect(resolveClientViewportRuntimeProfile(win)).toEqual({
        streamingLike: true,
        enableLocalPhysics: false,
        enableProceduralExplorationSystems: false,
        prewarmTreeCache: false,
      });
    }

    expect(resolveClientViewportRuntimeProfile(makeWindow("/play"))).toEqual({
      streamingLike: false,
      enableLocalPhysics: true,
      enableProceduralExplorationSystems: true,
      prewarmTreeCache: true,
    });
  });

  it("resolves a bounded capture-aligned stream render rate", () => {
    expect(
      resolveStreamingRenderFrameRate(
        makeWindow("/stream.html", "?streamFps=60"),
      ),
    ).toBe(60);
    expect(
      resolveStreamingRenderFrameRate(
        makeWindow("/stream.html", "?streamFps=240"),
      ),
    ).toBe(60);
    expect(
      resolveStreamingRenderFrameRate(
        makeWindow("/stream.html", "?streamFps=invalid"),
      ),
    ).toBe(30);
  });

  it("keeps deferred vegetation LOD uploads out of broadcast viewports", () => {
    expect(
      shouldStreamVegetationBackgroundLods(makeWindow("/stream.html")),
    ).toBe(false);
    expect(
      shouldStreamVegetationBackgroundLods(
        makeWindow("/", "?embedded=true&mode=spectator"),
      ),
    ).toBe(false);
    expect(shouldStreamVegetationBackgroundLods(makeWindow("/play"))).toBe(
      true,
    );
  });
});
