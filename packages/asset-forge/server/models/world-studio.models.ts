/**
 * World Studio TypeBox Models
 * Request/response validation schemas for World Studio API endpoints
 */

import { t, type Static } from "elysia";

// ==================== Team Models ====================

export const CreateTeamBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  slug: t.String({
    minLength: 1,
    maxLength: 50,
    pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$",
  }),
  description: t.Optional(t.String({ maxLength: 500 })),
});

/**
 * Update-team request body. All fields optional. `null` is accepted
 * for description/avatarUrl to clear them; undefined leaves the field
 * unchanged.
 */
export const UpdateTeamBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
});

export const TeamResponse = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  description: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  plan: t.String(),
  aiBudgetMonthlyCents: t.Number(),
  aiSpentThisMonthCents: t.Number(),
  createdAt: t.String(),
});

export const TeamMemberResponse = t.Object({
  id: t.String(),
  userId: t.String(),
  displayName: t.String(),
  email: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  role: t.String(),
  joinedAt: t.String(),
});

// ==================== Game Models ====================

/**
 * GameMode manifest (Phase 4) — UE5-inspired controller/camera/input/pawn
 * selection. All fields are strings validated at the route layer against
 * `gameModeRegistry`'s registered ids.
 */
export const GameModeManifestBody = t.Object({
  playerController: t.String({ minLength: 1, maxLength: 64 }),
  camera: t.String({ minLength: 1, maxLength: 64 }),
  inputContext: t.String({ minLength: 1, maxLength: 64 }),
  pawn: t.String({ minLength: 1, maxLength: 64 }),
});

export const CreateGameBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  slug: t.String({
    minLength: 1,
    maxLength: 50,
    pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$",
  }),
  description: t.Optional(t.String({ maxLength: 500 })),
  stagingServerUrl: t.Optional(t.String()),
  stagingAssetsPath: t.Optional(t.String()),
  productionServerUrl: t.Optional(t.String()),
  productionAssetsPath: t.Optional(t.String()),
  /** Optional GameMode manifest. Omit to use the Hyperia default. */
  gameMode: t.Optional(GameModeManifestBody),
});

export const UpdateGameBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  stagingServerUrl: t.Optional(t.String()),
  stagingAssetsPath: t.Optional(t.String()),
  productionServerUrl: t.Optional(t.String()),
  productionAssetsPath: t.Optional(t.String()),
  stagingAdminCode: t.Optional(t.String()),
  productionAdminCode: t.Optional(t.String()),
  gameMode: t.Optional(GameModeManifestBody),
  /**
   * Currently-active UI layout id. Pass `null` to unset (the client
   * will fall back to the hand-coded default layout). See
   * `PATCH /api/teams/:teamId/games/:gameId/active-ui-layout` for the
   * dedicated endpoint used by the UI Layout Editor.
   */
  activeUiLayoutId: t.Optional(t.Nullable(t.String())),
});

/** Body for PATCH /api/teams/:teamId/games/:gameId/active-ui-layout */
export const SetActiveUILayoutBody = t.Object({
  /** Layout id to activate, or `null` to clear the active layout. */
  activeUiLayoutId: t.Nullable(t.String()),
});

export const GameResponse = t.Object({
  id: t.String(),
  teamId: t.String(),
  name: t.String(),
  slug: t.String(),
  description: t.Nullable(t.String()),
  moduleId: t.String(),
  gameMode: GameModeManifestBody,
  stagingServerUrl: t.Nullable(t.String()),
  productionServerUrl: t.Nullable(t.String()),
  /**
   * Currently-active UI layout. `null` when no layout is set or the
   * active layout id has been orphaned (deleted). Clients should fall
   * back to their hand-coded default in either case.
   */
  activeUiLayoutId: t.Nullable(t.String()),
  createdAt: t.String(),
});

// ==================== Invite Models ====================

export const TeamInviteBody = t.Object({
  email: t.String({ format: "email" }),
  role: t.Optional(
    t.Union([t.Literal("viewer"), t.Literal("editor"), t.Literal("admin")]),
  ),
});

export const TeamInviteResponse = t.Object({
  id: t.String(),
  teamId: t.String(),
  email: t.String(),
  role: t.String(),
  token: t.String(),
  expiresAt: t.String(),
  acceptedAt: t.Nullable(t.String()),
});

// ==================== World Data Schemas ====================

/**
 * WorldData is a deeply-nested JSON object representing the entire world state.
 * We validate the top-level structure while allowing flexible nested content.
 * This prevents completely unstructured payloads while staying compatible with
 * the evolving client-side WorldBuilderContext shape.
 */
const WorldDataSchema = t.Object(
  {
    mode: t.Optional(t.String()),
    creation: t.Optional(t.Record(t.String(), t.Unknown())),
    editing: t.Optional(t.Record(t.String(), t.Unknown())),
    viewport: t.Optional(t.Record(t.String(), t.Unknown())),
    history: t.Optional(t.Record(t.String(), t.Unknown())),
  },
  { additionalProperties: true },
);

