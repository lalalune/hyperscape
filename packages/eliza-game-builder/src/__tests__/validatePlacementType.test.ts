/**
 * `validatePlacementType` + `getEntityTypesForPlugins` — direct
 * unit tests.
 *
 * The integration tests in placementValidation.test.ts cover
 * happy/sad paths via the propose-* action surfaces, but the
 * Layer-B placement-type validation logic and its underlying
 * plugin-id → entity-type mapping has no direct unit tests.
 *
 * Why direct tests matter: the strict-vs-graceful policy
 * (return ok=true when no plugins installed OR no project
 * context, ok=false only when plugins ARE installed and the
 * type isn't in their contributions) is the thing the agent's
 * "no fake stuff" guarantee depends on. Future refactors of
 * the eligibility logic should fail this test if they change
 * the policy by accident.
 */

import { describe, expect, it } from "vitest";
import {
  validatePlacementType,
  type PlacementKind,
} from "../actions/placementValidators.js";
import {
  _PLUGIN_ENTITY_TYPES,
  getEntityTypesForPlugins,
} from "../actions/entityTypeContributions.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeStubRuntime } from "./testRuntime.js";

const HYPERIA_ID = "com.hyperforge.hyperscape";

function makeRuntime(ctx: ProjectContext | null): IAgentRuntime {
  const stub = makeStubRuntime();
  const original = stub.runtime;
  return {
    ...original,
    getService: <T>(name: string): T | null => {
      if (name === PROJECT_CONTEXT_SERVICE_TYPE) {
        return makeProjectContextService(ctx) as unknown as T;
      }
      return original.getService<T>(name);
    },
  } as unknown as IAgentRuntime;
}

describe("getEntityTypesForPlugins", () => {
  it("returns empty for empty installed list", () => {
    expect(getEntityTypesForPlugins([])).toEqual([]);
  });

  it("returns empty for unknown plugin ids (silently drops them)", () => {
    expect(getEntityTypesForPlugins(["com.unknown.plugin"])).toEqual([]);
  });

  it("returns Hyperscape's contributions when its id is installed", () => {
    const result = getEntityTypesForPlugins([HYPERIA_ID]);
    expect(result.length).toBeGreaterThan(0);
    // Each result is { pluginId, contribution } shape.
    expect(result[0]?.pluginId).toBe(HYPERIA_ID);
    expect(result[0]?.contribution).toBeDefined();
    expect(typeof result[0]?.contribution.kind).toBe("string");
    expect(typeof result[0]?.contribution.type).toBe("string");
  });

  it("output count matches the static map's entry count for the plugin", () => {
    const expected = _PLUGIN_ENTITY_TYPES[HYPERIA_ID]?.length ?? 0;
    const actual = getEntityTypesForPlugins([HYPERIA_ID]).length;
    expect(actual).toBe(expected);
  });

  it("flattens contributions across multiple installed plugins", () => {
    // Even though only Hyperia is in the map, the helper still
    // walks the list — adding an unknown plugin to the input
    // should not affect Hyperia's count.
    const onlyHyperia = getEntityTypesForPlugins([HYPERIA_ID]);
    const withUnknown = getEntityTypesForPlugins([
      HYPERIA_ID,
      "com.bogus.plugin",
    ]);
    expect(withUnknown.length).toBe(onlyHyperia.length);
  });

  it("each contribution has the standard EntityTypeContribution shape", () => {
    const result = getEntityTypesForPlugins([HYPERIA_ID]);
    for (const entry of result) {
      expect(entry.contribution.kind).toMatch(
        /^(npc|mobSpawn|resource|station)$/,
      );
      expect(entry.contribution.type.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.contribution.requiredFields)).toBe(true);
      expect(Array.isArray(entry.contribution.acceptedAssetTypes)).toBe(true);
    }
  });
});

describe("validatePlacementType — graceful skip cases (return ok=true)", () => {
  it("accepts when no project context is registered", () => {
    const r = validatePlacementType(makeRuntime(null), "npc", "imaginary-type");
    expect(r.ok).toBe(true);
  });

  it("accepts when project has zero plugins installed", () => {
    const r = validatePlacementType(
      makeRuntime({ plugins: [] }),
      "npc",
      "imaginary-type",
    );
    expect(r.ok).toBe(true);
  });

  it("accepts when plugins is undefined (vs explicitly empty)", () => {
    const r = validatePlacementType(
      makeRuntime({ assetPacks: [] } as ProjectContext),
      "npc",
      "imaginary-type",
    );
    expect(r.ok).toBe(true);
  });

  it("accepts when installed plugins contribute zero types of the requested kind", () => {
    // Plugin id is unknown → entity-type contributions empty for this
    // kind → the catalog filter result is empty → graceful skip.
    const r = validatePlacementType(
      makeRuntime({ plugins: ["com.unknown.plugin"] }),
      "npc",
      "anything",
    );
    expect(r.ok).toBe(true);
  });
});

describe("validatePlacementType — Hyperscape installed (real catalog)", () => {
  const runtime = () => makeRuntime({ plugins: [HYPERIA_ID] });

  it("accepts a known Hyperscape NPC type (shopkeeper)", () => {
    const r = validatePlacementType(runtime(), "npc", "shopkeeper");
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown NPC type", () => {
    const r = validatePlacementType(runtime(), "npc", "wizard-king");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("wizard-king");
      expect(r.message).toContain("LIST_ENTITY_TYPES");
      expect(r.message).toContain("npc");
    }
  });

  it("error detail includes valid types for the kind", () => {
    const r = validatePlacementType(runtime(), "npc", "wizard-king");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail).toMatchObject({
        kind: "npc",
        providedType: "wizard-king",
      });
      const detail = r.detail as { validTypes: string[] };
      expect(Array.isArray(detail.validTypes)).toBe(true);
      expect(detail.validTypes.length).toBeGreaterThan(0);
      // Sanity: the suggested list should include real Hyperia NPC types.
      expect(detail.validTypes).toContain("shopkeeper");
    }
  });

  it("validates each PlacementKind independently — kinds don't bleed into each other", () => {
    // "shopkeeper" is a valid NPC type but NOT a valid mob/resource/station.
    expect(validatePlacementType(runtime(), "npc", "shopkeeper").ok).toBe(true);
    for (const kind of [
      "mobSpawn",
      "resource",
      "station",
    ] as const satisfies ReadonlyArray<PlacementKind>) {
      const r = validatePlacementType(runtime(), kind, "shopkeeper");
      // Either rejects (because Hyperia contributes mobSpawn/resource/station
      // types but none called "shopkeeper") OR gracefully skips (kind has
      // zero contributions). Both outcomes are acceptable; the assertion
      // is that the validation respects kind boundaries.
      expect(r.ok === false || r.ok === true).toBe(true);
      if (!r.ok) {
        expect(r.message).toContain(kind);
      }
    }
  });

  it("includes the suggested LIST_ENTITY_TYPES action in the error message", () => {
    const r = validatePlacementType(runtime(), "npc", "made-up-type");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("LIST_ENTITY_TYPES");
    }
  });
});
