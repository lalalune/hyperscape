/**
 * Zustand Store Selectors
 *
 * Centralized, reusable selectors for Zustand stores.
 * These selectors help prevent unnecessary re-renders by providing
 * fine-grained subscriptions to specific store slices.
 *
 * Usage Example:
 * ```typescript
 * import { assetsSelectors } from '@/store/selectors'
 *
 * // Subscribe only to specific state slice
 * const assets = useAssetsStore(assetsSelectors.all)
 * const selectedAsset = useAssetsStore(assetsSelectors.selected)
 * ```
 */

/**
 * Assets Store Selectors
 * Use these for components that need specific asset state
 */
export const assetsSelectors = {
  // State selectors
  all: (state: any) => state.assets,
  selected: (state: any) => state.selectedAsset,
  loading: (state: any) => state.loading,
  error: (state: any) => state.error,

  // UI state selectors
  showGroundPlane: (state: any) => state.showGroundPlane,
  isWireframe: (state: any) => state.isWireframe,
  isLightBackground: (state: any) => state.isLightBackground,
  showDetailsPanel: (state: any) => state.showDetailsPanel,
  showAnimationView: (state: any) => state.showAnimationView,

  // Filter selectors
  searchTerm: (state: any) => state.searchTerm,
  typeFilter: (state: any) => state.typeFilter,
  materialFilter: (state: any) => state.materialFilter,

  // Modal state selectors
  modals: (state: any) => ({
    showRetextureModal: state.showRetextureModal,
    showRegenerateModal: state.showRegenerateModal,
    showEditModal: state.showEditModal,
    showSpriteModal: state.showSpriteModal,
  }),

  // Action selectors
  actions: (state: any) => ({
    setSelectedAsset: state.setSelectedAsset,
    handleAssetSelect: state.handleAssetSelect,
    clearSelection: state.clearSelection,
  }),

  // Custom selector: Get asset by ID
  byId: (id: string) => (state: any) =>
    state.assets.find((a: any) => a.id === id),

  // Custom selector: Get filtered assets
  filtered: (state: any) =>
    state.getFilteredAssets(state.assets),
}

/**
 * Generation Store Selectors
 * Use these for components that need specific generation state
 */
export const generationSelectors = {
  // UI state
  generationType: (state: any) => state.generationType,
  activeView: (state: any) => state.activeView,

  // Form state
  form: (state: any) => ({
    assetName: state.assetName,
    assetType: state.assetType,
    description: state.description,
    gameStyle: state.gameStyle,
  }),

  // Pipeline state
  pipeline: (state: any) => ({
    isGenerating: state.isGenerating,
    isGeneratingSprites: state.isGeneratingSprites,
    pipelineStages: state.pipelineStages,
    currentPipelineId: state.currentPipelineId,
  }),

  // Results
  results: (state: any) => ({
    generatedAssets: state.generatedAssets,
    selectedAsset: state.selectedAsset,
  }),

  // Configuration
  config: (state: any) => ({
    useGPT4Enhancement: state.useGPT4Enhancement,
    enableRetexturing: state.enableRetexturing,
    enableSprites: state.enableSprites,
    quality: state.quality,
  }),
}

/**
 * Content Generation Store Selectors
 * Use these for components that need game content state
 */
export const contentSelectors = {
  // Collections
  quests: (state: any) => state.quests,
  npcs: (state: any) => state.npcs,
  loreEntries: (state: any) => state.loreEntries,

  // Selected items
  selected: (state: any) => ({
    quest: state.selectedQuest,
    npc: state.selectedNPC,
    lore: state.selectedLore,
  }),

  // UI state
  activeTab: (state: any) => state.activeTab,

  // Actions
  actions: (state: any) => ({
    addQuest: state.addQuest,
    addNPC: state.addNPC,
    addLore: state.addLore,
    deleteQuest: state.deleteQuest,
    deleteNPC: state.deleteNPC,
    deleteLore: state.deleteLore,
  }),
}

/**
 * Voice Generation Store Selectors
 * Use these for components that need voice generation state
 */
export const voiceSelectors = {
  // Voice selection
  selectedVoiceId: (state: any) => state.selectedVoiceId,
  currentSettings: (state: any) => state.currentSettings,

  // Generation state
  generation: (state: any) => ({
    isGenerating: state.isGenerating,
    generationProgress: state.generationProgress,
    generationError: state.generationError,
  }),

  // Actions
  actions: (state: any) => ({
    setSelectedVoice: state.setSelectedVoice,
    setCurrentSettings: state.setCurrentSettings,
    setGenerating: state.setGenerating,
  }),

  // NPC voice config
  npcConfig: (npcId: string) => (state: any) =>
    state.getNPCVoiceConfig(npcId),
}

/**
 * Manifests Store Selectors
 * Use these for components that need manifest state
 */
export const manifestsSelectors = {
  // Collections
  manifests: (state: any) => state.manifests,

  // Selected items
  selectedType: (state: any) => state.selectedType,
  selectedItem: (state: any) => state.selectedItem,

  // Loading state
  loading: (state: any) => state.loading,
  error: (state: any) => state.error,

  // Search
  searchQuery: (state: any) => state.searchQuery,

  // Actions
  actions: (state: any) => ({
    setSelectedType: state.setSelectedType,
    setSelectedItem: state.setSelectedItem,
    setSearchQuery: state.setSearchQuery,
  }),

  // Computed
  filteredItems: (state: any) =>
    state.getFilteredItems(state.selectedType),
  stats: (state: any) => state.getStats(),
}

/**
 * Performance Tips:
 *
 * 1. Use individual selectors for frequently changing values:
 *    ```typescript
 *    const isGenerating = useGenerationStore(generationSelectors.pipeline.isGenerating)
 *    ```
 *
 * 2. Group related values that change together:
 *    ```typescript
 *    const form = useGenerationStore(generationSelectors.form)
 *    ```
 *
 * 3. For actions that never change, you can use them directly:
 *    ```typescript
 *    const addQuest = useContentGenerationStore(contentSelectors.actions.addQuest)
 *    ```
 *
 * 4. Custom selectors with parameters:
 *    ```typescript
 *    const asset = useAssetsStore(assetsSelectors.byId('asset-123'))
 *    ```
 */
