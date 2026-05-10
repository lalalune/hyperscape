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

describe("BUILTIN_PROJECT_PACKS — top-level contract", () => {
  it("ships exactly the canonical Hyperia project pack", () => {
    const ids = BUILTIN_PROJECT_PACKS.map((p) => p.manifestId);
    expect(ids).toEqual([HYPERIA_PROJECT_PACK_ID]);
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
        /^@hyperforge\/project-pack-[a-z]+-v\d+$/,
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
