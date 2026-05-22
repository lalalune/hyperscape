/**
 * Client API wrappers for World Studio project endpoints.
 *
 * Uses apiFetch() which auto-injects Privy auth tokens.
 * Response shapes match server TypeBox models in server/models/world-studio.models.ts.
 */

import { apiFetch } from "./api";

// ============== Response Types ==============

export interface AuthTeamMembership {
  teamId: string;
  teamName: string;
  role: string;
}

export interface AuthUserRecord {
  id: string;
  privyUserId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthMeResponse {
  user: AuthUserRecord;
  teams: AuthTeamMembership[];
}

export interface GameModeManifestResponse {
  playerController: string;
  camera: string;
  inputContext: string;
  pawn: string;
}

export interface GameResponse {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description: string | null;
  moduleId: string;
  gameMode: GameModeManifestResponse;
  stagingServerUrl: string | null;
  productionServerUrl: string | null;
  /**
   * Currently-active UI layout id, or `null` when the game falls back
   * to the built-in default layout. Set via `setGameActiveUILayout`.
   */
  activeUiLayoutId: string | null;
  createdAt: string;
}

export interface WorldProjectSummary {
  id: string;
  teamId: string;
  gameId: string;
  name: string;
  description: string | null;
  version: number;
  createdBy: string;
  lockedBy: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // ── B0'.A typed-layer surface ──
  schemaVersion: number;
  /** Template id the project was cloned from, or null. */
  templateId: string | null;
  /** Plugin ids installed by PIE on Play. */
  plugins: string[];
  /**
   * Asset pack manifest ids installed on this project (Phase AP1
   * of `PLAN_ASSET_PACKS.md`). Empty = no asset packs.
   */
  assetPacks: string[];
}

export interface WorldProjectDetail extends WorldProjectSummary {
  /**
   * Procgen config (terrain shape, biomes, vegetation). May be
   * null until the project's first PIE Play triggers procgen.
   */
  config: Record<string, unknown> | null;
  /**
   * Authored content layered on top of plugin contributions
   * (npcs, zones, quests, uiPack).
   */
  worldContent: Record<string, unknown>;
  /**
   * @deprecated Legacy opaque blob, preserved during the
   * deprecation window for read-fallback compatibility. New code
   * should consume `config` + `worldContent` + `templateId` +
   * `plugins`.
   */
  worldData: unknown;
  manifestSnapshot: unknown;
}

export interface LockResult {
  success: boolean;
  lockedBy?: string;
}

// ============== API Functions ==============

export async function fetchCurrentUser(): Promise<AuthMeResponse> {
  const res = await apiFetch("/api/auth/me");
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}

/**
 * Update the current user's profile (displayName + avatarUrl).
 * Pass undefined to leave a field unchanged. Pass `null` for avatarUrl
 * to clear it.
 */
export async function updateCurrentUser(input: {
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<AuthMeResponse> {
  const res = await apiFetch("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
  return res.json();
}

export async function fetchTeamGames(teamId: string): Promise<GameResponse[]> {
  const res = await apiFetch(`/api/teams/${teamId}/games`);
  if (!res.ok) throw new Error(`Failed to fetch games: ${res.status}`);
  return res.json();
}

export async function fetchGame(
  teamId: string,
  gameId: string,
): Promise<GameResponse> {
  const res = await apiFetch(`/api/teams/${teamId}/games/${gameId}`);
  if (!res.ok) throw new Error(`Failed to fetch game: ${res.status}`);
  return res.json();
}

/**
 * Partial update for a game record. `gameMode` is validated server-side
 * against the allowlist in `asset-forge/server/utils/gameModeRegistry.ts`.
 */
export async function updateGame(
  teamId: string,
  gameId: string,
  patch: {
    name?: string;
    description?: string;
    gameMode?: GameModeManifestResponse;
  },
): Promise<GameResponse> {
  const res = await apiFetch(`/api/teams/${teamId}/games/${gameId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to update game: ${res.status} ${msg}`);
  }
  return res.json();
}

/**
 * Set (or clear, by passing `null`) the game's active UI layout.
 * Requires at least "editor" team-role. Server verifies that the
 * layout is actually accessible to this team.
 */
export async function setGameActiveUILayout(
  teamId: string,
  gameId: string,
  activeUiLayoutId: string | null,
): Promise<GameResponse> {
  const res = await apiFetch(
    `/api/teams/${encodeURIComponent(teamId)}/games/${encodeURIComponent(gameId)}/active-ui-layout`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeUiLayoutId }),
    },
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Failed to set active UI layout: ${res.status} ${msg}`);
  }
  return res.json();
}

export async function listWorldProjects(
  teamId: string,
  gameId: string,
): Promise<WorldProjectSummary[]> {
  const res = await apiFetch(
    `/api/world/projects?teamId=${encodeURIComponent(teamId)}&gameId=${encodeURIComponent(gameId)}`,
  );
  if (!res.ok) throw new Error(`Failed to list projects: ${res.status}`);
  return res.json();
}

export async function getWorldProject(
  projectId: string,
): Promise<WorldProjectDetail> {
  const res = await apiFetch(`/api/world/projects/${projectId}`);
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
  return res.json();
}

export async function createWorldProject(data: {
  teamId: string;
  gameId: string;
  name: string;
  description?: string;
  /**
   * Project template to clone from. When supplied, the server
   * resolves the template's layers (config + plugins + worldContent
   * + templateId) and writes them into the new row. `worldData`
   * becomes optional in this mode.
   * Phase B0'.B of `PLAN_PROJECT_AS_DATA.md`.
   */
  templateId?: string;
  /**
   * @deprecated Use `templateId` instead. Still accepted for
   * legacy callers that construct `worldData` client-side (e.g. a
   * NewWorldDialog that has already run procgen).
   */
  worldData?: unknown;
}): Promise<WorldProjectDetail> {
  const res = await apiFetch("/api/world/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  return res.json();
}

/**
 * Project pack — a forkable starter game. Bundles plugins +
 * content packs + optional initial config + optional authored
 * world content. The "template picker" in the New Project
 * dialog renders these via `listProjectPacks`; user picks one
 * → `forkProjectPack` creates a fully-configured project.
 *
 * Phase E of `PLAN_AAA_CONTENT_SYSTEM.md`. Replaces the prior
 * `ProjectTemplate` shape — that one was hardcoded TS in
 * `ProjectTemplateService`, didn't carry `assetPacks`/
 * `contentPackIds`, and was authoring-closed (required code
 * changes to add). Project packs are DB-backed, auto-bootstrap
 * on server start, and authors can ship them via the
 * marketplace.
 */
export interface ProjectPack {
  manifestId: string;
  manifest: {
    id: string;
    name: string;
    description?: string;
    packVersion: string;
    tags?: string[];
    pluginIds: string[];
    contentPackIds: string[];
  };
  visibility: string;
  teamId: string | null;
}

/**
 * List every forkable project pack — built-in + marketplace +
 * caller's team. Used by the New Project dialog to render the
 * template picker.
 */
export async function listProjectPacks(): Promise<ProjectPack[]> {
  const res = await apiFetch("/api/project-packs");
  if (!res.ok) throw new Error(`Failed to list project packs: ${res.status}`);
  return res.json();
}

/**
 * Fork a project pack into a new project. The host applies
 * the manifest's pluginIds + contentPackIds + initialConfig +
 * initialWorldContent in one server round-trip; the user
 * opens the resulting project and the world is fully
 * configured.
 */
export async function forkProjectPack(input: {
  projectPackId: string;
  teamId: string;
  gameId: string;
  name?: string;
  description?: string | null;
}): Promise<{
  ok: true;
  projectId: string;
  forkedFrom: string;
}> {
  const res = await apiFetch("/api/project-packs/fork", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ? ` — ${body.message}` : "";
    } catch {
      /* ignore non-json error bodies */
    }
    throw new Error(`Failed to fork project pack: ${res.status}${detail}`);
  }
  return res.json();
}

/**
 * Patch the project's `worldContent` with a partial overlay.
 * Used by agent actions (PROPOSE_NPC_PLACEMENT, etc.) so the
 * agent's authored content persists into the project — surviving
 * reload and shipping on Publish.
 *
 * Phase B0'.G of `PLAN_PROJECT_AS_DATA.md`. Top-level keys
 * (`npcs`, `zones`, `spawns`, `quests`, `uiPack`) overlay onto
 * the existing content; explicit `null` removes a key.
 */
export async function patchProjectWorldContent(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<WorldProjectSummary> {
  const res = await apiFetch(`/api/world/projects/${projectId}/world-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to patch world content: ${res.status} ${text || res.statusText}`,
    );
  }
  return res.json();
}

/**
 * Replace the project's installed plugin set. Hits
 * `POST /api/world/projects/:projectId/plugins`. The new list
 * is persisted, the project version bumps, and the BEFORE state
 * is snapshotted into the revision history (same pattern as
 * `setProjectAssetPacks`).
 *
 * Each id is an npm-style package name (`@hyperforge/hyperscape`).
 * Empty list = no plugins.
 */
export async function setProjectPlugins(
  projectId: string,
  plugins: ReadonlyArray<string>,
): Promise<WorldProjectSummary> {
  const res = await apiFetch(
    `/api/world/projects/${encodeURIComponent(projectId)}/plugins`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plugins: [...plugins] }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Failed to update plugins: ${text}`);
  }
  return res.json();
}

