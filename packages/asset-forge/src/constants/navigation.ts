import { NavigationView } from "../types";

// Navigation view constants
export const NAVIGATION_VIEWS = {
  DASHBOARD: "dashboard",
  ASSETS: "assets",
  GENERATION: "generation",
  EQUIPMENT: "equipment",
  HAND_RIGGING: "handRigging",
  ARMOR_FITTING: "armorFitting",
  RETARGET_ANIMATE: "retargetAnimate",
  BATCH_SPRITES: "batchSprites",
  VFX: "vfx",
  WORLD_BUILDER: "worldBuilder",
  WORLD_EDITOR: "worldEditor", // New: Uses real game systems
  MANIFESTS: "manifests",
  // Procedural generators
  BUILDING_GEN: "buildingGen",
  TREE_GEN: "treeGen",
  // LEAF_CLUSTER_GEN removed - consolidated into TreeGenPage
  ROCK_GEN: "rockGen",
  PLANT_GEN: "plantGen",
  TERRAIN_GEN: "terrainGen",
  ROADS_GEN: "roadsGen",
  GRASS_GEN: "grassGen",
  FLOWER_GEN: "flowerGen",
  VEGETATION_GEN: "vegetationGen",
  DOCK_GEN: "dockGen",
  BRIDGE_GEN: "bridgeGen",
  LANDMARK_GEN: "landmarkGen",
  WORLD_STUDIO: "worldStudio",
  ARMOR_PIPELINE: "armorPipeline",
  UI_LAYOUT_EDITOR: "uiLayoutEditor",
  ASSET_PACKS: "assetPacks",
} as const satisfies Record<string, NavigationView>;

// Route paths for URL navigation
export const ROUTES = {
  SIGN_IN: "/sign-in",
  DASHBOARD: "/dashboard",
  GENERATION: "/generate",
  ASSETS: "/assets",
  BUILDING_GEN: "/generators/buildings",
  TREE_GEN: "/generators/trees",
  // LEAF_CLUSTER_GEN removed - consolidated into TREE_GEN
  ROCK_GEN: "/generators/rocks",
  PLANT_GEN: "/generators/plants",
  TERRAIN_GEN: "/generators/terrain",
  ROADS_GEN: "/generators/roads",
  GRASS_GEN: "/generators/grass",
  FLOWER_GEN: "/generators/flowers",
  VEGETATION_GEN: "/generators/vegetation",
  DOCK_GEN: "/generators/docks",
  BRIDGE_GEN: "/generators/bridges",
  LANDMARK_GEN: "/generators/landmarks",
  WORLD_STUDIO: "/world-studio",
  HAND_RIGGING: "/hand-rigging",
  EQUIPMENT: "/equipment",
  ARMOR_FITTING: "/armor",
  RETARGET_ANIMATE: "/retarget",
  BATCH_SPRITES: "/batch-sprites",
  VFX: "/vfx",
  WORLD_BUILDER: "/world",
  WORLD_EDITOR: "/world-editor", // New: Uses real game systems
  MANIFESTS: "/manifests",
  ARMOR_PIPELINE: "/armor-pipeline",
  UI_LAYOUT_EDITOR: "/ui-layout",
  ASSET_PACKS: "/asset-packs",
  PROFILE: "/profile",
  TEAMS: "/teams",
  TEAM_DETAIL: "/teams/:teamId",
  TEAM_SETTINGS: "/teams/:teamId/settings",
  GAME_DETAIL: "/teams/:teamId/games/:gameId",
  /**
   * Asset-scoped UI layout editor route. The concrete URL is built by
   * `buildUILayoutEditorPath(teamId, layoutId)`; ROUTES.UI_LAYOUT_ASSET
   * is the React Router pattern (with `:teamId` / `:layoutId` placeholders).
   */
  UI_LAYOUT_ASSET: "/ui-layout/:teamId/:layoutId",
} as const;

/** Build a concrete URL to view a team's detail page. */
export function buildTeamDetailPath(teamId: string): string {
  return `/teams/${teamId}`;
}

/** Build a concrete URL to view a team's settings page. Optional tab. */
export function buildTeamSettingsPath(
  teamId: string,
  tab?: "general" | "members" | "invitations" | "audit",
): string {
  return `/teams/${teamId}/settings${tab ? `?tab=${tab}` : ""}`;
}

/** Build a concrete URL to view a game's detail page within a team. */
export function buildGameDetailPath(teamId: string, gameId: string): string {
  return `/teams/${teamId}/games/${gameId}`;
}

/** Build a concrete URL to edit a persisted UI layout asset. */
export function buildUILayoutEditorPath(
  teamId: string,
  layoutId: string,
): string {
  return `/ui-layout/${encodeURIComponent(teamId)}/${encodeURIComponent(layoutId)}`;
}

