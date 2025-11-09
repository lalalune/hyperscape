/**
 * Asset Hooks
 * Clean, reusable hooks for asset operations
 */

import { useState, useEffect, useCallback } from "react";

import { useApp } from "../contexts/AppContext";

import {
  AssetService,
  Asset,
  MaterialPreset,
  RetextureRequest,
  RetextureResponse,
} from "@/services/api/AssetService";

export const useAssets = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useApp();

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AssetService.listAssets();
      setAssets(data);
    } catch (_err) {
      showNotification(
        _err instanceof Error ? _err.message : "Failed to load assets",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const forceReload = useCallback(async () => {
    // Clear assets first to ensure UI updates
    setAssets([]);
    await fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  return {
    assets,
    loading,
    reloadAssets: fetchAssets,
    forceReload,
  };
};

export const useMaterialPresets = () => {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useApp();

  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AssetService.getMaterialPresets();
      setPresets(data);
    } catch {
      showNotification("Failed to load material presets", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  return {
    presets,
    loading,
    refetch: fetchPresets,
  };
};

export const useRetexturing = () => {
  const [isRetexturing, setIsRetexturing] = useState(false);
  const { showNotification } = useApp();

  const retextureAsset = useCallback(
    async (request: RetextureRequest): Promise<RetextureResponse | null> => {
      setIsRetexturing(true);
      try {
        const result = await AssetService.retexture(request);
        showNotification(
          result.message || "Asset retextured successfully",
          "success",
        );
        return result;
      } catch (err) {
        showNotification(
          err instanceof Error ? err.message : "Retexturing failed",
          "error",
        );
        return null;
      } finally {
        setIsRetexturing(false);
      }
    },
    [showNotification],
  );

  return {
    retextureAsset,
    isRetexturing,
  };
};
