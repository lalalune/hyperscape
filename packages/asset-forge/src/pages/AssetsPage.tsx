import { Activity, Edit3, Layers } from 'lucide-react'
import React, { useRef, useCallback, lazy, Suspense } from 'react'

import { API_ENDPOINTS } from '../constants'
import { useAssetsStore } from '../store'

import AssetDetailsPanel from '@/components/Assets/AssetDetailsPanel'
import AssetFilters from '@/components/Assets/AssetFilters'
import AssetList from '@/components/Assets/AssetList'
import { EmptyAssetState } from '@/components/Assets/EmptyAssetState'
import { LoadingState } from '@/components/Assets/LoadingState'
import { TransitionOverlay } from '@/components/Assets/TransitionOverlay'
import ViewerControls from '@/components/Assets/ViewerControls'
import ThreeViewer, { ThreeViewerRef } from '@/components/shared/ThreeViewer'
import { useAssetActions } from '@/hooks/useAssetActions'
import { useAssets } from '@/hooks/useAssets'

// Lazy load modals for better code splitting (saves ~50KB initial bundle)
const AssetEditModal = lazy(() => import('@/components/Assets/AssetEditModal').then(m => ({ default: m.AssetEditModal })))
const RegenerateModal = lazy(() => import('@/components/Assets/RegenerateModal'))
const RetextureModal = lazy(() => import('@/components/Assets/RetextureModal'))
const SpriteGenerationModal = lazy(() => import('@/components/Assets/SpriteGenerationModal'))



