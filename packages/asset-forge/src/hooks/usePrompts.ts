import { useState, useEffect, useCallback } from "react";

import { useGenerationStore } from "../store";

import {
  PromptService,
  GameStylePrompt,
  AssetTypePrompt,
  AssetTypePromptsByCategory,
  PromptsResponse,
} from "@/services/api/PromptService";

export function useGameStylePrompts() {
  const [prompts, setPrompts] = useState<
    PromptsResponse<Record<string, GameStylePrompt>>
  >({
    version: "1.0.0",
    default: {},
    custom: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    customGamePrompt: _customGamePrompt,
    setCustomGamePrompt: _setCustomGamePrompt,
  } = useGenerationStore();

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setLoading(true);
        const data = await PromptService.getGameStylePrompts();
        setPrompts(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load game style prompts:", err);
        setError("Failed to load game style prompts");
        // Fallback to hardcoded defaults if loading fails
        setPrompts({
          version: "1.0.0",
          default: {
            runescape: {
              name: "RuneScape 2007",
              base: "Low-poly RuneScape 2007",
              enhanced: "low-poly RuneScape style",
              generation: "runescape2007",
            },
            generic: {
              name: "Generic Low-Poly",
              base: "low-poly 3D game asset style",
              fallback: "Low-poly game asset",
            },
          },
          custom: {},
        });
      } finally {
        setLoading(false);
      }
    };
    loadPrompts();
  }, []);

  const saveCustomGameStyle = useCallback(
    async (
      styleId: string,
      style: { name: string; base: string; enhanced?: string },
    ) => {
      try {
        const updatedPrompts = {
          ...prompts,
          custom: {
            ...prompts.custom,
            [styleId]: style,
          },
        };
        await PromptService.saveGameStylePrompts(updatedPrompts);
        setPrompts(updatedPrompts);
        return true;
      } catch (err) {
        console.error("Failed to save custom game style:", err);
        return false;
      }
    },
    [prompts],
  );

  const deleteCustomGameStyle = useCallback(
    async (styleId: string) => {
      try {
        const success = await PromptService.deleteGameStyle(styleId);
        if (success) {
          const { [styleId]: _, ...remainingCustom } = prompts.custom;
          const updatedPrompts = {
            ...prompts,
            custom: remainingCustom,
          };
          setPrompts(updatedPrompts);
          return true;
        }
        return false;
      } catch (err) {
        console.error("Failed to delete custom game style:", err);
        return false;
      }
    },
    [prompts],
  );

  // Get all available styles (default + custom)
  const getAllStyles = useCallback(() => {
    return PromptService.mergePrompts(prompts.default, prompts.custom);
  }, [prompts]);

  return {
    prompts,
    loading,
    error,
    saveCustomGameStyle,
    deleteCustomGameStyle,
    getAllStyles,
  };
}

export function useAssetTypePrompts() {
  const [prompts, setPrompts] = useState<AssetTypePromptsByCategory>({
    avatar: { default: {}, custom: {} },
    item: { default: {}, custom: {} },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { assetTypePrompts, setAssetTypePrompts } = useGenerationStore();

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setLoading(true);
        const data = await PromptService.getAssetTypePrompts();
        setPrompts(data);

        // Update store with loaded prompts - combine both avatar and item types
        const avatarMerged = PromptService.mergePrompts(
          data.avatar.default,
          data.avatar.custom,
        );
        const itemMerged = PromptService.mergePrompts(
          data.item.default,
          data.item.custom,
        );
        const allMerged = { ...avatarMerged, ...itemMerged };

        const promptsMap = Object.entries(allMerged).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value.prompt,
          }),
          {},
        );
        setAssetTypePrompts(promptsMap);

        setError(null);
      } catch (err) {
        console.error("Failed to load asset type prompts:", err);
        setError("Failed to load asset type prompts");
      } finally {
        setLoading(false);
      }
    };
    loadPrompts();
  }, [setAssetTypePrompts]);

  const saveCustomAssetType = useCallback(
    async (
      typeId: string,
      prompt: AssetTypePrompt,
      generationType: "avatar" | "item" = "item",
    ) => {
      try {
        const updatedPrompts = {
          ...prompts,
          [generationType]: {
            ...prompts[generationType],
            custom: {
              ...prompts[generationType].custom,
              [typeId]: prompt,
            },
          },
        };
        await PromptService.saveAssetTypePrompts(updatedPrompts);
        setPrompts(updatedPrompts);

        // Update store
        setAssetTypePrompts({
          ...assetTypePrompts,
          [typeId]: prompt.prompt,
        });

        return true;
      } catch (err) {
        console.error("Failed to save custom asset type:", err);
        return false;
      }
    },
    [prompts, assetTypePrompts, setAssetTypePrompts],
  );

  const deleteCustomAssetType = useCallback(
    async (typeId: string, generationType: "avatar" | "item" = "item") => {
      try {
        const success = await PromptService.deleteAssetType(
          typeId,
          generationType,
        );
        if (success) {
          const { [typeId]: _, ...remainingCustom } =
            prompts[generationType].custom;
          const updatedPrompts = {
            ...prompts,
            [generationType]: {
              ...prompts[generationType],
              custom: remainingCustom,
            },
          };
          setPrompts(updatedPrompts);

          // Update store
          const { [typeId]: __, ...remainingPrompts } = assetTypePrompts;
          setAssetTypePrompts(remainingPrompts);

          return true;
        }
        return false;
      } catch (err) {
        console.error("Failed to delete custom asset type:", err);
        return false;
      }
    },
    [prompts, assetTypePrompts, setAssetTypePrompts],
  );

  // Get all available types (default + custom) for both categories
  const getAllTypes = useCallback(() => {
    const avatarMerged = PromptService.mergePrompts(
      prompts.avatar.default,
      prompts.avatar.custom,
    );
    const itemMerged = PromptService.mergePrompts(
      prompts.item.default,
      prompts.item.custom,
    );
    return { ...avatarMerged, ...itemMerged };
  }, [prompts]);

  // Get types by generation type
  const getTypesByGeneration = useCallback(
    (generationType: "avatar" | "item") => {
      return PromptService.mergePrompts(
        prompts[generationType].default,
        prompts[generationType].custom,
      );
    },
    [prompts],
  );

  return {
    prompts,
    loading,
    error,
    saveCustomAssetType,
    deleteCustomAssetType,
    getAllTypes,
    getTypesByGeneration,
  };
}

// Hook for material prompt templates
export function useMaterialPromptTemplates() {
  const [templates, setTemplates] = useState<{
    templates: { runescape: string; generic: string } & Record<string, string>;
    customOverrides: Record<string, string>;
  }>({
    templates: {
      runescape: "${materialId} texture, low-poly RuneScape style",
      generic: "${materialId} texture",
    },
    customOverrides: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        const data = await PromptService.getMaterialPrompts();
        setTemplates(data);
      } catch (err) {
        console.error("Failed to load material prompt templates:", err);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  const saveCustomOverride = useCallback(
    async (materialId: string, override: string) => {
      try {
        const updated = {
          ...templates,
          customOverrides: {
            ...templates.customOverrides,
            [materialId]: override,
          },
        };
        await PromptService.saveMaterialPrompts(updated);
        setTemplates(updated);
        return true;
      } catch (err) {
        console.error("Failed to save material prompt override:", err);
        return false;
      }
    },
    [templates],
  );

  return {
    templates,
    loading,
    saveCustomOverride,
  };
}