/**
 * Project revision history (G1). One row per write that bumped
 * the project's typed-layer state. Newest first.
 */
export interface ProjectRevisionSummary {
  id: string;
  projectId: string;
  version: number;
  author: "user" | "agent" | "system" | string;
  authorId: string | null;
  changeReason: string | null;
  schemaVersion: number;
  config: unknown;
  plugins: ReadonlyArray<string>;
  worldContent: unknown;
  templateId: string | null;
  createdAt: string;
}

export async function listProjectRevisions(
  projectId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ReadonlyArray<ProjectRevisionSummary>> {
  const params = new URLSearchParams();
  if (typeof options.limit === "number")
    params.set("limit", String(options.limit));
  if (typeof options.offset === "number")
    params.set("offset", String(options.offset));
  const qs = params.toString();
  const url = `/api/world/projects/${projectId}/revisions${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to list project revisions: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
}

/**
 * G1.b — restore a project to a prior revision. The current state
 * is snapshotted into a new revision before the write so the
 * restore is reversible.
 */
export async function restoreProjectRevision(
  projectId: string,
  revisionId: string,
): Promise<WorldProjectSummary> {
  const res = await apiFetch(
    `/api/world/projects/${projectId}/revisions/${revisionId}/restore`,
    { method: "POST" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to restore revision: ${res.status} ${text || res.statusText}`,
    );
  }
  return res.json();
}

export async function saveWorldProject(
  projectId: string,
  data: { worldData: unknown; manifestSnapshot?: unknown },
): Promise<WorldProjectDetail> {
  const res = await apiFetch(`/api/world/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save project: ${res.status}`);
  return res.json();
}

export async function deleteWorldProject(projectId: string): Promise<void> {
  const res = await apiFetch(`/api/world/projects/${projectId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.status}`);
}

export async function acquireProjectLock(
  projectId: string,
): Promise<LockResult> {
  const res = await apiFetch(`/api/world/projects/${projectId}/lock`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to acquire lock: ${res.status}`);
  return res.json();
}

export async function releaseProjectLock(projectId: string): Promise<void> {
  const res = await apiFetch(`/api/world/projects/${projectId}/unlock`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to release lock: ${res.status}`);
}
