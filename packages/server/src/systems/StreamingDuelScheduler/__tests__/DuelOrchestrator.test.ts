import { describe, expect, it } from "vitest";
import {
  type DuelArenaConfig,
  getDuelArenaConfig,
  isPositionInsideCombatArena,
  tileChebyshevDistance,
  worldToTile,
} from "@hyperscape/shared";
import { computeStreamingArenaEngagementSpawnPoints } from "../managers/DuelOrchestrator";

function expectAdjacent(spawns: {
  agent1: { x: number; z: number };
  agent2: { x: number; z: number };
}) {
  expect(
    tileChebyshevDistance(
      worldToTile(spawns.agent1.x, spawns.agent1.z),
      worldToTile(spawns.agent2.x, spawns.agent2.z),
    ),
  ).toBe(1);
}

describe("DuelOrchestrator streaming arena spawns", () => {
  it("places streaming contestants on adjacent combat tiles inside the arena", () => {
    const spawns =
      computeStreamingArenaEngagementSpawnPoints(getDuelArenaConfig());

    expectAdjacent(spawns);
    expect(isPositionInsideCombatArena(spawns.agent1.x, spawns.agent1.z)).toBe(
      true,
    );
    expect(isPositionInsideCombatArena(spawns.agent2.x, spawns.agent2.z)).toBe(
      true,
    );
  });

  it("keeps adjacent combat spacing for width-oriented arena layouts", () => {
    const config: DuelArenaConfig = {
      ...getDuelArenaConfig(),
      spawnLayout: "alongWidth",
    };

    expectAdjacent(computeStreamingArenaEngagementSpawnPoints(config));
  });
});
