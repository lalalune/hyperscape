/**
 * Database Schema Index
 * Exports all schema tables and types
 */

// Assets
export * from "./assets.schema";

// World Studio — Accounts & Teams
export * from "./forge-users.schema";
export * from "./teams.schema";
export * from "./team-members.schema";

// World Studio — Projects & Deployments
export * from "./world-projects.schema";

// World Studio — Asset Packs (AP1)
export * from "./asset-packs.schema";

// World Studio — Audit
export * from "./audit-log.schema";

// World Studio — Game Modules
export * from "./game-modules.schema";

// World Studio — Scripts (standalone visual scripting graphs)
export * from "./scripts.schema";

// World Studio — UI Layouts (standalone layout manifests)
export * from "./ui-layouts.schema";

// Re-export everything for drizzle
import * as assetsSchema from "./assets.schema";
import * as assetPacksSchema from "./asset-packs.schema";
import * as forgeUsersSchema from "./forge-users.schema";
import * as teamsSchema from "./teams.schema";
import * as teamMembersSchema from "./team-members.schema";
import * as worldProjectsSchema from "./world-projects.schema";
import * as auditLogSchema from "./audit-log.schema";
import * as gameModulesSchema from "./game-modules.schema";
import * as scriptsSchema from "./scripts.schema";
import * as uiLayoutsSchema from "./ui-layouts.schema";

export const schema = {
  ...assetsSchema,
  ...assetPacksSchema,
  ...forgeUsersSchema,
  ...teamsSchema,
  ...teamMembersSchema,
  ...worldProjectsSchema,
  ...auditLogSchema,
  ...gameModulesSchema,
  ...scriptsSchema,
  ...uiLayoutsSchema,
};
