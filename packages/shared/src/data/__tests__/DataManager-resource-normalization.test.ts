import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type WoodcuttingManifest = {
  trees: Array<{
    id: string;
    modelVariants?: string[];
  }>;
};

function loadWoodcuttingManifest(): WoodcuttingManifest {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(
    __dirname,
    "../../../../server/world/assets/manifests/gathering/woodcutting.json",
  );
  return JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as WoodcuttingManifest;
}

describe("woodcutting manifest asset paths", () => {
  it("uses source-of-truth nested tree model refs without flat runtime aliases", () => {
    const manifest = loadWoodcuttingManifest();
    const modelVariants = manifest.trees.flatMap(
      (tree) => tree.modelVariants ?? [],
    );
    const staleFlatTreeRefs = modelVariants.filter((modelPath) => {
      const prefix = "asset://models/trees/";
      return (
        modelPath.startsWith(prefix) &&
        !modelPath.slice(prefix.length).includes("/")
      );
    });

    expect(staleFlatTreeRefs).toEqual([]);
  });
});