/** Manifest snapshot — structured export of game-ready data */
const ManifestSnapshotSchema = t.Nullable(
  t.Object(
    {
      version: t.Optional(t.Number()),
      exportedAt: t.Optional(t.String()),
    },
    { additionalProperties: true },
  ),
);

// ==================== World Project Models ====================

export const CreateWorldProjectBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  gameId: t.String({ format: "uuid" }),
  /**
   * Project template to clone from. When supplied, the server clones
   * the named template's `ProjectLayers` (config + plugins +
   * worldContent + templateId) and writes them into the new row.
   * `worldData` may still be supplied as a legacy compat path; when
   * both are supplied, `templateId` wins.
   * Phase B0'.B of `PLAN_PROJECT_AS_DATA.md`.
   */
  templateId: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  /**
   * @deprecated Use `templateId` instead. Kept as the legacy path
   * for callers that still construct `worldData` client-side.
   */
  worldData: t.Optional(WorldDataSchema),
});

export const ProjectTemplateResponse = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  thumbnailUrl: t.Optional(t.String()),
  defaultPick: t.Optional(t.Boolean()),
  /** Plugin ids the template installs (surfaced for picker preview). */
  plugins: t.Array(t.String()),
});

export const ProjectTemplateListResponse = t.Array(ProjectTemplateResponse);

export const UpdateWorldProjectBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  description: t.Optional(t.String({ maxLength: 2000 })),
  worldData: t.Optional(WorldDataSchema),
});

export const WorldProjectResponse = t.Object({
  id: t.String(),
  teamId: t.String(),
  gameId: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  version: t.Number(),
  createdBy: t.Nullable(t.String()),
  lockedBy: t.Nullable(t.String()),
  lockedAt: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
  // ── B0'.A typed project layers (summary view) ──
  /** Project shape version — B0'.A introduces v1. */
  schemaVersion: t.Number(),
  /** Template the project was cloned from (e.g. "blank", "hyperia"). */
  templateId: t.Nullable(t.String()),
  /** Plugin ids installed by PIE on Play. Empty = blank canvas. */
  plugins: t.Array(t.String()),
  /**
   * Asset pack manifest ids installed on this project (Phase AP1
   * of `PLAN_ASSET_PACKS.md`). Empty = no asset packs; agent may
   * only place engine-default placeholders.
   */
  assetPacks: t.Array(t.String()),
});

export const WorldProjectDetailResponse = t.Composite([
  WorldProjectResponse,
  t.Object({
    /**
     * Procgen `WorldCreationConfig` (terrain shape, biomes,
     * vegetation). May be null until the project's first PIE Play
     * triggers procgen. Phase B0'.A.
     */
    config: t.Nullable(t.Record(t.String(), t.Any())),
    /**
     * Authored content layered on top of plugin contributions
     * (npcs, zones, quests, uiPack). Empty `{}` for fresh projects.
     */
    worldContent: t.Record(t.String(), t.Any()),
    worldData: WorldDataSchema,
    manifestSnapshot: ManifestSnapshotSchema,
  }),
]);

export const WorldProjectListResponse = t.Array(WorldProjectResponse);

// ==================== Revision Models (G1) ====================

/**
 * One project revision row. Capture of the BEFORE state for the
 * write that bumped the project to `version + 1`.
 */
export const WorldProjectRevisionResponse = t.Object({
  id: t.String(),
  projectId: t.String(),
  /** Project version this revision captures (BEFORE state). */
  version: t.Number(),
  /** "user" | "agent" | "system". */
  author: t.String(),
  /** forge_users.id when author = "user". */
  authorId: t.Nullable(t.String()),
  changeReason: t.Nullable(t.String()),
  schemaVersion: t.Number(),
  config: t.Unknown(),
  plugins: t.Array(t.String()),
  worldContent: t.Unknown(),
  templateId: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const WorldProjectRevisionListResponse = t.Array(
  WorldProjectRevisionResponse,
);

// ==================== Deployment Models ====================

export const WorldDeploymentResponse = t.Object({
  id: t.String(),
  projectId: t.String(),
  gameId: t.String(),
  target: t.String(),
  version: t.Number(),
  deployedBy: t.Nullable(t.String()),
  approvedBy: t.Nullable(t.String()),
  deployedAt: t.String(),
});

// ==================== Game Module Models ====================

export const CreateGameModuleBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  version: t.Optional(t.String({ maxLength: 20 })),
  moduleData: t.Unknown(), // Full GameModule JSON, validated by loadGameModule()
});

export const UpdateGameModuleBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  version: t.Optional(t.String({ maxLength: 20 })),
  moduleData: t.Optional(t.Unknown()),
});

