import { describe, expect, it } from "vitest";

import { parseStreamingReplayFrameState } from "../../../src/routes/streaming.js";

describe("streaming delayed replay state", () => {
  it("preserves the terminal notice used by the delayed public stream", () => {
    const terminalNotice = {
      cycleId: "cycle-12",
      duelId: "duel-12",
      outcome: "cancelled",
      reason: "no_combat_activity",
      occurredAt: 12_000,
      expiresAt: 18_000,
    };

    expect(
      parseStreamingReplayFrameState({
        payload: JSON.stringify({
          cycle: {
            id: "cycle-12",
            phase: "IDLE",
            rendererHealth: {
              ready: false,
              degradedReason: "camera_target_unresolved",
              updatedAt: 12_500,
            },
          },
          leaderboard: [],
          terminalNotice,
          cameraTarget: "fighter-a",
        }),
      }),
    ).toEqual({
      cycle: {
        id: "cycle-12",
        phase: "IDLE",
        rendererHealth: {
          ready: false,
          degradedReason: "camera_target_unresolved",
          updatedAt: 12_500,
        },
      },
      leaderboard: [],
      terminalNotice,
      cameraTarget: "fighter-a",
    });
  });

  it("normalizes legacy replay frames without a terminal notice to null", () => {
    expect(
      parseStreamingReplayFrameState({
        payload: JSON.stringify({
          cycle: { id: "cycle-legacy" },
          leaderboard: [],
        }),
      }),
    ).toMatchObject({ terminalNotice: null, cameraTarget: null });
  });
});
