import { Activity, Edit3, Layers } from "lucide-react";
import React, { useRef, useCallback } from "react";

import { API_ENDPOINTS } from "../constants";
import { useAssetsStore } from "../store";

import AssetDetailsPanel from "@/components/Assets/AssetDetailsPanel";
import { AssetEditModal } from "@/components/Assets/AssetEditModal";
import AssetFilters from "@/components/Assets/AssetFilters";
import AssetList from "@/components/Assets/AssetList";
import { EmptyAssetState } from "@/components/Assets/EmptyAssetState";
import { LoadingState } from "@/components/Assets/LoadingState";
import RegenerateModal from "@/components/Assets/RegenerateModal";
import RetextureModal from "@/components/Assets/RetextureModal";
import SpriteGenerationModal from "@/components/Assets/SpriteGenerationModal";
import { TransitionOverlay } from "@/components/Assets/TransitionOverlay";
import ViewerControls from "@/components/Assets/ViewerControls";
import { AnimationPlayer } from "@/components/shared/AnimationPlayer";
import ThreeViewer, { ThreeViewerRef } from "@/components/shared/ThreeViewer";
import { useAssetActions } from "@/hooks";
import { useAssets } from "@/hooks";

export const AssetsPage: React.FC = () => {
  const { assets, loading, reloadAssets, forceReload } = useAssets();

  // Get state and actions from store
  const {
    selectedAsset,
    showGroundPlane,
    isWireframe,
    isLightBackground,
    showRetextureModal,
    showRegenerateModal,
    showDetailsPanel,
    showEditModal,
    showSpriteModal,
    isTransitioning,
    modelInfo,
    showAnimationView,
    setShowRetextureModal,
    setShowRegenerateModal,
    setShowDetailsPanel,
    setShowEditModal,
    setShowSpriteModal,
    setModelInfo,
    toggleDetailsPanel,
    toggleAnimationView,
    getFilteredAssets,
  } = useAssetsStore();

  const viewerRef = useRef<ThreeViewerRef>(null);

  // Use the asset actions hook
  const {
    handleViewerReset,
    handleDownload,
    handleDeleteAsset,
    handleSaveAsset,
  } = useAssetActions({
    viewerRef: viewerRef as React.RefObject<ThreeViewerRef>,
    reloadAssets,
    forceReload,
    assets,
  });

  // Filter assets based on current filters
  const filteredAssets = getFilteredAssets(assets);

  const handleModelLoad = useCallback(
    (info: {
      vertices: number;
      faces: number;
      materials: number;
      fileSize?: number;
    }) => {
      setModelInfo(info);
    },
    [setModelInfo],
  );

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="page-container-no-padding flex-col">
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        {/* Sidebar - Made narrower */}
        <div className="flex flex-col gap-3 w-72 min-w-[18rem] animate-slide-in-left">
          {/* Filters */}
          <AssetFilters
            totalAssets={assets.length}
            filteredCount={filteredAssets.length}
          />

          {/* Asset List */}
          <AssetList assets={filteredAssets} />
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 animate-fade-in">
          <div className="flex-1 relative rounded-xl border border-border-primary shadow-2xl overflow-hidden">
            {selectedAsset ? (
              <>
                <div className="absolute inset-0">
                  {/* Keep both viewers mounted; fade inactive one to preserve layout and canvas size */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-200 ${showAnimationView && selectedAsset.type === "character" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                  >
                    <ThreeViewer
                      ref={viewerRef}
                      modelUrl={
                        selectedAsset.hasModel
                          ? `${API_ENDPOINTS.ASSET_MODEL(selectedAsset.id)}`
                          : undefined
                      }
                      isWireframe={isWireframe}
                      showGroundPlane={showGroundPlane}
                      isLightBackground={isLightBackground}
                      lightMode={true}
                      onModelLoad={handleModelLoad}
                      assetInfo={{
                        name: selectedAsset.name,
                        type: selectedAsset.type,
                        tier: selectedAsset.metadata.tier,
                        format: selectedAsset.metadata.format || "GLB",
                        requiresAnimationStrip:
                          selectedAsset.metadata.requiresAnimationStrip,
                      }}
                    />
                  </div>
                  <div
                    className={`absolute inset-0 transition-opacity duration-200 ${showAnimationView && selectedAsset.type === "character" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  >
                    <AnimationPlayer
                      modelUrl={
                        selectedAsset.hasModel
                          ? `${API_ENDPOINTS.ASSET_MODEL(selectedAsset.id)}`
                          : ""
                      }
                      animations={
                        selectedAsset.metadata?.animations || { basic: {} }
                      }
                      riggedModelPath={
                        selectedAsset.metadata?.riggedModelPath
                          ? `${API_ENDPOINTS.ASSET_FILE(selectedAsset.id, selectedAsset.metadata.riggedModelPath)}`
                          : undefined
                      }
                      characterHeight={selectedAsset.metadata?.characterHeight}
                      className="w-full h-full"
                    />
                  </div>
                </div>
                {isTransitioning && <TransitionOverlay />}

                {showAnimationView ? (
                  // Controls for animation view - positioned top-right to match asset browser layout
                  <div className="absolute top-4 right-4 flex gap-2 animate-fade-in z-10">
                    {/* Animation Toggle - furthest left */}
                    {selectedAsset.type === "character" && (
                      <button
                        onClick={toggleAnimationView}
                        className={`group p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg ${
                          showAnimationView ? "ring-2 ring-primary" : ""
                        }`}
                        title={
                          showAnimationView
                            ? "View 3D Model"
                            : "View Animations"
                        }
                      >
                        <Activity
                          size={20}
                          className={`transition-colors ${
                            showAnimationView
                              ? "text-primary"
                              : "text-text-secondary group-hover:text-primary"
                          }`}
                        />
                      </button>
                    )}

                    {/* Edit Button - middle */}
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="group p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg"
                      title="Edit Asset"
                    >
                      <Edit3
                        size={20}
                        className="text-text-secondary group-hover:text-primary transition-colors"
                      />
                    </button>

                    {/* Details Button - furthest right with Layers icon */}
                    <button
                      onClick={toggleDetailsPanel}
                      className={`p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg ${
                        showDetailsPanel ? "ring-2 ring-primary" : ""
                      }`}
                      title="Toggle Details (D)"
                    >
                      <Layers
                        size={20}
                        className={`transition-colors ${
                          showDetailsPanel
                            ? "text-primary"
                            : "text-text-secondary"
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  <ViewerControls
                    onViewerReset={handleViewerReset}
                    onDownload={handleDownload}
                    assetType={selectedAsset.type}
                    canRetexture={
                      selectedAsset.type !== "character" &&
                      selectedAsset.type !== "environment"
                    }
                    hasRigging={
                      selectedAsset.type === "character" ||
                      !!selectedAsset.metadata?.animations
                    }
                  />
                )}

                <AssetDetailsPanel
                  asset={selectedAsset}
                  isOpen={showDetailsPanel}
                  onClose={() => setShowDetailsPanel(false)}
                  modelInfo={modelInfo}
                />
              </>
            ) : (
              <EmptyAssetState />
            )}
          </div>
        </div>
      </div>

      {showRetextureModal && selectedAsset && (
        <RetextureModal
          asset={selectedAsset}
          onClose={() => setShowRetextureModal(false)}
          onComplete={() => {
            setShowRetextureModal(false);
            reloadAssets();
          }}
        />
      )}

      {showRegenerateModal && selectedAsset && (
        <RegenerateModal
          asset={selectedAsset}
          onClose={() => setShowRegenerateModal(false)}
          onComplete={() => {
            setShowRegenerateModal(false);
            reloadAssets();
          }}
        />
      )}

      {showEditModal && selectedAsset && (
        <AssetEditModal
          asset={selectedAsset}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveAsset}
          onDelete={handleDeleteAsset}
          hasVariants={assets.some(
            (a) =>
              a.metadata.isVariant &&
              a.metadata.parentBaseModel === selectedAsset.id,
          )}
        />
      )}

      {showSpriteModal && selectedAsset && (
        <SpriteGenerationModal
          asset={selectedAsset}
          onClose={() => setShowSpriteModal(false)}
          onComplete={() => {
            setShowSpriteModal(false);
            reloadAssets();
          }}
        />
      )}
    </div>
  );
};

export default AssetsPage;
