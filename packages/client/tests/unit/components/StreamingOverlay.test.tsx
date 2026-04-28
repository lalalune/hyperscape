import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamingOverlay } from "../../../src/components/streaming/StreamingOverlay";
import type { StreamingState } from "../../../src/screens/StreamingMode";

vi.mock("../../../src/components/streaming/AgentStatsDisplay", () => ({
  AgentStatsDisplay: ({ agent }: { agent: { name: string } }) => (
    <div>{agent.name}</div>
  ),
}));

vi.mock("../../../src/components/streaming/LeaderboardPanel", () => ({
  LeaderboardPanel: () => <div>Leaderboard</div>,
}));

vi.mock("../../../src/components/streaming/CountdownOverlay", () => ({
  CountdownOverlay: () => <div>Countdown overlay</div>,
}));

vi.mock("../../../src/components/streaming/VictoryOverlay", () => ({
  VictoryOverlay: () => <div>Victory overlay</div>,
}));

vi.mock("../../../src/components/streaming/DamageFloaters", () => ({
  DamageFloaters: () => <div>Damage floaters</div>,
}));

vi.mock("../../../src/components/streaming/PostFightStatsCard", () => ({
  PostFightStatsCard: () => <div>Post fight stats</div>,
}));

vi.mock("../../../src/components/streaming/StreamingBettingRail", () => ({
  StreamingBettingRail: () => <div>Betting rail</div>,
}));

vi.mock("../../../src/components/streaming/CombatLog", () => ({
  CombatLog: () => <div>Combat log</div>,
}));

function createStreamingState(
  overrides: Partial<StreamingState["cycle"]> = {},
): StreamingState {
  return {
    type: "STREAMING_STATE_UPDATE",
    cycle: {
      cycleId: "cycle-1",
      duelId: "duel-1",
      phase: "ANNOUNCEMENT",
      cycleStartTime: 1_000,
      phaseStartTime: 1_000,
      phaseEndTime: 51_000,
      timeRemaining: 0,
      agent1: {
        id: "agent-a",
        name: "Agent A",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 1,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      agent2: {
        id: "agent-b",
        name: "Agent B",
        provider: "provider",
        model: "model",
        hp: 10,
        maxHp: 10,
        combatLevel: 1,
        wins: 0,
        losses: 0,
        damageDealtThisFight: 0,
        highestHit: 0,
        attacksLanded: 0,
        healsUsed: 0,
        equipment: {},
        inventory: [],
        rank: 2,
        headToHeadWins: 0,
        headToHeadLosses: 0,
      },
      betOpenTime: 0,
      betCloseTime: 51_000,
      countdown: null,
      fightStartTime: null,
      arenaPositions: {
        agent1: [1, 0, 1],
        agent2: [3, 0, 3],
      },
      winnerId: null,
      winnerName: null,
      winReason: null,
      ...overrides,
    },
    leaderboard: [],
    cameraTarget: null,
  };
}

describe("StreamingOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks the announcement timer even when the parent state object does not change", () => {
    render(<StreamingOverlay state={createStreamingState()} />);

    expect(screen.getAllByText("0:51").length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(1_250);
      vi.setSystemTime(1_250);
    });

    expect(screen.getAllByText("0:50").length).toBeGreaterThan(0);
  });

  it("does not render the persistent lower-third banner during fights", () => {
    render(
      <StreamingOverlay state={createStreamingState({ phase: "FIGHTING" })} />,
    );

    expect(screen.queryByText("Hyperscape")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Live — round in progress"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("AI duel arena")).not.toBeInTheDocument();
  });
});