// Map routes to navigation views
export const ROUTE_TO_VIEW: Record<string, NavigationView> = {
  [ROUTES.DASHBOARD]: NAVIGATION_VIEWS.DASHBOARD,
  [ROUTES.GENERATION]: NAVIGATION_VIEWS.GENERATION,
  [ROUTES.ASSETS]: NAVIGATION_VIEWS.ASSETS,
  [ROUTES.BUILDING_GEN]: NAVIGATION_VIEWS.BUILDING_GEN,
  [ROUTES.TREE_GEN]: NAVIGATION_VIEWS.TREE_GEN,
  [ROUTES.ROCK_GEN]: NAVIGATION_VIEWS.ROCK_GEN,
  [ROUTES.PLANT_GEN]: NAVIGATION_VIEWS.PLANT_GEN,
  [ROUTES.TERRAIN_GEN]: NAVIGATION_VIEWS.TERRAIN_GEN,
  [ROUTES.ROADS_GEN]: NAVIGATION_VIEWS.ROADS_GEN,
  [ROUTES.GRASS_GEN]: NAVIGATION_VIEWS.GRASS_GEN,
  [ROUTES.FLOWER_GEN]: NAVIGATION_VIEWS.FLOWER_GEN,
  [ROUTES.VEGETATION_GEN]: NAVIGATION_VIEWS.VEGETATION_GEN,
  [ROUTES.DOCK_GEN]: NAVIGATION_VIEWS.DOCK_GEN,
  [ROUTES.BRIDGE_GEN]: NAVIGATION_VIEWS.BRIDGE_GEN,
  [ROUTES.LANDMARK_GEN]: NAVIGATION_VIEWS.LANDMARK_GEN,
  [ROUTES.WORLD_STUDIO]: NAVIGATION_VIEWS.WORLD_STUDIO,
  [ROUTES.HAND_RIGGING]: NAVIGATION_VIEWS.HAND_RIGGING,
  [ROUTES.EQUIPMENT]: NAVIGATION_VIEWS.EQUIPMENT,
  [ROUTES.ARMOR_FITTING]: NAVIGATION_VIEWS.ARMOR_FITTING,
  [ROUTES.RETARGET_ANIMATE]: NAVIGATION_VIEWS.RETARGET_ANIMATE,
  [ROUTES.BATCH_SPRITES]: NAVIGATION_VIEWS.BATCH_SPRITES,
  [ROUTES.VFX]: NAVIGATION_VIEWS.VFX,
  [ROUTES.WORLD_BUILDER]: NAVIGATION_VIEWS.WORLD_BUILDER,
  [ROUTES.WORLD_EDITOR]: NAVIGATION_VIEWS.WORLD_EDITOR,
  [ROUTES.MANIFESTS]: NAVIGATION_VIEWS.MANIFESTS,
  [ROUTES.ARMOR_PIPELINE]: NAVIGATION_VIEWS.ARMOR_PIPELINE,
  [ROUTES.UI_LAYOUT_EDITOR]: NAVIGATION_VIEWS.UI_LAYOUT_EDITOR,
  [ROUTES.ASSET_PACKS]: NAVIGATION_VIEWS.ASSET_PACKS,
};

// Map navigation views to routes
export const VIEW_TO_ROUTE: Record<NavigationView, string> = {
  [NAVIGATION_VIEWS.DASHBOARD]: ROUTES.DASHBOARD,
  [NAVIGATION_VIEWS.GENERATION]: ROUTES.GENERATION,
  [NAVIGATION_VIEWS.ASSETS]: ROUTES.ASSETS,
  [NAVIGATION_VIEWS.BUILDING_GEN]: ROUTES.BUILDING_GEN,
  [NAVIGATION_VIEWS.TREE_GEN]: ROUTES.TREE_GEN,
  [NAVIGATION_VIEWS.ROCK_GEN]: ROUTES.ROCK_GEN,
  [NAVIGATION_VIEWS.PLANT_GEN]: ROUTES.PLANT_GEN,
  [NAVIGATION_VIEWS.TERRAIN_GEN]: ROUTES.TERRAIN_GEN,
  [NAVIGATION_VIEWS.ROADS_GEN]: ROUTES.ROADS_GEN,
  [NAVIGATION_VIEWS.GRASS_GEN]: ROUTES.GRASS_GEN,
  [NAVIGATION_VIEWS.FLOWER_GEN]: ROUTES.FLOWER_GEN,
  [NAVIGATION_VIEWS.VEGETATION_GEN]: ROUTES.VEGETATION_GEN,
  [NAVIGATION_VIEWS.DOCK_GEN]: ROUTES.DOCK_GEN,
  [NAVIGATION_VIEWS.BRIDGE_GEN]: ROUTES.BRIDGE_GEN,
  [NAVIGATION_VIEWS.LANDMARK_GEN]: ROUTES.LANDMARK_GEN,
  [NAVIGATION_VIEWS.WORLD_STUDIO]: ROUTES.WORLD_STUDIO,
  [NAVIGATION_VIEWS.HAND_RIGGING]: ROUTES.HAND_RIGGING,
  [NAVIGATION_VIEWS.EQUIPMENT]: ROUTES.EQUIPMENT,
  [NAVIGATION_VIEWS.ARMOR_FITTING]: ROUTES.ARMOR_FITTING,
  [NAVIGATION_VIEWS.RETARGET_ANIMATE]: ROUTES.RETARGET_ANIMATE,
  [NAVIGATION_VIEWS.BATCH_SPRITES]: ROUTES.BATCH_SPRITES,
  [NAVIGATION_VIEWS.VFX]: ROUTES.VFX,
  [NAVIGATION_VIEWS.WORLD_BUILDER]: ROUTES.WORLD_BUILDER,
  [NAVIGATION_VIEWS.WORLD_EDITOR]: ROUTES.WORLD_EDITOR,
  [NAVIGATION_VIEWS.MANIFESTS]: ROUTES.MANIFESTS,
  [NAVIGATION_VIEWS.ARMOR_PIPELINE]: ROUTES.ARMOR_PIPELINE,
  [NAVIGATION_VIEWS.UI_LAYOUT_EDITOR]: ROUTES.UI_LAYOUT_EDITOR,
  [NAVIGATION_VIEWS.ASSET_PACKS]: ROUTES.ASSET_PACKS,
};

// Grid background styles for the app
export const APP_BACKGROUND_STYLES = {
  gridSize: "50px 50px",
  gridImage: `linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
               linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)`,
} as const;
