import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type definitions for prompt structures
export interface GameStylePromptDetail {
  name: string;
  base: string;
  enhanced?: string;
  generation?: string;
  fallback?: string;
}

export interface GameStylePrompts {
  __comment?: string;
  version: string;
  default: Record<string, GameStylePromptDetail>;
  custom: Record<string, GameStylePromptDetail>;
}

export interface AssetTypePromptDetail {
  name: string;
  prompt: string;
  placeholder: string;
}

export interface AssetTypePrompts {
  __comment?: string;
  version: string;
  avatar: {
    default: Record<string, AssetTypePromptDetail>;
    custom: Record<string, AssetTypePromptDetail>;
  };
  item: {
    default: Record<string, AssetTypePromptDetail>;
    custom: Record<string, AssetTypePromptDetail>;
  };
}

export interface MaterialPrompts {
  __comment?: string;
  version: string;
  templates: Record<string, string>;
  customOverrides: Record<string, string>;
}

export interface GenerationPrompts {
  __comment?: string;
  version: string;
  imageGeneration: {
    base: string;
    fallbackEnhancement: string;
  };
  posePrompts: {
    avatar: {
      tpose: string;
    };
    armor: {
      chest: string;
      generic: string;
    };
  };
}

export interface GPT4EnhancementPrompts {
  __comment?: string;
  version: string;
  systemPrompt: {
    base: string;
    focusPoints: string[];
    closingInstruction: string;
  };
  typeSpecific: {
    avatar: {
      critical: string;
      focus: string;
    };
    armor: {
      base: string;
      chest: string;
      positioning: string;
      enhancementPrefix: string;
      focus: string[];
    };
  };
}

export interface WeaponDetectionPrompts {
  __comment?: string;
  version: string;
  basePrompt: string;
  additionalGuidance: string;
  restrictions: string;
  responseFormat: string;
}

// Union type for all prompt types
export type PromptData =
  | GameStylePrompts
  | AssetTypePrompts
  | MaterialPrompts
  | GenerationPrompts
  | GPT4EnhancementPrompts
  | WeaponDetectionPrompts;

export type PromptType =
  | "game-style-prompts"
  | "asset-type-prompts"
  | "material-prompts"
  | "generation-prompts"
  | "gpt4-enhancement-prompts"
  | "weapon-detection-prompts";

// Cache for loaded prompts
const promptCache = new Map<PromptType, PromptData>();

