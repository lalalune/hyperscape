/**
 * Project schema validation tests.
 *
 * Phase B0'.A. Covers:
 *   - Minimal valid project (blank shape)
 *   - Hyperia-shaped project (with plugin + content)
 *   - Plugin id format enforcement
 *   - Required field rejection
 *   - WorldContent schema integration with WorldAreaNPCSchema
 *   - validateProject() ok/fail return shape
 */

import { describe, expect, it } from "vitest";
import {
  ProjectSchema,
  ProjectPluginIdSchema,
  validateProject,
} from "./project.js";

const minimalBlank = {
  id: "p-blank-1",
  name: "Blank Project",
  schemaVersion: 1 as const,
  config: { seed: 42 },
  plugins: [],
  worldContent: {},
};

const hyperiaShape = {
  id: "p-hyperia-1",
  name: "Hyperia",
  description: "Default game world",
  templateId: "hyperia",
  schemaVersion: 1 as const,
  config: { seed: 0, preset: "large-island", useGamePipeline: true },
  plugins: ["@hyperforge/hyperscape"],
  worldContent: {
    npcs: [
      {
        id: "shopkeeper_01",
        type: "shopkeeper",
        position: { x: 10, y: 0, z: -5 },
      },
    ],
  },
};

describe("ProjectSchema", () => {
  it("accepts a minimal blank project", () => {
    const r = ProjectSchema.safeParse(minimalBlank);
    expect(r.success).toBe(true);
  });

  it("accepts a Hyperia-shaped project", () => {
    const r = ProjectSchema.safeParse(hyperiaShape);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.plugins).toEqual(["@hyperforge/hyperscape"]);
      expect(r.data.worldContent.npcs?.[0]?.id).toBe("shopkeeper_01");
    }
  });

  it("rejects missing schemaVersion", () => {
    const { schemaVersion: _omit, ...incomplete } = minimalBlank;
    const r = ProjectSchema.safeParse(incomplete);
    expect(r.success).toBe(false);
  });

  it("rejects schemaVersion !== 1", () => {
    const r = ProjectSchema.safeParse({ ...minimalBlank, schemaVersion: 2 });
    expect(r.success).toBe(false);
  });

  it("rejects empty id", () => {
    const r = ProjectSchema.safeParse({ ...minimalBlank, id: "" });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", () => {
    const r = ProjectSchema.safeParse({ ...minimalBlank, name: "" });
    expect(r.success).toBe(false);
  });

  it("requires config.seed (numeric)", () => {
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      config: { preset: "x" },
    });
    expect(r.success).toBe(false);
  });

  it("passes through unknown config fields (procgen knobs)", () => {
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      config: {
        seed: 1,
        terrain: { tileSize: 100, worldSize: 100 },
        biomes: { distribution: "uniform" },
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const cfg = r.data.config as {
        terrain?: { tileSize?: number };
        biomes?: { distribution?: string };
      };
      expect(cfg.terrain?.tileSize).toBe(100);
      expect(cfg.biomes?.distribution).toBe("uniform");
    }
  });

  it("rejects malformed plugin id", () => {
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      plugins: ["not a valid id"],
    });
    expect(r.success).toBe(false);
  });

  it("validates worldContent.npcs against WorldAreaNPCSchema", () => {
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      worldContent: {
        // missing required `position`
        npcs: [{ id: "broken", type: "guard" }],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown top-level config keys (D1 hardening)", () => {
    // Agent might hallucinate `terrainStyle` instead of `terrain`.
    // Strict top-level keeps that out.
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      config: {
        seed: 42,
        terrainStyle: "mountainous", // not a real key
      },
    });
    expect(r.success).toBe(false);
  });

  it("accepts known nested sub-config keys (D1 hardening)", () => {
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      config: {
        seed: 42,
        terrain: {
          tileSize: 100,
          worldSize: 100,
          maxHeight: 256,
        },
        biomes: { gridSize: 3, jitter: 0.2 },
        island: { enabled: true, maxWorldSizeTiles: 100 },
        shoreline: { waterLevelNormalized: 0.3 },
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects wrong type on a known nested field (D1 hardening)", () => {
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      config: {
        seed: 42,
        terrain: { tileSize: "100m" }, // string instead of number
      },
    });
    expect(r.success).toBe(false);
  });

  it("passes through unknown nested keys (engine knobs round-trip)", () => {
    // Sub-configs are `passthrough` — engine-only knobs (e.g.
    // `explicitCenters` on biomes) survive without the agent
    // having to understand them.
    const r = ProjectSchema.safeParse({
      ...minimalBlank,
      config: {
        seed: 42,
        biomes: {
          gridSize: 3,
          explicitCenters: [{ x: 0, z: 0, type: "forest", influence: 100 }],
        },
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("ProjectPluginIdSchema", () => {
  it.each([
    "@hyperforge/hyperscape",
    "@hyperforge/plugin-shooter-demo",
    "my-plugin",
    "core",
    "@scope/name.with.dots",
  ])("accepts %s", (id) => {
    expect(ProjectPluginIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["", "has spaces", "$invalid", "."])("rejects %s", (id) => {
    expect(ProjectPluginIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("validateProject()", () => {
  it("returns ok: true with the project on success", () => {
    const r = validateProject(minimalBlank);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.id).toBe("p-blank-1");
  });

  it("returns ok: false with issue path on failure", () => {
    const r = validateProject({ ...minimalBlank, schemaVersion: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.length).toBeGreaterThan(0);
      expect(r.issues[0]?.path).toContain("schemaVersion");
    }
  });

  it("collapses path to (root) when missing top-level field", () => {
    const r = validateProject(null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.path).toBe("(root)");
    }
  });
});