export const GameModuleResponse = t.Object({
  id: t.String(),
  teamId: t.String(),
  name: t.String(),
  slug: t.String(),
  version: t.String(),
  isBuiltin: t.Boolean(),
  createdBy: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const GameModuleDetailResponse = t.Composite([
  GameModuleResponse,
  t.Object({
    moduleData: t.Unknown(),
  }),
]);

// ==================== Script Models ====================

export const CreateScriptBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String({ maxLength: 500 })),
  version: t.Optional(t.String({ maxLength: 20 })),
  gameId: t.Optional(t.String()),
  graphData: t.Unknown(), // RuntimeScriptGraph JSON, validated by scriptGraphValidator
  isTemplate: t.Optional(t.Boolean()),
  isPublic: t.Optional(t.Boolean()),
});

export const UpdateScriptBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  version: t.Optional(t.String({ maxLength: 20 })),
  graphData: t.Optional(t.Unknown()),
  isTemplate: t.Optional(t.Boolean()),
  isPublic: t.Optional(t.Boolean()),
});

export const CloneScriptBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  gameId: t.Optional(t.String()),
});

export const ScriptResponse = t.Object({
  id: t.String(),
  teamId: t.String(),
  gameId: t.Nullable(t.String()),
  name: t.String(),
  slug: t.String(),
  description: t.Nullable(t.String()),
  version: t.String(),
  isTemplate: t.Boolean(),
  isPublic: t.Boolean(),
  createdBy: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const ScriptDetailResponse = t.Composite([
  ScriptResponse,
  t.Object({
    graphData: t.Unknown(),
  }),
]);

// ==================== UI Layout Models ====================

export const CreateUILayoutBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  description: t.Optional(t.String({ maxLength: 500 })),
  version: t.Optional(t.String({ maxLength: 20 })),
  gameId: t.Optional(t.String()),
  manifestData: t.Unknown(), // UILayoutManifest JSON, validated by UILayoutManifestSchema
  isTemplate: t.Optional(t.Boolean()),
  isPublic: t.Optional(t.Boolean()),
});

export const UpdateUILayoutBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  version: t.Optional(t.String({ maxLength: 20 })),
  manifestData: t.Optional(t.Unknown()),
  isTemplate: t.Optional(t.Boolean()),
  isPublic: t.Optional(t.Boolean()),
});

export const UILayoutResponse = t.Object({
  id: t.String(),
  teamId: t.String(),
  gameId: t.Nullable(t.String()),
  name: t.String(),
  slug: t.String(),
  description: t.Nullable(t.String()),
  version: t.String(),
  isTemplate: t.Boolean(),
  isPublic: t.Boolean(),
  createdBy: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const UILayoutDetailResponse = t.Composite([
  UILayoutResponse,
  t.Object({
    manifestData: t.Unknown(),
  }),
]);

export const CloneUILayoutBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  gameId: t.Optional(t.String()),
});

// ==================== Auth Models ====================

export const AuthMeResponse = t.Object({
  user: t.Object({
    id: t.String(),
    privyUserId: t.Nullable(t.String()),
    email: t.Nullable(t.String()),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
  }),
  teams: t.Array(
    t.Object({
      teamId: t.String(),
      teamName: t.String(),
      teamSlug: t.String(),
      role: t.String(),
    }),
  ),
});

/**
 * Profile update request body. All fields optional — clients send only
 * what they want to change. `null` for avatarUrl clears the avatar;
 * undefined leaves it as-is.
 */
export const AuthMeUpdateBody = t.Object({
  displayName: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
});

// ==================== Common ====================

export const TeamIdParam = t.Object({
  teamId: t.String({ format: "uuid" }),
});

export const GameIdParam = t.Object({
  gameId: t.String({ format: "uuid" }),
});

export const ProjectIdParam = t.Object({
  projectId: t.String({ format: "uuid" }),
});

export const PaginationQuery = t.Object({
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
});

// ==================== Type Exports ====================

export type CreateTeamBodyType = Static<typeof CreateTeamBody>;
export type UpdateTeamBodyType = Static<typeof UpdateTeamBody>;
export type CreateGameBodyType = Static<typeof CreateGameBody>;
export type UpdateGameBodyType = Static<typeof UpdateGameBody>;
export type SetActiveUILayoutBodyType = Static<typeof SetActiveUILayoutBody>;
export type GameModeManifestBodyType = Static<typeof GameModeManifestBody>;
export type TeamInviteBodyType = Static<typeof TeamInviteBody>;
export type CreateWorldProjectBodyType = Static<typeof CreateWorldProjectBody>;
export type UpdateWorldProjectBodyType = Static<typeof UpdateWorldProjectBody>;
export type CreateGameModuleBodyType = Static<typeof CreateGameModuleBody>;
export type UpdateGameModuleBodyType = Static<typeof UpdateGameModuleBody>;
export type CreateScriptBodyType = Static<typeof CreateScriptBody>;
export type UpdateScriptBodyType = Static<typeof UpdateScriptBody>;
export type CloneScriptBodyType = Static<typeof CloneScriptBody>;
