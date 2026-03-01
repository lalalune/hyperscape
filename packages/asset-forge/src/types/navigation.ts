// Navigation view type used for route mapping
export type NavigationView =
  | "assets"
  | "generation"
  | "equipment"
  | "handRigging"
  | "armorFitting"
  | "retargetAnimate"
  | "batchSprites"
  | "vfx"
  | "worldBuilder"
  | "worldEditor" // New: Uses real game systems
  | "manifests"
  | "buildingGen"
  | "treeGen"
  // leafClusterGen removed - consolidated into treeGen
  | "rockGen"
  | "plantGen"
  | "terrainGen"
  | "roadsGen"
  | "grassGen"
  | "flowerGen"
  | "vegetationGen";

export interface NavigationState {
  currentView: NavigationView;
  selectedAssetId: string | null;
  navigationHistory: NavigationView[];
}

export interface NavigationContextValue extends NavigationState {
  // Navigation actions
  navigateTo: (view: NavigationView) => void;
  navigateToAsset: (assetId: string) => void;
  goBack: () => void;

  // Navigation helpers
  canGoBack: boolean;
}
