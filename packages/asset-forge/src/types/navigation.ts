export type NavigationView = 'assets' | 'generation' | 'equipment' | 'handRigging' | 'armorFitting'

export interface NavigationState {
  currentView: NavigationView
  selectedAssetId: string | null
  navigationHistory: NavigationView[]
}

export interface NavigationContextValue extends NavigationState {
  // Navigation actions
  navigateTo: (view: NavigationView) => void
  navigateToAsset: (assetId: string) => void
  goBack: () => void
  
  // Navigation helpers
  canGoBack: boolean
} 