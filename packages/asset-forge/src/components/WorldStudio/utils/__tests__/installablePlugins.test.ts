/**
 * Tests for `normalizeInstallablePlugin` — the helper that maps
 * `/api/plugins/installed` responses into the DesignWithAIDialog's
 * working shape. Pins the missing-field defaults (collapse to
 * `undefined`, not `[]`) and shallow-clone semantics so a future
 * cut can't silently flatten the contract.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeInstallablePlugin,
  type PluginRegistryEntry,
} from "../installablePlugins";

function baseEntry(): PluginRegistryEntry {
  return {
    id: "@hyperforge/hyperscape",
    npmName: "@hyperforge/hyperscape",
    name: "Hyperia",
    description: "The Hyperia gameplay plugin.",
    tags: ["combat", "skills"],
  };
}

describe("normalizeInstallablePlugin", () => {
  it("copies the top-level identity + description fields verbatim", () => {
    const result = normalizeInstallablePlugin(baseEntry());
    expect(result.id).toBe("@hyperforge/hyperscape");
    expect(result.npmName).toBe("@hyperforge/hyperscape");
    expect(result.name).toBe("Hyperia");
    expect(result.description).toBe("The Hyperia gameplay plugin.");
  });

  it("shallow-clones the tags array so callers can't mutate the source", () => {
    const entry = baseEntry();
    const result = normalizeInstallablePlugin(entry);
    expect(result.tags).toEqual(["combat", "skills"]);
    expect(result.tags).not.toBe(entry.tags);

    result.tags.push("rpg");
    expect(entry.tags).toEqual(["combat", "skills"]);
  });

  it("collapses missing contributions to undefined (not empty arrays)", () => {
    const result = normalizeInstallablePlugin(baseEntry());
    expect(result.entityTypeContributions).toBeUndefined();
    expect(result.commandContributions).toBeUndefined();
    expect(result.systemContributions).toBeUndefined();
    expect(result.entityContributions).toBeUndefined();
    expect(result.widgetContributions).toBeUndefined();
    expect(result.manifestSchemaContributions).toBeUndefined();
    expect(result.paletteCategoryContributions).toBeUndefined();
    expect(result.toolbarToolContributions).toBeUndefined();
  });

  it("clones a present empty contribution list to a new empty array (not undefined)", () => {
    // Distinguishes "plugin declared an empty command list" from
    // "plugin didn't declare commands at all". Both produce
    // empty observable behavior but the agent context branches
    // on the presence/absence.
    const result = normalizeInstallablePlugin({
      ...baseEntry(),
      contributions: { commands: [] },
    });
    expect(result.commandContributions).toEqual([]);
    expect(result.commandContributions).not.toBeUndefined();
  });

  it("shallow-clones each contribution string array", () => {
    const commands = ["take", "give"];
    const result = normalizeInstallablePlugin({
      ...baseEntry(),
      contributions: { commands },
    });
    expect(result.commandContributions).toEqual(commands);
    expect(result.commandContributions).not.toBe(commands);
  });

  it("deep-clones entityType contributions (nested arrays cloned too)", () => {
    const requiredFields = ["name", "position"];
    const acceptedAssetTypes = ["vrm"];
    const result = normalizeInstallablePlugin({
      ...baseEntry(),
      contributions: {
        entityTypes: [
          {
            kind: "npc",
            type: "merchant",
            description: "A shopkeeper",
            requiredFields,
            acceptedAssetTypes,
          },
        ],
      },
    });
    const first = result.entityTypeContributions?.[0]!;
    expect(first.kind).toBe("npc");
    expect(first.type).toBe("merchant");
    expect(first.requiredFields).toEqual(["name", "position"]);
    expect(first.requiredFields).not.toBe(requiredFields);
    expect(first.acceptedAssetTypes).toEqual(["vrm"]);
    expect(first.acceptedAssetTypes).not.toBe(acceptedAssetTypes);
  });

  it("maps all six string-array contribution kinds + toolbar tools", () => {
    const result = normalizeInstallablePlugin({
      ...baseEntry(),
      contributions: {
        commands: ["c1"],
        systems: ["s1"],
        entities: ["e1"],
        widgets: ["w1"],
        manifestSchemas: ["m1"],
        paletteCategories: ["p1"],
        toolbarTools: ["t1"],
      },
    });
    expect(result.commandContributions).toEqual(["c1"]);
    expect(result.systemContributions).toEqual(["s1"]);
    expect(result.entityContributions).toEqual(["e1"]);
    expect(result.widgetContributions).toEqual(["w1"]);
    expect(result.manifestSchemaContributions).toEqual(["m1"]);
    expect(result.paletteCategoryContributions).toEqual(["p1"]);
    expect(result.toolbarToolContributions).toEqual(["t1"]);
  });

  it("preserves npmName=null (unscoped plugins)", () => {
    const result = normalizeInstallablePlugin({
      ...baseEntry(),
      npmName: null,
    });
    expect(result.npmName).toBeNull();
  });
});
