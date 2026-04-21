import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

interface WoodcuttingResource {
  id: string;
  modelVariants?: string[];
  depletedModelPath?: string | null;
}

const WORLD_ASSETS_DIR = fileURLToPath(
  new URL("../../../world/assets", import.meta.url),
);
const WOODCUTTING_MANIFEST_PATH = resolve(
  WORLD_ASSETS_DIR,
  "manifests/gathering/woodcutting.json",
);

function assetUriExists(assetUri: string): boolean {
  return existsSync(resolve(WORLD_ASSETS_DIR, assetUri.replace("asset://", "")));
}

describe("woodcutting manifest", () => {
  it("only references packaged resource models", () => {
    const manifest = JSON.parse(
      readFileSync(WOODCUTTING_MANIFEST_PATH, "utf8"),
    ) as { resources?: WoodcuttingResource[] };

    for (const resource of manifest.resources ?? []) {
      for (const modelVariant of resource.modelVariants ?? []) {
        expect(assetUriExists(modelVariant)).toBe(true);
      }
      if (resource.depletedModelPath) {
        expect(assetUriExists(resource.depletedModelPath)).toBe(true);
      }
    }
  });
});
