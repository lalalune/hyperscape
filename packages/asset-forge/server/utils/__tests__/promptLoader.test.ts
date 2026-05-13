// @vitest-environment node
/**
 * `promptLoader` — JSON prompt-file loader with module-level cache.
 *
 * Loads prompts/*.json off disk for the AI asset-generation pipeline.
 * Tests pin the moving parts that aren't obvious from the types:
 *
 *   1. The kebab→camel key conversion in `loadAllPrompts`
 *      (`gpt5-enhancement-prompts` → `gpt5Enhancement`, etc).
 *   2. The fallback chain in `getGameStylePrompt`
 *      (custom > default > prompts.default.generic > "game-ready").
 *   3. The 4-way lookup in `getAssetTypePrompt`
 *      (avatar.custom > avatar.default > item.custom > item.default).
 *   4. The module-level `promptCache` — load is cached, save updates
 *      the cache, `clearPromptCache` resets it.
 *   5. Error paths return null / false / {} instead of throwing.
 *
 * `fs/promises` is mocked so the tests don't touch the real
 * public/prompts/*.json files (savePromptFile would overwrite them).
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

import fs from "fs/promises";
import {
  clearPromptCache,
  getAssetTypePrompt,
  getGPT5EnhancementPrompts,
  getGameStylePrompt,
  getGenerationPrompts,
  getMaterialPromptTemplate,
  getWeaponDetectionPrompts,
  loadAllPrompts,
  loadPromptFile,
  savePromptFile,
  type AssetTypePrompts,
  type GameStylePrompts,
  type GenerationPrompts,
  type GPT5EnhancementPrompts,
  type MaterialPrompts,
  type WeaponDetectionPrompts,
} from "../promptLoader";

const mockedRead = fs.readFile as unknown as Mock;
const mockedWrite = fs.writeFile as unknown as Mock;

// Silence the console.error calls the loader makes on file-read failure.
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearPromptCache();
  mockedRead.mockReset();
  mockedWrite.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

// ----- fixtures --------------------------------------------------------------

const gameStyleFixture: GameStylePrompts = {
  version: "1.0.0",
  default: {
    generic: { name: "Generic", base: "GENERIC_BASE", enhanced: "GENERIC_ENH" },
    pixelart: { name: "Pixel", base: "PIXEL_BASE" },
  },
  custom: {
    pixelart: { name: "Pixel Custom", base: "PIXEL_CUSTOM_BASE" },
  },
};

const assetTypeFixture: AssetTypePrompts = {
  version: "1.0.0",
  avatar: {
    default: {
      humanoid: { name: "Humanoid", prompt: "AVATAR_DEFAULT", placeholder: "" },
    },
    custom: {
      humanoid: {
        name: "Humanoid C",
        prompt: "AVATAR_CUSTOM",
        placeholder: "",
      },
    },
  },
  item: {
    default: {
      sword: { name: "Sword", prompt: "ITEM_DEFAULT", placeholder: "" },
    },
    custom: {
      bow: { name: "Bow", prompt: "ITEM_CUSTOM", placeholder: "" },
    },
  },
};

const materialFixture: MaterialPrompts = {
  version: "1.0.0",
  templates: {
    generic: "GENERIC_TEMPLATE ${materialId}",
    stylized: "STYLIZED_TEMPLATE ${materialId}",
  },
  customOverrides: {},
};

const generationFixture: GenerationPrompts = {
  version: "1.0.0",
  imageGeneration: { base: "BASE_IMG", fallbackEnhancement: "FALLBACK_IMG" },
  posePrompts: {
    avatar: { tpose: "T_POSE" },
    armor: { chest: "CHEST", generic: "GENERIC_ARMOR" },
  },
};

const gpt5Fixture: GPT5EnhancementPrompts = {
  version: "1.0.0",
  systemPrompt: { base: "SYS", focusPoints: ["a"], closingInstruction: "CI" },
  typeSpecific: {
    avatar: { critical: "C", focus: "F" },
    armor: {
      base: "B",
      chest: "CC",
      positioning: "P",
      enhancementPrefix: "EP",
      focus: ["x"],
    },
  },
};

const weaponFixture: WeaponDetectionPrompts = {
  version: "1.0.0",
  basePrompt: "BASE_W",
  additionalGuidance: "AG",
  restrictions: "R",
  responseFormat: "RF",
};

/**
 * Build a readFile mock that routes by the filename in the requested path.
 * Any unspecified prompt-type rejects so we surface accidental loads.
 */
function routeReadByFilename(routes: Partial<Record<string, unknown>>): void {
  mockedRead.mockImplementation(async (p: string) => {
    for (const [needle, payload] of Object.entries(routes)) {
      if (p.includes(needle)) return JSON.stringify(payload);
    }
    throw new Error(`unexpected read: ${p}`);
  });
}

// ----- loadPromptFile --------------------------------------------------------

