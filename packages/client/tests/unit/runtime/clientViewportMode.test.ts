import { describe, expect, it } from "vitest";
import {
  getViewportMode,
  isDedicatedStreamViewport,
  isEmbeddedSpectatorViewport,
  isStreamPageRoute,
  isStreamingLikeViewport,
} from "../../../../shared/src/runtime/clientViewportMode";

function createViewportWindow(params: {
  url: string;
  mode?: string;
  embedded?: boolean;
}): Window {
  const parsed = new URL(params.url);
  return {
    location: {
      pathname: parsed.pathname,
      search: parsed.search,
    },
    __HYPERSCAPE_CONFIG__: params.mode ? { mode: params.mode } : undefined,
    __HYPERSCAPE_EMBEDDED__: params.embedded === true,
  } as unknown as Window;
}

describe("clientViewportMode", () => {
  it("recognizes all supported stream route variants", () => {
    expect(
      isStreamPageRoute(
        createViewportWindow({ url: "https://example.com/stream" }),
      ),
    ).toBe(true);
    expect(
      isStreamPageRoute(
        createViewportWindow({ url: "https://example.com/stream/" }),
      ),
    ).toBe(true);
    expect(
      isStreamPageRoute(
        createViewportWindow({ url: "https://example.com/stream.html" }),
      ),
    ).toBe(true);
    expect(
      isStreamPageRoute(
        createViewportWindow({ url: "https://example.com/arena?page=stream" }),
      ),
    ).toBe(true);
  });

  it("treats explicit stream mode as a dedicated stream viewport", () => {
    const windowRef = createViewportWindow({
      url: "https://example.com/arena?mode=stream",
    });

    expect(getViewportMode(windowRef)).toBe("stream");
    expect(isDedicatedStreamViewport(windowRef)).toBe(true);
    expect(isStreamingLikeViewport(windowRef)).toBe(true);
  });

  it("keeps embedded spectator mode streaming-like without treating it as the dedicated stream preset", () => {
    const windowRef = createViewportWindow({
      url: "https://example.com/embed?embedded=true&mode=spectator",
      mode: "spectator",
      embedded: true,
    });

    expect(isEmbeddedSpectatorViewport(windowRef)).toBe(true);
    expect(isDedicatedStreamViewport(windowRef)).toBe(false);
    expect(isStreamingLikeViewport(windowRef)).toBe(true);
  });
});