export async function loadPromptFile(
  promptType: PromptType,
): Promise<PromptData | null> {
  // Check cache first
  if (promptCache.has(promptType)) {
    return promptCache.get(promptType)!;
  }

  const filePath = path.join(
    __dirname,
    "../../public/prompts",
    `${promptType}.json`,
  );

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content) as PromptData;
    promptCache.set(promptType, data);
    return data;
  } catch (error) {
    console.error(
      `Failed to load prompt file ${promptType}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function savePromptFile(
  promptType: PromptType,
  data: PromptData,
): Promise<boolean> {
  const filePath = path.join(
    __dirname,
    "../../public/prompts",
    `${promptType}.json`,
  );

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    // Update cache
    promptCache.set(promptType, data);
    return true;
  } catch (error) {
    console.error(
      `Failed to save prompt file ${promptType}:`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export interface AllPrompts {
  gameStyle?: GameStylePrompts;
  assetType?: AssetTypePrompts;
  material?: MaterialPrompts;
  generation?: GenerationPrompts;
  gpt4Enhancement?: GPT4EnhancementPrompts;
  weaponDetection?: WeaponDetectionPrompts;
}

export async function loadAllPrompts(): Promise<AllPrompts> {
  const promptTypes: PromptType[] = [
    "game-style-prompts",
    "asset-type-prompts",
    "material-prompts",
    "generation-prompts",
    "gpt4-enhancement-prompts",
    "weapon-detection-prompts",
  ];

  const prompts: AllPrompts = {};

  for (const type of promptTypes) {
    const data = await loadPromptFile(type);
    if (data) {
      // Convert kebab-case to camelCase for easier access
      const key = type
        .replace(/-prompts$/, "")
        .replace(/-(.)/g, (_, char) => char.toUpperCase()) as keyof AllPrompts;

      // Assign with proper typing based on the prompt type
      if (key === "gameStyle" && data) {
        prompts.gameStyle = data as GameStylePrompts;
      } else if (key === "assetType" && data) {
        prompts.assetType = data as AssetTypePrompts;
      } else if (key === "material" && data) {
        prompts.material = data as MaterialPrompts;
      } else if (key === "generation" && data) {
        prompts.generation = data as GenerationPrompts;
      } else if (key === "gpt4Enhancement" && data) {
        prompts.gpt4Enhancement = data as GPT4EnhancementPrompts;
      } else if (key === "weaponDetection" && data) {
        prompts.weaponDetection = data as WeaponDetectionPrompts;
      }
    }
  }

  return prompts;
}

// Helper functions to get specific prompts with fallbacks
export async function getGameStylePrompt(
  style: string = "generic",
): Promise<string> {
  const prompts = (await loadPromptFile(
    "game-style-prompts",
  )) as GameStylePrompts | null;
  if (!prompts) return "game-ready"; // Fallback

  // Check custom first, then default
  const customPrompt = prompts.custom?.[style];
  if (customPrompt)
    return customPrompt.base || customPrompt.enhanced || "game-ready";

  const defaultPrompt = prompts.default?.[style];
  if (defaultPrompt)
    return defaultPrompt.base || defaultPrompt.enhanced || "game-ready";

  // Ultimate fallback
  return prompts.default?.generic?.base || "game-ready";
}

export async function getAssetTypePrompt(assetType: string): Promise<string> {
  const prompts = (await loadPromptFile(
    "asset-type-prompts",
  )) as AssetTypePrompts | null;
  if (!prompts) return ""; // Fallback

  // Check both avatar and item categories
  const customAvatarPrompt = prompts.avatar?.custom?.[assetType];
  if (customAvatarPrompt) return customAvatarPrompt.prompt || "";

  const defaultAvatarPrompt = prompts.avatar?.default?.[assetType];
  if (defaultAvatarPrompt) return defaultAvatarPrompt.prompt || "";

  const customItemPrompt = prompts.item?.custom?.[assetType];
  if (customItemPrompt) return customItemPrompt.prompt || "";

  const defaultItemPrompt = prompts.item?.default?.[assetType];
  if (defaultItemPrompt) return defaultItemPrompt.prompt || "";

  return "";
}

export async function getMaterialPromptTemplate(
  gameStyle: string = "generic",
): Promise<string> {
  const prompts = (await loadPromptFile(
    "material-prompts",
  )) as MaterialPrompts | null;
  if (!prompts) {
    // Fallback templates
    return gameStyle === "runescape"
      ? "${materialId} texture, low-poly RuneScape style"
      : "${materialId} texture";
  }

  return (
    prompts.templates?.[gameStyle] ||
    prompts.templates?.generic ||
    "${materialId} texture"
  );
}

export async function getGenerationPrompts(): Promise<GenerationPrompts> {
  const prompts = (await loadPromptFile(
    "generation-prompts",
  )) as GenerationPrompts | null;
  if (!prompts) {
    // Fallback prompts
    return {
      version: "1.0.0",
      imageGeneration: {
        base: '${description}. ${style || "game-ready"} style, ${assetType}, clean geometry suitable for 3D conversion.',
        fallbackEnhancement:
          '${config.description}. ${config.style || "game-ready"} style, clean geometry, game-ready 3D asset.',
      },
      posePrompts: {
        avatar: {
          tpose: "standing in T-pose with arms stretched out horizontally",
        },
        armor: {
          chest: "floating chest armor SHAPED FOR T-POSE BODY...",
          generic: "floating armor piece shaped for T-pose body fitting...",
        },
      },
    };
  }

  return prompts;
}

export async function getGPT4EnhancementPrompts(): Promise<
  GPT4EnhancementPrompts | Record<string, never>
> {
  const prompts = (await loadPromptFile(
    "gpt4-enhancement-prompts",
  )) as GPT4EnhancementPrompts | null;
  return prompts || {}; // Return empty object if not found
}

export async function getWeaponDetectionPrompts(): Promise<
  WeaponDetectionPrompts | Record<string, never>
> {
  const prompts = (await loadPromptFile(
    "weapon-detection-prompts",
  )) as WeaponDetectionPrompts | null;
  return prompts || {}; // Return empty object if not found
}

// Clear cache function for development
export function clearPromptCache(): void {
  promptCache.clear();
}