describe("loadPromptFile — happy path + caching", () => {
  it("parses the JSON file and returns the typed payload", async () => {
    routeReadByFilename({ "game-style-prompts.json": gameStyleFixture });
    const result = await loadPromptFile("game-style-prompts");
    expect(result).toEqual(gameStyleFixture);
  });

  it("caches: a second call does NOT re-read the file", async () => {
    routeReadByFilename({ "game-style-prompts.json": gameStyleFixture });
    await loadPromptFile("game-style-prompts");
    await loadPromptFile("game-style-prompts");
    expect(mockedRead).toHaveBeenCalledTimes(1);
  });

  it("uses the prompt-type name in the resolved path", async () => {
    routeReadByFilename({ "asset-type-prompts.json": assetTypeFixture });
    await loadPromptFile("asset-type-prompts");
    const callPath = mockedRead.mock.calls[0][0] as string;
    expect(callPath).toContain("asset-type-prompts.json");
    expect(callPath).toContain("public/prompts");
  });
});

describe("loadPromptFile — error handling", () => {
  it("returns null when the file is missing", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await loadPromptFile("material-prompts");
    expect(result).toBeNull();
  });

  it("returns null when JSON is malformed", async () => {
    mockedRead.mockResolvedValueOnce("{ not json");
    const result = await loadPromptFile("material-prompts");
    expect(result).toBeNull();
  });

  it("does NOT cache a failed load (a later success works)", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await loadPromptFile("material-prompts")).toBeNull();

    mockedRead.mockResolvedValueOnce(JSON.stringify(materialFixture));
    expect(await loadPromptFile("material-prompts")).toEqual(materialFixture);
  });
});

// ----- savePromptFile -------------------------------------------------------

describe("savePromptFile", () => {
  it("writes the JSON-stringified payload to the correct path", async () => {
    mockedWrite.mockResolvedValueOnce(undefined);
    const ok = await savePromptFile("material-prompts", materialFixture);
    expect(ok).toBe(true);
    const [callPath, body] = mockedWrite.mock.calls[0];
    expect(callPath).toContain("material-prompts.json");
    expect(JSON.parse(body as string)).toEqual(materialFixture);
  });

  it("updates the cache so a later loadPromptFile returns the saved data without reading", async () => {
    mockedWrite.mockResolvedValueOnce(undefined);
    await savePromptFile("material-prompts", materialFixture);
    const loaded = await loadPromptFile("material-prompts");
    expect(loaded).toEqual(materialFixture);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it("returns false on write failure", async () => {
    mockedWrite.mockRejectedValueOnce(new Error("EACCES"));
    const ok = await savePromptFile("material-prompts", materialFixture);
    expect(ok).toBe(false);
  });
});

// ----- clearPromptCache ------------------------------------------------------

describe("clearPromptCache", () => {
  it("forces a re-read on the next load", async () => {
    routeReadByFilename({ "material-prompts.json": materialFixture });
    await loadPromptFile("material-prompts");
    clearPromptCache();
    await loadPromptFile("material-prompts");
    expect(mockedRead).toHaveBeenCalledTimes(2);
  });
});

// ----- loadAllPrompts --------------------------------------------------------

describe("loadAllPrompts — kebab → camel key conversion", () => {
  it("collects every successfully-loaded type under its camelCase key", async () => {
    routeReadByFilename({
      "game-style-prompts.json": gameStyleFixture,
      "asset-type-prompts.json": assetTypeFixture,
      "material-prompts.json": materialFixture,
      "generation-prompts.json": generationFixture,
      "gpt5-enhancement-prompts.json": gpt5Fixture,
      "weapon-detection-prompts.json": weaponFixture,
    });
    const all = await loadAllPrompts();
    expect(all.gameStyle).toEqual(gameStyleFixture);
    expect(all.assetType).toEqual(assetTypeFixture);
    expect(all.material).toEqual(materialFixture);
    expect(all.generation).toEqual(generationFixture);
    expect(all.gpt5Enhancement).toEqual(gpt5Fixture);
    expect(all.weaponDetection).toEqual(weaponFixture);
  });

  it("skips types whose files fail to load (no key set, no throw)", async () => {
    mockedRead.mockImplementation(async (p: string) => {
      if (p.includes("game-style-prompts.json")) {
        return JSON.stringify(gameStyleFixture);
      }
      throw new Error("ENOENT");
    });
    const all = await loadAllPrompts();
    expect(all.gameStyle).toEqual(gameStyleFixture);
    expect(all.assetType).toBeUndefined();
    expect(all.material).toBeUndefined();
    expect(all.generation).toBeUndefined();
    expect(all.gpt5Enhancement).toBeUndefined();
    expect(all.weaponDetection).toBeUndefined();
  });
});

// ----- getGameStylePrompt — fallback chain ----------------------------------

describe("getGameStylePrompt — custom > default > generic > literal fallback", () => {
  it("prefers custom over default", async () => {
    routeReadByFilename({ "game-style-prompts.json": gameStyleFixture });
    // pixelart exists in both custom and default; custom wins.
    expect(await getGameStylePrompt("pixelart")).toBe("PIXEL_CUSTOM_BASE");
  });

  it("falls back to default when no custom entry exists", async () => {
    routeReadByFilename({ "game-style-prompts.json": gameStyleFixture });
    expect(await getGameStylePrompt("generic")).toBe("GENERIC_BASE");
  });

  it("falls back to prompts.default.generic when style is unknown", async () => {
    routeReadByFilename({ "game-style-prompts.json": gameStyleFixture });
    expect(await getGameStylePrompt("unknown-style")).toBe("GENERIC_BASE");
  });

  it("returns the literal 'game-ready' when the prompt file fails to load", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await getGameStylePrompt("anything")).toBe("game-ready");
  });

  it("prefers `base`, falls back to `enhanced` when base missing", async () => {
    const fix: GameStylePrompts = {
      version: "1.0.0",
      default: {
        // base is missing; enhanced should win.
        eonly: { name: "E", base: "", enhanced: "ENHANCED_ONLY" },
      },
      custom: {},
    };
    routeReadByFilename({ "game-style-prompts.json": fix });
    expect(await getGameStylePrompt("eonly")).toBe("ENHANCED_ONLY");
  });
});

