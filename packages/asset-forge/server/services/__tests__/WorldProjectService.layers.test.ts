/**
 * WorldProjectService — typed-layer decoding tests.
 *
 * Phase B0'.A of `PLAN_PROJECT_AS_DATA.md`. The service migrated
 * from an opaque `worldData` jsonb blob to typed `config / plugins
 * / worldContent / templateId` columns. Read-fallback decoding
 * lives in `decodeProjectLayers()` so rows that predate the
 * `0007_project_typed_layers` migration's backfill still surface a
 * coherent project shape.
 *
 * These tests cover the pure decode + synth helpers without
 * touching the DB.
 */

import { describe, expect, it } from "vitest";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  decodeProjectLayers,
  mergeWorldContent,
  resolveLayersFromCreateInput,
  synthLegacyBlob,
} from "../projectLayers.js";
import type { WorldProject } from "../../db/schema/index.js";

function row(overrides: Partial<WorldProject>): WorldProject {
  return {
    id: "p-1",
    teamId: "t-1",
    gameId: "g-1",
    name: "Test",
    description: null,
    version: 1,
    createdBy: null,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    config: null,
    plugins: [],
    worldContent: {},
    templateId: null,
    worldData: {},
    manifestSnapshot: null,
    lockedBy: null,
    lockedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorldProject;
}

describe("decodeProjectLayers — typed columns populated", () => {
  it("returns the typed columns when templateId is set", () => {
    const r = row({
      templateId: "blank",
      config: { seed: 42 },
      plugins: ["@hyperforge/hyperscape"],
      worldContent: { npcs: [] },
    });
    const layers = decodeProjectLayers(r);
    expect(layers.templateId).toBe("blank");
    expect(layers.config).toEqual({ seed: 42 });
    expect(layers.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(layers.worldContent).toEqual({ npcs: [] });
    expect(layers.schemaVersion).toBe(1);
  });

  it("returns the typed columns when only config is set", () => {
    const r = row({ config: { seed: 7 } });
    const layers = decodeProjectLayers(r);
    expect(layers.config).toEqual({ seed: 7 });
    expect(layers.templateId).toBeNull();
  });
});

describe("decodeProjectLayers — read-fallback from legacy worldData", () => {
  it("decodes a placeholder row to Hyperia template", () => {
    const r = row({
      templateId: null,
      config: null,
      worldData: { _placeholder: true },
    });
    const layers = decodeProjectLayers(r);
    expect(layers.templateId).toBe("hyperia");
    expect(layers.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(layers.config).toBeNull();
    expect(layers.worldContent).toEqual({});
  });

  it("decodes a real worldData row to blank template, preserving config", () => {
    const r = row({
      templateId: null,
      config: null,
      worldData: { config: { seed: 123, preset: "small-island" } },
    });
    const layers = decodeProjectLayers(r);
    expect(layers.templateId).toBe("blank");
    expect(layers.plugins).toEqual([]);
    expect(layers.config).toEqual({ seed: 123, preset: "small-island" });
  });

  it("decodes a worldData row with no config to blank template + null config", () => {
    const r = row({
      templateId: null,
      config: null,
      worldData: { otherField: "irrelevant" },
    });
    const layers = decodeProjectLayers(r);
    expect(layers.templateId).toBe("blank");
    expect(layers.config).toBeNull();
  });

  it("decodes a fully empty row to blank template", () => {
    const r = row({
      templateId: null,
      config: null,
      worldData: {},
    });
    const layers = decodeProjectLayers(r);
    expect(layers.templateId).toBe("blank");
    expect(layers.config).toBeNull();
    expect(layers.plugins).toEqual([]);
    expect(layers.worldContent).toEqual({});
  });
});

describe("decodeProjectLayers — schema version surface", () => {
  it("surfaces the row's schema version when typed columns populated", () => {
    const r = row({
      templateId: "blank",
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    });
    expect(decodeProjectLayers(r).schemaVersion).toBe(
      CURRENT_PROJECT_SCHEMA_VERSION,
    );
  });

  it("defaults to v1 on the read-fallback path", () => {
    const r = row({
      templateId: null,
      config: null,
      worldData: { _placeholder: true },
    });
    expect(decodeProjectLayers(r).schemaVersion).toBe(1);
  });
});

describe("resolveLayersFromCreateInput", () => {
  it("returns blank shape when nothing is supplied", () => {
    const layers = resolveLayersFromCreateInput({});
    expect(layers.templateId).toBe("blank");
    expect(layers.plugins).toEqual([]);
    expect(layers.worldContent).toEqual({});
    expect(layers.config).toBeNull();
    expect(layers.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
  });

  it("uses typed input when supplied", () => {
    const layers = resolveLayersFromCreateInput({
      config: { seed: 5 },
      plugins: ["@hyperforge/hyperscape"],
      templateId: "custom",
    });
    expect(layers.templateId).toBe("custom");
    expect(layers.plugins).toEqual(["@hyperforge/hyperscape"]);
    expect(layers.config).toEqual({ seed: 5 });
  });

  it("defaults templateId to blank when typed input omits it", () => {
    const layers = resolveLayersFromCreateInput({ config: { seed: 1 } });
    expect(layers.templateId).toBe("blank");
  });

  it("decodes legacy worldData placeholder to Hyperia layers", () => {
    const layers = resolveLayersFromCreateInput({
      worldData: { _placeholder: true },
    });
    expect(layers.templateId).toBe("hyperia");
    expect(layers.plugins).toEqual(["@hyperforge/hyperscape"]);
  });

  it("decodes legacy worldData with config to blank layers", () => {
    const layers = resolveLayersFromCreateInput({
      worldData: { config: { seed: 99, preset: "atoll" } },
    });
    expect(layers.templateId).toBe("blank");
    expect(layers.config).toEqual({ seed: 99, preset: "atoll" });
  });

  it("prefers typed input over worldData when both supplied", () => {
    const layers = resolveLayersFromCreateInput({
      worldData: { _placeholder: true },
      templateId: "blank",
      plugins: [],
    });
    expect(layers.templateId).toBe("blank");
    expect(layers.plugins).toEqual([]);
  });
});

describe("synthLegacyBlob", () => {
  it("emits placeholder shape for Hyperia template", () => {
    const blob = synthLegacyBlob({
      schemaVersion: 1,
      config: null,
      plugins: ["@hyperforge/hyperscape"],
      worldContent: {},
      templateId: "hyperia",
    });
    expect(blob).toEqual({ _placeholder: true });
  });

  it("emits config-wrapped shape for non-Hyperia projects with config", () => {
    const blob = synthLegacyBlob({
      schemaVersion: 1,
      config: { seed: 42, preset: "small" },
      plugins: [],
      worldContent: {},
      templateId: "blank",
    });
    expect(blob).toEqual({ config: { seed: 42, preset: "small" } });
  });

  it("emits empty object for blank projects with no config", () => {
    const blob = synthLegacyBlob({
      schemaVersion: 1,
      config: null,
      plugins: [],
      worldContent: {},
      templateId: "blank",
    });
    expect(blob).toEqual({});
  });
});

describe("decode → synth round-trip", () => {
  it("preserves Hyperia placeholder shape end-to-end", () => {
    const r = row({
      templateId: null,
      config: null,
      worldData: { _placeholder: true },
    });
    const decoded = decodeProjectLayers(r);
    const synth = synthLegacyBlob(decoded);
    expect(synth).toEqual({ _placeholder: true });
  });

  it("preserves blank-with-config shape end-to-end", () => {
    const original = { config: { seed: 7 } };
    const r = row({
      templateId: null,
      config: null,
      worldData: original,
    });
    const decoded = decodeProjectLayers(r);
    const synth = synthLegacyBlob(decoded);
    expect(synth).toEqual(original);
  });
});

describe("mergeWorldContent (B0'.G)", () => {
  it("returns the current content when patch is empty", () => {
    const current = { npcs: [{ id: "a" }] };
    const merged = mergeWorldContent(current, {});
    expect(merged).toEqual(current);
  });

  it("overlays new top-level keys", () => {
    const merged = mergeWorldContent({ npcs: [] }, { quests: [{ id: "q1" }] });
    expect(merged).toEqual({ npcs: [], quests: [{ id: "q1" }] });
  });

  it("replaces existing top-level keys wholesale", () => {
    const merged = mergeWorldContent(
      { npcs: [{ id: "old" }] },
      { npcs: [{ id: "new" }] },
    );
    expect(merged).toEqual({ npcs: [{ id: "new" }] });
  });

  it("removes a key when the patch value is null", () => {
    const merged = mergeWorldContent(
      { npcs: [{ id: "a" }], uiPack: { id: "old" } },
      { uiPack: null },
    );
    expect(merged).toEqual({ npcs: [{ id: "a" }] });
    expect("uiPack" in merged).toBe(false);
  });

  it("does not mutate the input objects", () => {
    const current = { npcs: [{ id: "a" }] };
    const patch = { quests: [] };
    mergeWorldContent(current, patch);
    expect(current).toEqual({ npcs: [{ id: "a" }] });
    expect(patch).toEqual({ quests: [] });
  });

  it("handles starting from empty content", () => {
    const merged = mergeWorldContent({}, { npcs: [{ id: "a" }] });
    expect(merged).toEqual({ npcs: [{ id: "a" }] });
  });

  it("handles patches that just delete keys", () => {
    const merged = mergeWorldContent(
      { npcs: [{ id: "a" }], quests: [{ id: "q" }] },
      { quests: null },
    );
    expect(merged).toEqual({ npcs: [{ id: "a" }] });
  });
});
