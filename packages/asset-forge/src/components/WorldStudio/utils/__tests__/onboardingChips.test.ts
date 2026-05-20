/**
 * onboardingChips — idle suggestions + next-step chip tests.
 *
 * Phase 1.2 fifth carve. Pins the chip surfaces feeding the
 * dialog's empty-state and live-progress UI.
 */

import { describe, it, expect } from "vitest";

import {
  IDLE_SUGGESTIONS,
  nextStepChips,
  type NextStepChipPlan,
} from "../onboardingChips";

// A fully-empty plan — every slot unfilled. Each test fills the
// subset it wants to verify and asserts which chips emerge.
function emptyPlan(): NextStepChipPlan {
  return {
    pluginIds: null,
    terrainConfig: null,
    npcs: [],
    mobSpawns: [],
    quests: [],
    uiPack: null,
  };
}

describe("IDLE_SUGGESTIONS — content shape", () => {
  it("ships the 4 starter cards we expect on the empty state", () => {
    expect(IDLE_SUGGESTIONS).toHaveLength(4);
    const titles = IDLE_SUGGESTIONS.map((s) => s.title);
    expect(titles).toEqual([
      "Tropical island RPG",
      "Snowy mountains",
      "Empty canvas",
      "Top-down shooter",
    ]);
  });

  it("every card has emoji + title + subtitle + prompt non-empty", () => {
    for (const s of IDLE_SUGGESTIONS) {
      expect(s.emoji.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.subtitle.length).toBeGreaterThan(0);
      expect(s.prompt.length).toBeGreaterThan(0);
    }
  });

  it("emojis are unique across cards", () => {
    const emojis = IDLE_SUGGESTIONS.map((s) => s.emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
  });

  it("prompts are unique across cards (no duplicate intent)", () => {
    const prompts = IDLE_SUGGESTIONS.map((s) => s.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });
});

describe("nextStepChips — empty plan", () => {
  it("emits all 6 chips when every slot is empty", () => {
    const chips = nextStepChips(emptyPlan());
    const labels = chips.map((c) => c.label);
    expect(labels).toEqual([
      "Pick a gameplay style",
      "Shape the terrain",
      "Add NPCs",
      "Place mobs",
      "Add quests",
      "Design the HUD",
    ]);
  });

  it("each chip has a non-empty prompt", () => {
    const chips = nextStepChips(emptyPlan());
    for (const chip of chips) {
      expect(chip.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("nextStepChips — partial fill drops chips", () => {
  it("plugins filled → drops 'Pick a gameplay style'", () => {
    const plan = { ...emptyPlan(), pluginIds: ["combat"] };
    const labels = nextStepChips(plan).map((c) => c.label);
    expect(labels).not.toContain("Pick a gameplay style");
    expect(labels).toContain("Add NPCs"); // others remain
  });

  it("terrain filled → drops 'Shape the terrain'", () => {
    const plan = { ...emptyPlan(), terrainConfig: { maxHeight: 50 } };
    const labels = nextStepChips(plan).map((c) => c.label);
    expect(labels).not.toContain("Shape the terrain");
  });

  it("npcs non-empty → drops 'Add NPCs'", () => {
    const plan = { ...emptyPlan(), npcs: [{ id: "shopkeeper" }] };
    const labels = nextStepChips(plan).map((c) => c.label);
    expect(labels).not.toContain("Add NPCs");
  });

  it("mobs non-empty → drops 'Place mobs'", () => {
    const plan = { ...emptyPlan(), mobSpawns: [{ id: "spawn1" }] };
    const labels = nextStepChips(plan).map((c) => c.label);
    expect(labels).not.toContain("Place mobs");
  });

  it("quests non-empty → drops 'Add quests'", () => {
    const plan = { ...emptyPlan(), quests: [{ id: "intro" }] };
    const labels = nextStepChips(plan).map((c) => c.label);
    expect(labels).not.toContain("Add quests");
  });

  it("uiPack filled → drops 'Design the HUD'", () => {
    const plan = { ...emptyPlan(), uiPack: { id: "default-hud" } };
    const labels = nextStepChips(plan).map((c) => c.label);
    expect(labels).not.toContain("Design the HUD");
  });
});

describe("nextStepChips — fully filled plan", () => {
  it("returns empty array when every slot is set", () => {
    const fullPlan: NextStepChipPlan = {
      pluginIds: ["combat"],
      terrainConfig: { maxHeight: 50 },
      npcs: [{ id: "shopkeeper" }],
      mobSpawns: [{ id: "spawn1" }],
      quests: [{ id: "intro" }],
      uiPack: { id: "default-hud" },
    };
    expect(nextStepChips(fullPlan)).toEqual([]);
  });
});
