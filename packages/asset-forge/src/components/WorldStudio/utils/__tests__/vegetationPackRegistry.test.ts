/**
 * PLAN_PACK_TYPES Phase 3 — vegetationPackRegistry contract.
 *
 * Asserts the merge + lookup semantics consumers rely on:
 * empty registry returns empty maps, registered packs
 * populate the maps, the getDensityRulesForBiome filter
 * returns just the matching subset, and re-registration
 * replaces the prior set atomically.
 */
import { describe, it, expect, afterEach } from "vitest";
import type {
  VegetationSpecies,
  VegetationDensityRule,
} from "@hyperforge/manifest-schema";
import {
  setVegetationPackContent,
  getActiveVegetationSpecies,
  getActiveVegetationDensityRules,
  getDensityRulesForBiome,
  _clearVegetationPackContent,
} from "../vegetationPackRegistry";

const OAK: VegetationSpecies = {
  id: "oak",
  name: "Oak",
  description: "",
  category: "tree",
  modelRef: "@hyperforge/asset-pack-hyperia-trees-v1/oak",
  baseScale: 1,
  scaleVariation: [0.9, 1.1],
  randomRotation: true,
  alignToNormal: false,
  yOffset: 0,
  maxSlope: 0.4,
  tags: ["tree", "deciduous"],
};

const PALM: VegetationSpecies = {
  id: "palm",
  name: "Palm",
  description: "",
  category: "tree",
  modelRef: "@hyperforge/asset-pack-tropical-trees-v1/palm",
  baseScale: 1,
  scaleVariation: [0.8, 1.2],
  randomRotation: true,
  alignToNormal: false,
  yOffset: 0,
  maxSlope: 0.3,
  tags: ["tree", "tropical"],
};

const FOREST_TREES: VegetationDensityRule = {
  id: "forest-trees",
  biomeId: "forest",
  category: "tree",
  density: 0.05,
  minSpacing: 2,
  clustering: false,
  noiseScale: 1,
  noiseThreshold: 0.4,
  avoidWater: true,
  avoidSteepSlopes: true,
};

const BEACH_PALMS: VegetationDensityRule = {
  id: "beach-palms",
  biomeId: "beach",
  category: "tree",
  density: 0.02,
  minSpacing: 5,
  clustering: true,
  clusterSize: 3,
  noiseScale: 1,
  noiseThreshold: 0.5,
  avoidWater: true,
  avoidSteepSlopes: true,
};

describe("vegetationPackRegistry", () => {
  afterEach(() => {
    _clearVegetationPackContent();
  });

  it("returns empty maps when nothing is registered", () => {
    expect(getActiveVegetationSpecies().size).toBe(0);
    expect(getActiveVegetationDensityRules().size).toBe(0);
  });

  it("registers species + rules and exposes them by id", () => {
    setVegetationPackContent({
      species: [OAK, PALM],
      densityRules: [FOREST_TREES, BEACH_PALMS],
    });
    const sp = getActiveVegetationSpecies();
    expect(sp.size).toBe(2);
    expect(sp.get("oak")?.name).toBe("Oak");
    expect(sp.get("palm")?.name).toBe("Palm");
    const rules = getActiveVegetationDensityRules();
    expect(rules.size).toBe(2);
    expect(rules.get("forest-trees")?.density).toBe(0.05);
  });

  it("getDensityRulesForBiome filters by biomeId", () => {
    setVegetationPackContent({
      species: [],
      densityRules: [FOREST_TREES, BEACH_PALMS],
    });
    const forest = getDensityRulesForBiome("forest");
    expect(forest).toHaveLength(1);
    expect(forest[0]!.id).toBe("forest-trees");
    const beach = getDensityRulesForBiome("beach");
    expect(beach).toHaveLength(1);
    expect(beach[0]!.id).toBe("beach-palms");
    const none = getDensityRulesForBiome("tundra");
    expect(none).toHaveLength(0);
  });

  it("re-registration replaces both maps atomically", () => {
    setVegetationPackContent({
      species: [OAK],
      densityRules: [FOREST_TREES],
    });
    setVegetationPackContent({
      species: [PALM],
      densityRules: [BEACH_PALMS],
    });
    const sp = getActiveVegetationSpecies();
    expect(sp.has("oak")).toBe(false);
    expect(sp.has("palm")).toBe(true);
    const rules = getActiveVegetationDensityRules();
    expect(rules.has("forest-trees")).toBe(false);
    expect(rules.has("beach-palms")).toBe(true);
  });

  it("setVegetationPackContent({}) clears both maps", () => {
    setVegetationPackContent({
      species: [OAK],
      densityRules: [FOREST_TREES],
    });
    setVegetationPackContent({ species: [], densityRules: [] });
    expect(getActiveVegetationSpecies().size).toBe(0);
    expect(getActiveVegetationDensityRules().size).toBe(0);
  });

  it("last-pack-wins on species id collision", () => {
    const oakV2: VegetationSpecies = {
      ...OAK,
      name: "Oak v2",
      maxSlope: 0.6,
    };
    setVegetationPackContent({
      species: [OAK, oakV2],
      densityRules: [],
    });
    const sp = getActiveVegetationSpecies();
    expect(sp.get("oak")?.name).toBe("Oak v2");
    expect(sp.get("oak")?.maxSlope).toBe(0.6);
  });
});
