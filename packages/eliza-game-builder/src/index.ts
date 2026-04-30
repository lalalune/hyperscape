/**
 * `@hyperforge/eliza-game-builder` — public API.
 *
 * Phase A4.2 of `PLAN_AI_AUTHORING_FOUNDATIONS.md`. The first
 * surface that lets an ElizaOS-driven agent compose UI / scaffold
 * widgets / inspect the catalog during a chat-driven game-design
 * session.
 *
 * Usage in an ElizaOS character config:
 *
 *   import { gameBuilderPlugin } from "@hyperforge/eliza-game-builder";
 *
 *   const character: Character = {
 *     // ...
 *     plugins: [gameBuilderPlugin, ...],
 *   };
 *
 * The runtime constructs `GameBuilderService` from settings:
 *   HYPERFORGE_CATALOG_PATH        (override default catalog.json)
 *   HYPERFORGE_WORKSPACE_ROOT      (where scaffolded files land)
 */

import type { Plugin } from "@elizaos/core";
import {
  catalogStatsAction,
  getPluginAction,
  getProjectStateAction,
  getWidgetAction,
  listPluginsAction,
  listWidgetsAction,
  offerChoicesAction,
  proposeAssetAction,
  proposeMobSpawnAction,
  proposeNpcPlacementAction,
  proposePluginSetAction,
  proposeQuestAction,
  proposeResourceAction,
  proposeTerrainConfigAction,
  proposeUIPackAction,
  proposeZoneAction,
  removeFromProjectAction,
  scaffoldWidgetAction,
  searchWidgetsAction,
} from "./actions/index.js";
import { GameBuilderService } from "./services/GameBuilderService.js";

export const gameBuilderPlugin: Plugin = {
  name: "@hyperforge/eliza-game-builder",
  description:
    "Wraps the HyperForge widget catalog + plugin scaffolder as ElizaOS actions so an agent can list widgets, inspect schemas, and scaffold new widgets during a chat-driven game-design session.",

  services: [GameBuilderService],

  actions: [
    catalogStatsAction,
    listWidgetsAction,
    getWidgetAction,
    searchWidgetsAction,
    proposeUIPackAction,
    proposeNpcPlacementAction,
    proposeMobSpawnAction,
    proposeQuestAction,
    proposeAssetAction,
    proposeZoneAction,
    proposeResourceAction,
    proposeTerrainConfigAction,
    proposePluginSetAction,
    removeFromProjectAction,
    listPluginsAction,
    getPluginAction,
    getProjectStateAction,
    offerChoicesAction,
    scaffoldWidgetAction,
  ],

  providers: [],
  evaluators: [],
};

export default gameBuilderPlugin;

// Re-exports for direct programmatic use (testing, MCP wrapper,
// CLI subprocess).
export {
  GameBuilderService,
  type GameBuilderServiceOptions,
  type IGameBuilderService,
  type ScaffoldOutcome,
} from "./services/GameBuilderService.js";

export {
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  type IProjectContextService,
  type ProjectContext,
  type ProjectContextAssetPack,
} from "./services/ProjectContextService.js";

export {
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  makeAssetPackCatalogService,
  type IAssetPackCatalogService,
  type InstallableAssetPack,
} from "./services/AssetPackCatalogService.js";

export {
  catalogStatsAction,
  getPluginAction,
  getProjectStateAction,
  getWidgetAction,
  listAssetPacksAction,
  listEntityTypesAction,
  listPluginsAction,
  listWidgetsAction,
  offerChoicesAction,
  proposeAssetAction,
  proposeAssetPackInstallAction,
  proposeMobSpawnAction,
  proposeNpcPlacementAction,
  proposePluginSetAction,
  proposeQuestAction,
  proposeResourceAction,
  proposeStationAction,
  proposeTerrainConfigAction,
  proposeUIPackAction,
  proposeZoneAction,
  removeFromProjectAction,
  scaffoldWidgetAction,
  searchWidgetsAction,
  type AssetProposal,
  type OfferedChoice,
  type RemovalRequest,
} from "./actions/index.js";

export {
  formatCatalogStats,
  formatWidgetEntry,
  formatWidgetList,
  searchCatalog,
  type FormattedEntryResult,
  type FormattedListResult,
  type FormattedStatsResult,
} from "./promptHelpers.js";
