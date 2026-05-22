import { Activity, Edit3, Layers } from "lucide-react";
import { useRef, useCallback } from "react";

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
import { StatusDot } from "@/components/shared/page";
import ThreeViewer, { ThreeViewerRef } from "@/components/shared/ThreeViewer";
import { useAssetActions } from "@/hooks";
import { useAssets } from "@/hooks";

export function AssetsPage() {
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
    <div className="flex flex-col h-[calc(100vh-44px)] bg-bg-primary">
      {/* Editorial hero — slim, leaves max room for the viewer */}
      <header className="px-6 py-5 border-b border-border-primary flex-shrink-0">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                00 / Library
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                <StatusDot tone={assets.length > 0 ? "ready" : "idle"} />
                <span className="font-mono normal-case tracking-normal tabular-nums">
                  {filteredAssets.length}
                  {filteredAssets.length !== assets.length &&
                    ` / ${assets.length}`}
                </span>
                {filteredAssets.length === 1 ? "asset" : "assets"}
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-medium text-text-primary tracking-tight leading-[1.05]">
              Asset <span className="text-primary">library</span>
            </h1>
          </div>
          {selectedAsset && (
            <div className="flex items-baseline gap-3 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <span>Viewing</span>
              <span className="font-mono normal-case tracking-normal text-text-secondary truncate max-w-xs">
                {selectedAsset.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main split: sidebar + viewer */}
      <div className="flex-1 flex gap-5 p-5 overflow-hidden min-h-0">
        {/* Sidebar — filters + list */}
        <aside className="flex flex-col gap-3 w-80 min-w-[20rem] flex-shrink-0">
          <AssetFilters
            totalAssets={assets.length}
            filteredCount={filteredAssets.length}
          />
          <AssetList assets={filteredAssets} />
        </aside>

        {/* Main viewer */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative rounded-lg border border-border-primary overflow-hidden bg-bg-primary">
            {selectedAsset ? (
              <>
                <div className="absolute inset-0">
                  {/* Keep both viewers mounted; fade inactive one */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      showAnimationView && selectedAsset.type === "character"
                        ? "opacity-0 pointer-events-none"
                        : "opacity-100"
                    } ease-out`}
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
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      showAnimationView && selectedAsset.type === "character"
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    } ease-out`}
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
                  /* Animation-view control pills — brand HUD style */
                  <div className="absolute top-5 right-5 flex gap-2 z-10">
                    {selectedAsset.type === "character" && (
                      <button
                        type="button"
                        onClick={toggleAnimationView}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] uppercase tracking-[0.12em] transition-colors duration-300 ease-out ${
                          showAnimationView
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-bg-tertiary border-border-primary text-text-secondary hover:border-primary/40 hover:text-primary"
                        }`}
                        title={
                          showAnimationView
                            ? "View 3D model"
                            : "View animations"
                        }
                      >
                        <Activity size={11} strokeWidth={1.5} />
                        Animations
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
                      title="Edit asset"
                    >
                      <Edit3 size={11} strokeWidth={1.5} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={toggleDetailsPanel}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] uppercase tracking-[0.12em] transition-colors duration-300 ease-out ${
                        showDetailsPanel
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-bg-tertiary border-border-primary text-text-secondary hover:border-primary/40 hover:text-primary"
                      }`}
                      title="Toggle details (D)"
                    >
                      <Layers size={11} strokeWidth={1.5} />
                      Details
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
        </section>
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
}

export default AssetsPage;
