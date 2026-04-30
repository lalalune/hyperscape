/**
 * Sync test — verifies the agent-side static catalog
 * (`_PLUGIN_ENTITY_TYPES`) matches each known plugin's actual
 * `plugin.json` `contributions.entityTypes`. Drift between the
 * two would mean the agent recommends placements based on a
 * stale view of plugin capabilities.
 *
 * When this test fails, update `entityTypeContributions.ts` to
 * mirror the plugin's authoritative declaration.
 *
 * Today we only check the Hyperscape plugin (the only first-party
 * plugin with declared types). Add more plugin checks as their
 * manifests gain entityTypes.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { _PLUGIN_ENTITY_TYPES } from "../actions/entityTypeContributions.js";

interface ManifestEntityType {
  kind: string;
  type: string;
  description: string;
  requiredFields: string[];
  acceptedAssetTypes: string[];
}

interface PluginJson {
  id: string;
  contributions?: {
    entityTypes?: ManifestEntityType[];
  };
}

function readPluginManifest(relativePath: string): PluginJson {
  // `__dirname` isn't always defined under Vitest module resolution;
  // resolve from `process.cwd()` (the package root) instead.
  const path = resolve(process.cwd(), relativePath);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as PluginJson;
}

describe("entity-type contributions agent ↔ manifest sync", () => {
  it("Hyperscape plugin.json matches _PLUGIN_ENTITY_TYPES catalog", () => {
    const manifest = readPluginManifest("../hyperscape-plugin/plugin.json");
    expect(manifest.id).toBe("com.hyperforge.hyperscape");
    const declared = manifest.contributions?.entityTypes ?? [];
    const mirrored = _PLUGIN_ENTITY_TYPES[manifest.id] ?? [];

    // Same count — no missing or extra entries on either side.
    expect(mirrored.length).toBe(declared.length);

    // Build comparable shapes (sorted by kind+type so order is
    // irrelevant to the test).
    type Sortable = ManifestEntityType;
    const sortKey = (e: Sortable): string => `${e.kind}::${e.type}`;
    const sortedDeclared = [...declared].sort((a, b) =>
      sortKey(a).localeCompare(sortKey(b)),
    );
    const sortedMirrored = [...mirrored].sort((a, b) =>
      sortKey(a as Sortable).localeCompare(sortKey(b as Sortable)),
    );

    for (let i = 0; i < sortedDeclared.length; i++) {
      const d = sortedDeclared[i]!;
      const m = sortedMirrored[i] as ManifestEntityType;
      // Pin every visible field — drift in any one of these
      // means the agent's behavior recommendations diverge from
      // what the plugin actually does.
      expect(m.kind).toBe(d.kind);
      expect(m.type).toBe(d.type);
      expect(m.description).toBe(d.description);
      expect(m.requiredFields).toEqual(d.requiredFields);
      expect(m.acceptedAssetTypes).toEqual(d.acceptedAssetTypes);
    }
  });
});
