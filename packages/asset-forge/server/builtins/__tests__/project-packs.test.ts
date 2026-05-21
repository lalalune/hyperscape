/**
 * `BUILTIN_PROJECT_PACKS` — catalog contract tests + cross-
 * referential integrity vs BUILTIN_CONTENT_PACKS.
 *
 * Project packs bundle plugins + content packs + (future)
 * initial config + world content into a single forkable
 * manifest. The `ProjectPackService.fork(packId)` action reads
 * these manifests; a regression in the catalog (a renamed
 * referenced content pack id, a missing pluginId, an empty
 * dependency list) would silently break the "Fork Hyperia"
 * one-click new-project flow.
 *
 * Tests cover the catalog shape AND the dependency graph: every
 * `contentPackIds[]` entry must either be a real entry in
 * BUILTIN_CONTENT_PACKS or a known asset-pack manifest id (the
 * project pack's `contentPackIds` is loose enough to include
 * both kinds).
 */

import { describe, expect, it } from "vitest";
import { BUILTIN_CONTENT_PACKS } from "../content-packs.js";
import { BUILTIN_PROJECT_PACKS } from "../project-packs.js";

const HYPERIA_PROJECT_PACK_ID = "@hyperforge/project-pack-hyperia-v1";
const ARCTIC_SURVIVAL_PROJECT_PACK_ID =
  "@hyperforge/project-pack-arctic-survival-v1";

describe("BUILTIN_PROJECT_PACKS — top-level contract", () => {
  it("ships the canonical Hyperia + arctic-survival project packs", () => {
    const ids = BUILTIN_PROJECT_PACKS.map((p) => p.manifestId);
    expect(ids).toEqual([
      HYPERIA_PROJECT_PACK_ID,
      ARCTIC_SURVIVAL_PROJECT_PACK_ID,
    ]);
  });

  it("the array is frozen — production-safety guarantee", () => {
    expect(Object.isFrozen(BUILTIN_PROJECT_PACKS)).toBe(true);
  });

  it("every project pack has id/name/description/packVersion populated", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      expect(pack.manifestId.length).toBeGreaterThan(0);
      expect(pack.name.length).toBeGreaterThan(0);
      expect(pack.description.length).toBeGreaterThan(0);
      expect(pack.packVersion).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it("manifest ids follow the `@hyperforge/project-pack-X-v1` convention", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      expect(pack.manifestId).toMatch(
        /^@hyperforge\/project-pack-[a-z][a-z-]*-v\d+$/,
      );
    }
  });

  it("every project pack has at least one tag", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      expect(pack.tags.length).toBeGreaterThan(0);
    }
  });

  it("every project pack has the 'built-in' tag for catalog filtering", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      expect(pack.tags).toContain("built-in");
    }
  });
});

describe("BUILTIN_PROJECT_PACKS — bundle requirements", () => {
  it("every project pack declares at least one pluginId", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      expect(pack.pluginIds.length).toBeGreaterThan(0);
    }
  });

  it("every project pack declares at least one contentPackId", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      expect(pack.contentPackIds.length).toBeGreaterThan(0);
    }
  });

  it("pluginIds are well-formed npm-scoped names", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      for (const id of pack.pluginIds) {
        expect(id).toMatch(/^@[a-z0-9-]+\/[a-z0-9-]+$/);
      }
    }
  });

  it("contentPackIds are well-formed manifest id strings", () => {
    for (const pack of BUILTIN_PROJECT_PACKS) {
      for (const id of pack.contentPackIds) {
        // Either content-pack or asset-pack ids land in this list.
        expect(id).toMatch(
          /^@hyperforge\/(content-pack|asset-pack)-[a-z0-9-]+$/,
        );
      }
    }
  });
});