export const AssetsPage: React.FC = () => {
  const { assets, loading, reloadAssets, forceReload } = useAssets()

  // Get state and actions from store - selective subscriptions
  const selectedAsset = useAssetsStore(state => state.selectedAsset)
  const showGroundPlane = useAssetsStore(state => state.showGroundPlane)
  const isWireframe = useAssetsStore(state => state.isWireframe)
  const isLightBackground = useAssetsStore(state => state.isLightBackground)
  const showRetextureModal = useAssetsStore(state => state.showRetextureModal)
  const showRegenerateModal = useAssetsStore(state => state.showRegenerateModal)
  const showDetailsPanel = useAssetsStore(state => state.showDetailsPanel)
  const showEditModal = useAssetsStore(state => state.showEditModal)
  const showSpriteModal = useAssetsStore(state => state.showSpriteModal)
  const isTransitioning = useAssetsStore(state => state.isTransitioning)
  const modelInfo = useAssetsStore(state => state.modelInfo)
  const showAnimationView = useAssetsStore(state => state.showAnimationView)
  const setShowRetextureModal = useAssetsStore(state => state.setShowRetextureModal)
  const setShowRegenerateModal = useAssetsStore(state => state.setShowRegenerateModal)
  const setShowDetailsPanel = useAssetsStore(state => state.setShowDetailsPanel)
  const setShowEditModal = useAssetsStore(state => state.setShowEditModal)
  const setShowSpriteModal = useAssetsStore(state => state.setShowSpriteModal)
  const setModelInfo = useAssetsStore(state => state.setModelInfo)
  const toggleDetailsPanel = useAssetsStore(state => state.toggleDetailsPanel)
  const toggleAnimationView = useAssetsStore(state => state.toggleAnimationView)
  const getFilteredAssets = useAssetsStore(state => state.getFilteredAssets)

  const viewerRef = useRef<ThreeViewerRef>(null)

  // Use the asset actions hook
  const { handleViewerReset, handleDownload, handleDeleteAsset, handleSaveAsset } = useAssetActions({
    viewerRef: viewerRef as React.RefObject<ThreeViewerRef>,
    reloadAssets,
    forceReload,
    assets
  })

  // Filter assets based on current filters
  const filteredAssets = getFilteredAssets(assets)

  const handleModelLoad = useCallback((info: { vertices: number, faces: number, materials: number, fileSize?: number }) => {
    setModelInfo(info)
  }, [setModelInfo])

  if (loading) {
    return <LoadingState />
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
          <AssetList
            assets={filteredAssets}
          />
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 animate-fade-in">
          <div className="flex-1 relative rounded-xl border border-border-primary shadow-2xl overflow-hidden">
            {selectedAsset ? (
              <>
                <div className="absolute inset-0">
                  {/* Single unified ThreeViewer with optional animation controls */}
                  <ThreeViewer
                    key={`viewer-${selectedAsset.id}-${showAnimationView ? 'anim' : 'model'}`}
                    ref={viewerRef}
                    modelUrl={selectedAsset.hasModel ? `${API_ENDPOINTS.ASSET_MODEL(selectedAsset.id)}` : undefined}
                    isWireframe={isWireframe}
                    showGroundPlane={showGroundPlane}
                    isLightBackground={isLightBackground}
                    lightMode={true}
                    onModelLoad={handleModelLoad}
                    showAnimationControls={showAnimationView && selectedAsset.type === 'character'}
                    animationFiles={selectedAsset.metadata?.animations}
                    assetId={selectedAsset.id}
                    assetInfo={{
                      name: selectedAsset.name,
                      type: selectedAsset.type,
                      tier: selectedAsset.metadata?.tier,
                      format: selectedAsset.metadata?.format ?? 'GLB',
                      requiresAnimationStrip: selectedAsset.metadata?.requiresAnimationStrip,
                      characterHeight: selectedAsset.metadata?.characterHeight
                    }}
                  />
                </div>
                {isTransitioning && <TransitionOverlay />}

                {showAnimationView ? (
                  // Controls for animation view - positioned top-right to match asset browser layout
                  <div className="absolute top-4 right-4 flex gap-2 animate-fade-in z-10">
                    {/* Animation Toggle - furthest left */}
                    {selectedAsset.type === 'character' && (
                      <button
                        onClick={toggleAnimationView}
                        className={`group p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg ${showAnimationView ? 'ring-2 ring-primary' : ''
                          }`}
                        title={showAnimationView ? "View 3D Model" : "View Animations"}
                      >
                        <Activity
                          size={20}
                          className={`transition-colors ${showAnimationView
                            ? 'text-primary'
                            : 'text-text-secondary group-hover:text-primary'
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
                      <Edit3 size={20} className="text-text-secondary group-hover:text-primary transition-colors" />
                    </button>

                    {/* Details Button - furthest right with Layers icon */}
                    <button
                      onClick={toggleDetailsPanel}
                      className={`p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg ${showDetailsPanel
                        ? 'ring-2 ring-primary'
                        : ''
                        }`}
                      title="Toggle Details (D)"
                    >
                      <Layers size={20} className={`transition-colors ${showDetailsPanel
                        ? 'text-primary'
                        : 'text-text-secondary'
                        }`} />
                    </button>
                  </div>
                ) : (
                  <ViewerControls
                    onViewerReset={handleViewerReset}
                    onDownload={handleDownload}
                    assetType={selectedAsset.type}
                    canRetexture={selectedAsset.type !== 'character' && selectedAsset.type !== 'environment'}
                    hasRigging={selectedAsset.type === 'character' || !!selectedAsset.metadata?.animations}
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
        <Suspense fallback={null}>
          <RetextureModal
            asset={selectedAsset}
            onClose={() => setShowRetextureModal(false)}
            onComplete={() => {
              setShowRetextureModal(false)
              reloadAssets()
            }}
          />
        </Suspense>
      )}

      {showRegenerateModal && selectedAsset && (
        <Suspense fallback={null}>
          <RegenerateModal
            asset={selectedAsset}
            onClose={() => setShowRegenerateModal(false)}
            onComplete={() => {
              setShowRegenerateModal(false)
              reloadAssets()
            }}
          />
        </Suspense>
      )}

      {showEditModal && selectedAsset && (
        <Suspense fallback={null}>
          <AssetEditModal
            asset={selectedAsset}
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSave={handleSaveAsset}
            onDelete={handleDeleteAsset}
            hasVariants={assets.some(a => a.metadata?.isVariant && a.metadata?.parentBaseModel === selectedAsset.id)}
          />
        </Suspense>
      )}

      {showSpriteModal && selectedAsset && (
        <Suspense fallback={null}>
          <SpriteGenerationModal
            asset={selectedAsset}
            onClose={() => setShowSpriteModal(false)}
            onComplete={() => {
              setShowSpriteModal(false)
              reloadAssets()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

export default AssetsPage