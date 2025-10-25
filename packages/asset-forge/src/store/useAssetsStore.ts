import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { Asset } from '../types'

export interface ModelInfo {
  vertices: number
  faces: number
  materials: number
  fileSize?: number
}

interface AssetsState {
  // Selected Asset
  selectedAsset: Asset | null
  
  // Filter States
  searchTerm: string
  typeFilter: string
  materialFilter: string
  
  // Viewer States
  showGroundPlane: boolean
  isWireframe: boolean
  isLightBackground: boolean
  showRetextureModal: boolean
  showRegenerateModal: boolean
  showDetailsPanel: boolean
  showEditModal: boolean
  showSpriteModal: boolean
  isTransitioning: boolean
  modelInfo: ModelInfo | null
  showAnimationView: boolean
  
  // Actions
  setSelectedAsset: (asset: Asset | null) => void
  setSearchTerm: (term: string) => void
  setTypeFilter: (type: string) => void
  setMaterialFilter: (material: string) => void
  setShowGroundPlane: (show: boolean) => void
  setIsWireframe: (wireframe: boolean) => void
  setIsLightBackground: (light: boolean) => void
  setShowRetextureModal: (show: boolean) => void
  setShowRegenerateModal: (show: boolean) => void
  setShowDetailsPanel: (show: boolean) => void
  setShowEditModal: (show: boolean) => void
  setShowSpriteModal: (show: boolean) => void
  setIsTransitioning: (transitioning: boolean) => void
  setModelInfo: (info: ModelInfo | null) => void
  setShowAnimationView: (show: boolean) => void
  
  // Toggle Actions
  toggleGroundPlane: () => void
  toggleWireframe: () => void
  toggleBackground: () => void
  toggleDetailsPanel: () => void
  toggleAnimationView: () => void
  
  // Complex Actions
  handleAssetSelect: (asset: Asset) => void
  clearSelection: () => void
  resetViewerSettings: () => void
  closeAllModals: () => void
  
  // Computed Values
  getFilteredAssets: (assets: Asset[]) => Asset[]
}

export const useAssetsStore = create<AssetsState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial State
          selectedAsset: null,
          searchTerm: '',
          typeFilter: '',
          materialFilter: '',
          showGroundPlane: false,
          isWireframe: false,
          isLightBackground: false,
          showRetextureModal: false,
          showRegenerateModal: false,
          showDetailsPanel: false,
          showEditModal: false,
          showSpriteModal: false,
          isTransitioning: false,
          modelInfo: null,
          showAnimationView: false,
          
          // Basic Actions
          setSelectedAsset: (asset) => set(state => {
            state.selectedAsset = asset
          }),
          
          setSearchTerm: (term) => set(state => {
            state.searchTerm = term
          }),
          
          setTypeFilter: (type) => set(state => {
            state.typeFilter = type
          }),
          
          setMaterialFilter: (material) => set(state => {
            state.materialFilter = material
          }),
          
          setShowGroundPlane: (show) => set(state => {
            state.showGroundPlane = show
          }),
          
          setIsWireframe: (wireframe) => set(state => {
            state.isWireframe = wireframe
          }),
          
          setIsLightBackground: (light) => set(state => {
            state.isLightBackground = light
          }),
          
          setShowRetextureModal: (show) => set(state => {
            state.showRetextureModal = show
          }),
          
          setShowRegenerateModal: (show) => set(state => {
            state.showRegenerateModal = show
          }),
          
          setShowDetailsPanel: (show) => set(state => {
            state.showDetailsPanel = show
          }),
          
          setShowEditModal: (show) => set(state => {
            state.showEditModal = show
          }),
          
          setShowSpriteModal: (show) => set(state => {
            state.showSpriteModal = show
          }),
          
          setIsTransitioning: (transitioning) => set(state => {
            state.isTransitioning = transitioning
          }),
          
          setModelInfo: (info) => set(state => {
            state.modelInfo = info
          }),
          
          setShowAnimationView: (show) => set(state => {
            state.showAnimationView = show
          }),
          
          // Toggle Actions
          toggleGroundPlane: () => set(state => {
            state.showGroundPlane = !state.showGroundPlane
          }),
          
          toggleWireframe: () => set(state => {
            state.isWireframe = !state.isWireframe
          }),
          
          toggleBackground: () => set(state => {
            state.isLightBackground = !state.isLightBackground
          }),
          
          toggleDetailsPanel: () => set(state => {
            state.showDetailsPanel = !state.showDetailsPanel
          }),
          
          toggleAnimationView: () => set(state => {
            state.showAnimationView = !state.showAnimationView
          }),
          
          // Complex Actions
          handleAssetSelect: (asset) => set(state => {
            state.selectedAsset = asset
            state.modelInfo = null
            state.showAnimationView = false
          }),
          
          clearSelection: () => set(state => {
            state.selectedAsset = null
            state.modelInfo = null
            state.showAnimationView = false
          }),
          
          resetViewerSettings: () => set(state => {
            state.showGroundPlane = false
            state.isWireframe = false
            state.isLightBackground = false
            state.showAnimationView = false
          }),
          
          closeAllModals: () => set(state => {
            state.showRetextureModal = false
            state.showRegenerateModal = false
            state.showDetailsPanel = false
            state.showEditModal = false
            state.showSpriteModal = false
          }),
          
          // Computed Values
          getFilteredAssets: (assets: Asset[]) => {
            const state = get()
            return assets.filter(asset => {
              if (state.searchTerm && !asset.name.toLowerCase().includes(state.searchTerm.toLowerCase())) return false
              if (state.typeFilter && asset.type !== state.typeFilter) return false
              
              // Material filtering logic
              if (state.materialFilter) {
                // For variant assets with materialPreset
                if (asset.metadata.isVariant && asset.metadata.materialPreset) {
                  if (asset.metadata.materialPreset.id !== state.materialFilter) return false
                }
                // For variant assets with baseMaterial
                else if (asset.metadata.isVariant && asset.metadata.baseMaterial) {
                  if (asset.metadata.baseMaterial !== state.materialFilter) return false
                }
                // Base assets don't have materials, so exclude them when material filter is active
                else if (asset.metadata.isBaseModel) {
                  return false
                }
              }
              
              return true
            })
          }
        }))
      ),
      {
        name: 'assets-store',
        partialize: (state) => ({
          // Persist only UI preferences, not selected asset or transient state
          showGroundPlane: state.showGroundPlane,
          isWireframe: state.isWireframe,
          isLightBackground: state.isLightBackground,
          searchTerm: state.searchTerm,
          typeFilter: state.typeFilter,
          materialFilter: state.materialFilter
        })
      }
    ),
    { name: 'AssetsStore' }
  )
) 