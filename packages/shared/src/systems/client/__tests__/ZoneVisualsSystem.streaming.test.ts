import { describe, expect, it } from "vitest";
import { shouldRenderZoneMarker } from "../ZoneVisualsSystem";

function makeWindow(pathname: string, search = ""): Window {
  return { location: { pathname, search } } as unknown as Window;
}

describe("ZoneVisualsSystem streaming marker policy", () => {
  it("suppresses only the arena marker in broadcast and embedded spectator viewports", () => {
    for (const win of [
      makeWindow("/stream.html"),
      makeWindow("/", "?embedded=true&mode=spectator"),
    ]) {
      expect(shouldRenderZoneMarker("duel_arena", win)).toBe(false);
      expect(shouldRenderZoneMarker("central_haven", win)).toBe(true);
    }
  });

  it("preserves the arena marker for ordinary gameplay", () => {
    expect(shouldRenderZoneMarker("duel_arena", makeWindow("/play"))).toBe(
      true,
    );
  });
});
