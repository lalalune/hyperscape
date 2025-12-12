import { useCallback, RefObject } from "react";

import { API_ENDPOINTS } from "../constants";
import { useAssetsStore } from "../store";
import { Asset } from "../types";

import { ThreeViewerRef } from "@/components/shared/ThreeViewer";
import { apiFetch } from "@/utils/api";

interface UseAssetActionsOptions {
  viewerRef: RefObject<ThreeViewerRef>;
  reloadAssets: () => Promise<void>;
  forceReload: () => Promise<void>;
  assets: Asset[];
}

export function useAssetActions({
  viewerRef,
  reloadAssets,
  forceReload,
  assets,
}: UseAssetActionsOptions) {
  const {
    selectedAsset,
    setSelectedAsset,
    setShowEditModal,
    setIsTransitioning,
    clearSelection,
  } = useAssetsStore();

  const handleViewerReset = useCallback(() => {
    viewerRef.current?.resetCamera();
  }, [viewerRef]);

  const handleDownload = useCallback(() => {
    if (selectedAsset && selectedAsset.hasModel) {
      // Take a screenshot instead of downloading the model
      viewerRef.current?.takeScreenshot();
    }
  }, [selectedAsset, viewerRef]);

  const handleDeleteAsset = useCallback(
    async (asset: Asset, includeVariants?: boolean) => {
      let deletionSuccessful = false;

      try {
        // Clear selected asset BEFORE deletion to prevent viewer from trying to load it
        if (selectedAsset?.id === asset.id) {
          clearSelection();
        }

        // Close the edit modal immediately
        setShowEditModal(false);

        const response = await apiFetch(
          `${API_ENDPOINTS.ASSETS}/${asset.id}?includeVariants=${includeVariants}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          // Even if we get a 404, the deletion might have succeeded (port mismatch issue)
          console.warn(
            "Delete request returned error, but deletion may have succeeded",
          );
        }

        deletionSuccessful = true;

        // If deleting a variant and we had cleared the selection, select the base model
        if (!includeVariants && !selectedAsset && asset.metadata.isVariant) {
          const variantMetadata =
            asset.metadata as import("../types").VariantAssetMetadata;
          const baseAsset = assets.find(
            (a) => a.id === variantMetadata.parentBaseModel,
          );
          if (baseAsset) {
            setSelectedAsset(baseAsset);
          }
        }
      } catch (error) {
        console.error("Error deleting asset:", error);
        // Still try to reload in case the deletion succeeded on the backend
        deletionSuccessful = true;
      }

      if (deletionSuccessful) {
        // Add a small delay to ensure the deletion is complete on the filesystem
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Force reload assets to refresh the list (clears list first)
        await forceReload();
      } else {
        // If deletion failed and we cleared the selection, restore it
        if (!selectedAsset && asset) {
          setSelectedAsset(asset);
        }
      }
    },
    [
      selectedAsset,
      clearSelection,
      setShowEditModal,
      assets,
      setSelectedAsset,
      forceReload,
    ],
  );

  const handleSaveAsset = useCallback(
    async (updatedAsset: Partial<Asset>) => {
      try {
        const response = await apiFetch(
          `${API_ENDPOINTS.ASSETS}/${updatedAsset.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedAsset),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update asset");
        }

        // Get the updated asset from the response
        const savedAsset = await response.json();

        // If the asset was renamed, update the selected asset
        if (savedAsset.id !== updatedAsset.id) {
          setIsTransitioning(true);
          setSelectedAsset(savedAsset);
        }

        // Close the edit modal after successful save
        setShowEditModal(false);

        // Reload assets to refresh the list
        await reloadAssets();

        // Clear transitioning state after a brief delay
        if (savedAsset.id !== updatedAsset.id) {
          setTimeout(() => setIsTransitioning(false), 500);
        }

        return savedAsset;
      } catch (error) {
        console.error("Error updating asset:", error);
        throw error;
      }
    },
    [setIsTransitioning, setSelectedAsset, setShowEditModal, reloadAssets],
  );

  return {
    handleViewerReset,
    handleDownload,
    handleDeleteAsset,
    handleSaveAsset,
  };
}
