import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getCancellationPresentation,
  StreamingOverlay,
} from "../../../../src/components/streaming/StreamingOverlay";
import type {
  AgentInfo,
  StreamingState,
} from "../../../../src/screens/StreamingMode";

function createAgent(id: string, name: string, rank: number): AgentInfo {
  return {
    id,
    name,
    provider: "scripted",
    model: "melee",
    hp: 55,
    maxHp: 55,
    combatLevel: 68,
    wins: 3,
    losses: 1,
    damageDealtThisFight: 12,
    highestHit: 6,
    attacksLanded: 4,
    healsUsed: 0,
    equipment: { weapon: "bronze_longsword" },
    inventory: [],
    loadoutFingerprint: `${id}-frozen-snapshot`,
    availableCombatStyles: ["melee"],
    combatLoadouts: {
      melee: {
        role: "melee",
        weaponId: "bronze_longsword",
        arrowsId: null,
        shieldId: "wooden_shield",
        spellId: null,
      },
    },
    loadoutFrozen: true,
    rank,
    headToHeadWins: 2,
    headToHeadLosses: 1,
  };
}

function createFightingState(): StreamingState {
  return {
    type: "STREAMING_STATE_UPDATE",
    cycle: {
      cycleId: "cycle-1",
      phase: "FIGHTING",
      cycleStartTime: 1_000,
      phaseStartTime: 2_000,
      phaseEndTime: 62_000,
      timeRemaining: 60_000,
      agent1: createAgent("agent-a", "Riven Ash", 1),
      agent2: createAgent("agent-b", "Astra Vale", 2),
      duelId: "duel-1",
      countdown: null,
      fightStartTime: null,
      arenaPositions: {
        agent1: [350, 0.42, 405.35],
        agent2: [350, 0.42, 406.65],
      },
      winnerId: null,
      winnerName: null,
      outcome: null,
      winReason: null,
    },
    leaderboard: [],
    cameraTarget: "agent-a",
  };
}

function createResolutionState(): StreamingState {
  const state = createFightingState();
  state.cycle.phase = "RESOLUTION";
  state.cycle.timeRemaining = 4_000;
  state.cycle.winnerId = "agent-a";
  state.cycle.winnerName = "Riven Ash";
  state.cycle.outcome = "win";
  state.cycle.winReason = "kill";
  return state;
}

describe("streaming cancellation presentation", () => {
  it("uses clear no-contest copy without exposing internal reason tokens", () => {
    const presentation = getCancellationPresentation(
      "invalid_resolution_participants",
    );

    expect(presentation).toEqual({
      eyebrow: "Round cancelled",
      title: "No contest",
      sub: "Arena officials stopped the round before an official result. No winner was declared.",
    });
    expect(JSON.stringify(presentation)).not.toContain(
      "invalid_resolution_participants",
    );
  });

  it("explains common cancellation classes in viewer language", () => {
    expect(getCancellationPresentation("no_combat_activity").sub).toContain(
      "without enough verified combat",
    );
    expect(getCancellationPresentation("both_agents_missing").sub).toContain(
      "contestant became unavailable",
    );
    expect(getCancellationPresentation("scheduler_shutdown").sub).toContain(
      "broadcast ended",
    );
  });

  it("binds active-fight HUD elements to responsive safe-crop classes", () => {
    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, { state: createFightingState() }),
    );

    for (const className of [
      "streaming-duel-info",
      "streaming-fight-timer",
      "streaming-fight-timer-outer",
      "streaming-fight-timer-inner",
      "streaming-agent-stats--left",
      "streaming-agent-stats--right",
      "streaming-lower-third",
    ]) {
      expect(markup).toContain(className);
    }
  });

  it("shows a neutral refund-review state after cancellation", () => {
    const state = createFightingState();
    state.cycle.phase = "IDLE";
    state.cycle.agent1 = null;
    state.cycle.agent2 = null;
    state.cycle.duelId = null;
    state.terminalNotice = {
      cycleId: "cycle-1",
      duelId: "duel-1",
      outcome: "cancelled",
      reason: "contestant_unavailable",
      occurredAt: Date.now() - 1_000,
      expiresAt: Date.now() + 9_000,
      agent1Id: "agent-a",
      agent1Name: "Riven Ash",
      agent2Id: "agent-b",
      agent2Name: "Astra Vale",
    };

    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, {
        state,
        bettingConfig: {
          configured: true,
          betUrl: "https://bet.example/duels",
          bettingBridgeEnabled: true,
          ready: true,
          unavailableReason: null,
          checkedAt: Date.now(),
        },
      }),
    );

    expect(markup).toContain("No contest");
    expect(markup).toContain("review this market&#x27;s refund status");
    expect(markup).toContain("Riven Ash vs Astra Vale");
    expect(markup).toContain("duel=duel-1");
    expect(markup).not.toContain("contestant_unavailable");
    expect(markup).not.toContain("refunded");
  });

  it("keeps the result surface focused on the matchup and stat summary", () => {
    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, {
        state: createResolutionState(),
      }),
    );

    expect(markup).toContain("Round complete");
    expect(markup).toContain("Next duel");
    expect(markup).not.toContain("streaming-combat-log");
    expect(markup).not.toContain("streaming-leaderboard-mount");
  });

  it("describes announcement fighters as already staged in the arena", () => {
    const state = createFightingState();
    state.cycle.phase = "ANNOUNCEMENT";

    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, { state }),
    );

    expect(markup).toContain("Fighters staged in the arena — the bell is next");
    expect(markup.match(/Frozen loadouts/g)).toHaveLength(2);
    expect(markup).toContain("Bronze Longsword · Wooden Shield");
    expect(markup).not.toContain("heading to the arena");
  });

  it("removes frozen-loadout disclosure as soon as the betting window closes", () => {
    const state = createFightingState();
    state.cycle.phase = "COUNTDOWN";

    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, { state }),
    );

    expect(markup).not.toContain("Frozen loadouts");
    expect(markup).not.toContain("data-loadout-fingerprint");
  });

  it("keeps a stable fight-log surface throughout countdown", () => {
    const state = createFightingState();
    state.cycle.phase = "COUNTDOWN";

    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, { state }),
    );

    expect(markup).toContain("streaming-combat-log");
    expect(markup).toContain("Waiting for the opening bell");
  });

  it("never exposes a betting action while runtime authority is unready", () => {
    const state = createFightingState();
    state.cycle.phase = "ANNOUNCEMENT";
    const markup = renderToStaticMarkup(
      React.createElement(StreamingOverlay, {
        state,
        bettingConfig: {
          configured: true,
          betUrl: null,
          bettingBridgeEnabled: true,
          ready: false,
          unavailableReason: "stream_services_unready",
          checkedAt: Date.now(),
        },
      }),
    );

    expect(markup).toContain("Betting unavailable");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toContain("Place a bet");
    expect(markup).not.toContain("Betting open on this matchup");
    expect(markup).not.toContain("stream_services_unready");
    expect(markup).not.toContain("https://bet.example/duels");
  });
});
