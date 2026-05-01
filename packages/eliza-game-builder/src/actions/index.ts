/**
 * Barrel — every action exported as a flat list. The plugin's
 * `actions` array consumes this so adding a new action is one
 * import + one export entry, no plumbing edits.
 */

export { listWidgetsAction } from "./listWidgets.js";
export { getWidgetAction } from "./getWidget.js";
export { searchWidgetsAction } from "./searchWidgets.js";
export { catalogStatsAction } from "./catalogStats.js";
export { scaffoldWidgetAction } from "./scaffoldWidget.js";
export { proposeUIPackAction } from "./proposeUIPack.js";
export { proposeNpcPlacementAction } from "./proposeNpcPlacement.js";
export { proposeMobSpawnAction } from "./proposeMobSpawn.js";
export { proposeQuestAction } from "./proposeQuest.js";
export { proposeResourceAction } from "./proposeResource.js";
export { proposeAssetAction, type AssetProposal } from "./proposeAsset.js";
export { proposeZoneAction } from "./proposeZone.js";
export {
  removeFromProjectAction,
  type RemovalRequest,
} from "./removeFromProject.js";
export { getProjectStateAction } from "./getProjectState.js";
export { listPluginsAction } from "./listPlugins.js";
export { getPluginAction } from "./getPlugin.js";
export { proposeTerrainConfigAction } from "./proposeTerrainConfig.js";
export { proposePluginSetAction } from "./proposePluginSet.js";
export { listAssetPacksAction } from "./listAssetPacks.js";
export { proposeAssetPackInstallAction } from "./proposeAssetPackInstall.js";
export { listEntityTypesAction } from "./listEntityTypes.js";
export { proposeStationAction } from "./proposeStation.js";
export { proposeTeleportAction } from "./proposeTeleport.js";
export { proposeRoadAction } from "./proposeRoad.js";
export { proposePOIAction } from "./proposePOI.js";
export { offerChoicesAction, type OfferedChoice } from "./offerChoices.js";