describe("BUILTIN_PROJECT_PACKS — cross-referential integrity", () => {
  it("Hyperia project pack pulls in a Hyperscape plugin", () => {
    const hyperia = BUILTIN_PROJECT_PACKS.find(
      (p) => p.manifestId === HYPERIA_PROJECT_PACK_ID,
    );
    expect(hyperia).toBeDefined();
    expect(hyperia?.pluginIds).toContain("@hyperforge/hyperscape");
  });

  it("Hyperia project pack pulls in the Hyperia content pack", () => {
    const hyperia = BUILTIN_PROJECT_PACKS.find(
      (p) => p.manifestId === HYPERIA_PROJECT_PACK_ID,
    );
    expect(hyperia).toBeDefined();
    expect(hyperia?.contentPackIds).toContain(
      "@hyperforge/content-pack-hyperia-v1",
    );
  });

  it("every content-pack reference resolves to a real BUILTIN_CONTENT_PACKS entry (or asset pack)", () => {
    const builtinContentIds = new Set(
      BUILTIN_CONTENT_PACKS.map((p) => p.manifestId),
    );
    for (const projectPack of BUILTIN_PROJECT_PACKS) {
      for (const ref of projectPack.contentPackIds) {
        // Asset-pack refs (`@hyperforge/asset-pack-*`) are valid by
        // convention; only content-pack refs need to resolve in our
        // BUILTIN_CONTENT_PACKS catalog.
        if (ref.startsWith("@hyperforge/content-pack-")) {
          expect(
            builtinContentIds.has(ref),
            `Project pack ${projectPack.manifestId} references content pack ${ref} which isn't in BUILTIN_CONTENT_PACKS`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("BUILTIN_PROJECT_PACKS — arctic-survival (Phase 5.1)", () => {
  // The third gameplay plugin shows up as a one-click starter
  // pairing the arctic-survival plugin with the arctic content
  // pack. This block pins the bundle contract so a regression
  // (e.g. dropping the content pack reference) trips before it
  // reaches the studio's project-create dropdown.

  it("bundles arctic-survival plugin + arctic content pack", () => {
    const pack = BUILTIN_PROJECT_PACKS.find(
      (p) => p.manifestId === ARCTIC_SURVIVAL_PROJECT_PACK_ID,
    );
    expect(pack).toBeDefined();
    expect(pack!.pluginIds).toContain("@hyperforge/plugin-arctic-survival");
    expect(pack!.contentPackIds).toContain(
      "@hyperforge/content-pack-arctic-v1",
    );
  });

  it("declares survival + arctic tags so theme filtering finds it", () => {
    const pack = BUILTIN_PROJECT_PACKS.find(
      (p) => p.manifestId === ARCTIC_SURVIVAL_PROJECT_PACK_ID,
    );
    expect(pack).toBeDefined();
    expect(pack!.tags).toContain("arctic");
    expect(pack!.tags).toContain("survival");
    expect(pack!.tags).toContain("starter");
    expect(pack!.tags).toContain("built-in");
  });

  it("description mentions both halves of the bundle (plugin + content)", () => {
    const pack = BUILTIN_PROJECT_PACKS.find(
      (p) => p.manifestId === ARCTIC_SURVIVAL_PROJECT_PACK_ID,
    );
    expect(pack).toBeDefined();
    // Must mention the gameplay surface (frost-blast or
    // temperature gauge) and the world surface (snow or
    // glacier or biomes) so the user understands what they're
    // forking.
    const desc = pack!.description.toLowerCase();
    expect(/frost-blast|temperature gauge/.test(desc)).toBe(true);
    expect(/snow|glacier|biome|arctic content/.test(desc)).toBe(true);
  });

  it("contains NO hyperscape leak in plugin or content lists", () => {
    const pack = BUILTIN_PROJECT_PACKS.find(
      (p) => p.manifestId === ARCTIC_SURVIVAL_PROJECT_PACK_ID,
    );
    expect(pack).toBeDefined();
    expect(pack!.pluginIds).not.toContain("@hyperforge/hyperscape");
    expect(pack!.contentPackIds).not.toContain(
      "@hyperforge/content-pack-hyperia-v1",
    );
  });
});
