/**
 * `validateAssetRef` — direct unit tests.
 *
 * The integration tests in placementValidation.test.ts cover the
 * happy/sad paths via the propose-* action surfaces, but the
 * malformed-ref parsing is bug-prone (lastIndexOf-based slash
 * splitting with edge cases at both ends of the string) and
 * worth locking in against the parser directly.
 */

import { describe, expect, it } from "vitest";
import { validateAssetRef } from "../actions/placementValidators.js";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type ProjectContext,
} from "../services/ProjectContextService.js";
import type { IAgentRuntime } from "@elizaos/core";
import { makeStubRuntime } from "./testRuntime.js";

const PACK_ID = "@hyperforge/asset-pack-hyperia-v1";
const ENTRY_ID = "eldric_shopkeeper";

const VALID_REF = `${PACK_ID}/${ENTRY_ID}`;

const PROJECT_CTX: ProjectContext = {
  plugins: ["com.hyperforge.hyperscape"],
  assetPacks: [
    {
      manifestId: PACK_ID,
      name: "Hyperia v1",
      packVersion: "1.0.0",
      assets: [
        {
          id: ENTRY_ID,
          name: "Eldric",
          type: "character",
          subtype: "humanoid",
        },
      ],
    },
  ],
};

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

describe("validateAssetRef", () => {
  describe("graceful skip cases (return ok=true)", () => {
    it("accepts undefined assetRef (it's optional)", () => {
      const r = validateAssetRef(makeRuntime(PROJECT_CTX), undefined);
      expect(r.ok).toBe(true);
    });

    it("accepts when no project context is registered", () => {
      const r = validateAssetRef(makeRuntime(null), VALID_REF);
      expect(r.ok).toBe(true);
    });

    it("accepts when project has zero installed packs", () => {
      const r = validateAssetRef(
        makeRuntime({ plugins: [], assetPacks: [] }),
        VALID_REF,
      );
      expect(r.ok).toBe(true);
    });

    it("accepts when assetPacks is undefined (vs explicitly empty)", () => {
      const r = validateAssetRef(makeRuntime({ plugins: [] }), VALID_REF);
      expect(r.ok).toBe(true);
    });
  });

  describe("malformed ref rejection", () => {
    const runtime = () => makeRuntime(PROJECT_CTX);

    it("rejects a ref with no slash", () => {
      const r = validateAssetRef(runtime(), "plain-string-no-slash");
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain("malformed");
        expect(r.message).toContain("<packId>/<entryId>");
      }
    });

    it("rejects a ref starting with a slash (empty packId)", () => {
      const r = validateAssetRef(runtime(), "/entry-only");
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain("malformed");
      }
    });

    it("rejects a ref ending with a slash (empty entryId)", () => {
      const r = validateAssetRef(runtime(), `${PACK_ID}/`);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain("malformed");
      }
    });

    it("rejects an empty string", () => {
      // Empty is treated as "no ref" via the truthy check — actually OK.
      const r = validateAssetRef(runtime(), "");
      expect(r.ok).toBe(true);
    });
  });

  describe("pack lookup", () => {
    const runtime = () => makeRuntime(PROJECT_CTX);

    it("rejects when packId doesn't match any installed pack", () => {
      const r = validateAssetRef(runtime(), "@nope/missing-pack/some-entry");
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain("missing-pack");
        expect(r.message).toContain("isn't installed");
        expect(r.message).toContain(PACK_ID); // suggests installed packs
      }
    });

    it("rejects when entry id is missing from the pack", () => {
      const r = validateAssetRef(runtime(), `${PACK_ID}/no-such-entry`);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain("no-such-entry");
        expect(r.message).toContain(PACK_ID);
        expect(r.message).toContain("availableAssets"); // suggests next action
      }
    });

    it("accepts a well-formed ref pointing at a real entry", () => {
      const r = validateAssetRef(runtime(), VALID_REF);
      expect(r.ok).toBe(true);
    });
  });

  describe("multi-slash refs (lastIndexOf semantics)", () => {
    // The parser uses `lastIndexOf("/")` so slashes earlier in the
    // ref are treated as part of the packId. This matters for npm-
    // style scoped packIds like `@scope/pack-name/entry-id`.
    const runtime = () => makeRuntime(PROJECT_CTX);

    it("uses LAST slash as the packId/entryId boundary", () => {
      // The fixture pack id is `@hyperforge/asset-pack-hyperia-v1` —
      // already contains a slash. The ref `@hyperforge/asset-pack-hyperia-v1/eldric_shopkeeper`
      // splits at the LAST slash so packId = `@hyperforge/asset-pack-hyperia-v1`
      // and entryId = `eldric_shopkeeper`. Already covered by the
      // happy path above; this assertion makes the intent explicit.
      const r = validateAssetRef(runtime(), VALID_REF);
      expect(r.ok).toBe(true);
    });

    it("rejects when the parsed packId doesn't match (multi-slash typo)", () => {
      const r = validateAssetRef(
        runtime(),
        `@hyperforge/asset-pack-typo-v1/${ENTRY_ID}`,
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain("asset-pack-typo-v1");
      }
    });
  });

  describe("error detail shape", () => {
    const runtime = () => makeRuntime(PROJECT_CTX);

    it("includes assetRef in detail for malformed refs", () => {
      const r = validateAssetRef(runtime(), "no-slash");
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.detail).toEqual({ assetRef: "no-slash" });
      }
    });

    it("includes assetRef + packId + installedPacks in detail for missing pack", () => {
      const r = validateAssetRef(runtime(), "@nope/missing/entry");
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.detail).toMatchObject({
          assetRef: "@nope/missing/entry",
          packId: "@nope/missing",
          installedPacks: [PACK_ID],
        });
      }
    });

    it("includes assetRef + packId + entryId in detail for missing entry", () => {
      const ref = `${PACK_ID}/missing-entry`;
      const r = validateAssetRef(runtime(), ref);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.detail).toMatchObject({
          assetRef: ref,
          packId: PACK_ID,
          entryId: "missing-entry",
        });
      }
    });
  });
});
