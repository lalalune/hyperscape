import { describe, expect, it } from "vitest";

import { resolveStreamCountdownDisplay } from "../../../src/components/streaming/streamCountdown";

describe("resolveStreamCountdownDisplay", () => {
  it("shows an honest announcement countdown until betting actually closes", () => {
    const display = resolveStreamCountdownDisplay({
      phase: "ANNOUNCEMENT",
      betCloseTime: 20_000,
      fallbackTimeRemainingMs: 500,
      nowMs: 19_001,
    });

    expect(display.kind).toBe("timer");
    expect(display.label).toBe("Betting closes");
    expect(display.text).toBe("0:01");
  });

  it("shows a blank timer hold once announcement time has crossed zero", () => {
    const display = resolveStreamCountdownDisplay({
      phase: "ANNOUNCEMENT",
      betCloseTime: 20_000,
      fallbackTimeRemainingMs: 0,
      nowMs: 20_000,
    });

    expect(display.kind).toBe("hold");
    expect(display.holdState).toBe("preparing_arena");
    expect(display.text).toBe("__:__");
    expect(display.label).toBe("");
  });

  it("shows Starting... once countdown crossed zero before phase flip", () => {
    const display = resolveStreamCountdownDisplay({
      phase: "COUNTDOWN",
      fightStartTime: 40_000,
      fallbackTimeRemainingMs: 0,
      nowMs: 40_000,
    });

    expect(display.kind).toBe("hold");
    expect(display.holdState).toBe("starting");
    expect(display.text).toBe("Starting...");
  });
});