// ----- getAssetTypePrompt — 4-way lookup ------------------------------------

describe("getAssetTypePrompt — avatar.custom > avatar.default > item.custom > item.default", () => {
  it("avatar.custom wins for a key that exists in both avatar tiers", async () => {
    routeReadByFilename({ "asset-type-prompts.json": assetTypeFixture });
    expect(await getAssetTypePrompt("humanoid")).toBe("AVATAR_CUSTOM");
  });

  it("falls through to item.default for an item-only key", async () => {
    routeReadByFilename({ "asset-type-prompts.json": assetTypeFixture });
    expect(await getAssetTypePrompt("sword")).toBe("ITEM_DEFAULT");
  });

  it("falls through to item.custom when only the item-custom tier has the key", async () => {
    routeReadByFilename({ "asset-type-prompts.json": assetTypeFixture });
    expect(await getAssetTypePrompt("bow")).toBe("ITEM_CUSTOM");
  });

  it("returns empty string when the key is missing in all four tiers", async () => {
    routeReadByFilename({ "asset-type-prompts.json": assetTypeFixture });
    expect(await getAssetTypePrompt("nonexistent")).toBe("");
  });

  it("returns empty string when the prompt file fails to load", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await getAssetTypePrompt("humanoid")).toBe("");
  });
});

// ----- getMaterialPromptTemplate --------------------------------------------

describe("getMaterialPromptTemplate", () => {
  it("returns the per-style template when a match exists", async () => {
    routeReadByFilename({ "material-prompts.json": materialFixture });
    expect(await getMaterialPromptTemplate("stylized")).toBe(
      "STYLIZED_TEMPLATE ${materialId}",
    );
  });

  it("falls back to generic when the requested style has no template", async () => {
    routeReadByFilename({ "material-prompts.json": materialFixture });
    expect(await getMaterialPromptTemplate("unknown-style")).toBe(
      "GENERIC_TEMPLATE ${materialId}",
    );
  });

  it("falls back to the literal '${materialId} texture' when generic also missing", async () => {
    const fix: MaterialPrompts = {
      version: "1.0.0",
      templates: {},
      customOverrides: {},
    };
    routeReadByFilename({ "material-prompts.json": fix });
    expect(await getMaterialPromptTemplate("anything")).toBe(
      "${materialId} texture",
    );
  });
});

// ----- getGenerationPrompts -------------------------------------------------

describe("getGenerationPrompts", () => {
  it("returns the loaded payload when the file is present", async () => {
    routeReadByFilename({ "generation-prompts.json": generationFixture });
    const result = await getGenerationPrompts();
    expect(result).toEqual(generationFixture);
  });

  it("returns a baked-in fallback object when the file fails to load", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await getGenerationPrompts();
    // Fallback ships a "1.0.0" version and a `posePrompts.avatar.tpose`.
    expect(result.version).toBe("1.0.0");
    expect(result.posePrompts.avatar.tpose).toContain("T-pose");
    expect(result.imageGeneration.base).toContain("${description}");
  });
});

// ----- getGPT5EnhancementPrompts --------------------------------------------

describe("getGPT5EnhancementPrompts", () => {
  it("returns the loaded payload when present", async () => {
    routeReadByFilename({ "gpt5-enhancement-prompts.json": gpt5Fixture });
    const result = await getGPT5EnhancementPrompts();
    expect(result).toEqual(gpt5Fixture);
  });

  it("returns an empty object when the file is missing", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await getGPT5EnhancementPrompts();
    expect(result).toEqual({});
  });
});

// ----- getWeaponDetectionPrompts --------------------------------------------

describe("getWeaponDetectionPrompts", () => {
  it("returns the loaded payload when present", async () => {
    routeReadByFilename({ "weapon-detection-prompts.json": weaponFixture });
    const result = await getWeaponDetectionPrompts();
    expect(result).toEqual(weaponFixture);
  });

  it("returns an empty object when the file is missing", async () => {
    mockedRead.mockRejectedValueOnce(new Error("ENOENT"));
    const result = await getWeaponDetectionPrompts();
    expect(result).toEqual({});
  });
});
