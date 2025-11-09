import { apiFetch } from "@/utils/api";

export interface GameStylePrompt {
  id?: string;
  name: string;
  base: string;
  enhanced?: string;
  generation?: string;
  fallback?: string;
}

export interface AssetTypePrompt {
  name: string;
  prompt: string;
  placeholder?: string;
}

export interface AssetTypePromptsByCategory {
  avatar: {
    default: Record<string, AssetTypePrompt>;
    custom: Record<string, AssetTypePrompt>;
  };
  item: {
    default: Record<string, AssetTypePrompt>;
    custom: Record<string, AssetTypePrompt>;
  };
}

export interface PromptsResponse<T> {
  version: string;
  default: T;
  custom: T;
}

export type MaterialPromptTemplate = {
  templates: { runescape: string; generic: string } & Record<string, string>;
  customOverrides: Record<string, string>;
};

class PromptServiceClass {
  private baseUrl = "/api/prompts";

  async getGameStylePrompts(): Promise<
    PromptsResponse<Record<string, GameStylePrompt>>
  > {
    const response = await apiFetch(`${this.baseUrl}/game-styles`, {
      timeoutMs: 10000,
    });
    if (!response.ok) throw new Error("Failed to load game style prompts");
    return response.json();
  }

  async saveGameStylePrompts(
    prompts: PromptsResponse<Record<string, GameStylePrompt>>,
  ): Promise<void> {
    const response = await apiFetch(`${this.baseUrl}/game-styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prompts),
      timeoutMs: 10000,
    });
    if (!response.ok) throw new Error("Failed to save game style prompts");
  }

  async deleteGameStyle(styleId: string): Promise<boolean> {
    try {
      const response = await apiFetch(
        `${this.baseUrl}/game-styles/${styleId}`,
        { method: "DELETE", timeoutMs: 8000 },
      );
      return response.ok;
    } catch (error) {
      console.error("Error deleting game style:", error);
      return false;
    }
  }

  async getAssetTypePrompts(): Promise<AssetTypePromptsByCategory> {
    const response = await apiFetch(`${this.baseUrl}/asset-types`, {
      timeoutMs: 10000,
    });
    if (!response.ok) throw new Error("Failed to load asset type prompts");
    return response.json();
  }

  async saveAssetTypePrompts(
    prompts: AssetTypePromptsByCategory,
  ): Promise<void> {
    const response = await apiFetch(`${this.baseUrl}/asset-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prompts),
      timeoutMs: 10000,
    });
    if (!response.ok) throw new Error("Failed to save asset type prompts");
  }

  async deleteAssetType(
    typeId: string,
    category: "avatar" | "item",
  ): Promise<boolean> {
    try {
      const response = await apiFetch(
        `${this.baseUrl}/asset-types/${typeId}?category=${category}`,
        { method: "DELETE", timeoutMs: 8000 },
      );
      return response.ok;
    } catch (error) {
      console.error("Error deleting asset type:", error);
      return false;
    }
  }

  async getMaterialPrompts(): Promise<MaterialPromptTemplate> {
    const response = await apiFetch(`${this.baseUrl}/materials`, {
      timeoutMs: 10000,
    });
    if (!response.ok) throw new Error("Failed to load material prompts");
    const data = await response.json();
    // Ensure required keys exist for consumers expecting defaults
    const templates = {
      runescape:
        data.templates?.runescape ??
        "${materialId} texture, low-poly RuneScape style",
      generic: data.templates?.generic ?? "${materialId} texture",
      ...data.templates,
    };
    return { templates, customOverrides: data.customOverrides ?? {} };
  }

  async saveMaterialPrompts(prompts: MaterialPromptTemplate): Promise<void> {
    const response = await apiFetch(`${this.baseUrl}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prompts),
      timeoutMs: 10000,
    });
    if (!response.ok) throw new Error("Failed to save material prompts");
  }

  mergePrompts<T extends Record<string, unknown>>(defaults: T, custom: T): T {
    return { ...defaults, ...custom };
  }
}

export const PromptService = new PromptServiceClass();
