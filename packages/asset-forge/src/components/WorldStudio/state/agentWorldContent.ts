/**
 * agentWorldContent — World-Studio-local state holder for
 * agent-emitted *world content* (NPC placements, zones, spawn
 * tables, quests).
 *
 * Phase B1 of `PLAN_AAA_QUALITY.md`. Mirrors the pattern in
 * `agentPack.ts` (module-level state + listener Set +
 * `useSyncExternalStore` hook) so the editor's rendering pipeline
 * can subscribe to agent-authored content without round-tripping
 * to the server.
 *
 * The store keeps a separate keyed map per content type so each
 * action can update its slice independently. The B1.2 slice only
 * populates `npcs`; later slices add zones/spawns/quests.
 *
 * Lifecycle:
 *   1. AutomationPanel.onPackReceived dispatches a world-content
 *      payload to `setAgentNpc(...)` / `setAgentZone(...)` etc.
 *   2. ViewportContainer subscribes via `useAgentWorldContent()`
 *      and merges the entries into its rendering pipeline next to
 *      designer-placed content.
 *   3. `clearAgentWorldContent()` empties every slice so the
 *      designer's view goes back to just the manifest content.
 */

import { useSyncExternalStore } from "react";
import {
  QuestSchema,
  WorldAreaMobSpawnSchema,
  WorldAreaNPCSchema,
  WorldAreaResourceSchema,
  WorldAreaSchema,
  WorldAreaStationSchema,
  type Quest,
  type WorldArea,
  type WorldAreaMobSpawn,
  type WorldAreaNPC,
  type WorldAreaResource,
  type WorldAreaStation,
} from "@hyperforge/manifest-schema";
import { patchProjectWorldContent } from "../../../utils/worldProjectApi";

export interface AgentWorldContent {
  readonly npcs: ReadonlyMap<string, WorldAreaNPC>;
  readonly zones: ReadonlyMap<string, WorldArea>;
  readonly spawns: ReadonlyMap<string, WorldAreaMobSpawn>;
  readonly quests: ReadonlyMap<string, Quest>;
  /**
   * Gathering resources placed by the agent — trees, rocks,
   * fishing spots, etc. Keyed by composite resourceId+position
   * (resources don't have a unique top-level id, so two oak trees
   * at different points each get their own entry).
   */
  readonly resources: ReadonlyMap<string, WorldAreaResource>;
  /**
   * Crafting stations placed by the agent — anvils, furnaces,
   * cooking ranges, banks. Keyed by station `id` (unique per pack).
   */
  readonly stations: ReadonlyMap<string, WorldAreaStation>;
}

let state: AgentWorldContent = {
  npcs: new Map(),
  zones: new Map(),
  spawns: new Map(),
  quests: new Map(),
  resources: new Map(),
  stations: new Map(),
};
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

interface ValidationFail {
  readonly ok: false;
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
}
interface ValidationOk<T> {
  readonly ok: true;
  readonly entity: T;
}

function issuesFrom(err: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}): ReadonlyArray<{ path: string; message: string }> {
  return err.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
}

/**
 * Validate + store an NPC placement. Replaces any existing entry
 * with the same id. The schema is the same one
 * `PROPOSE_NPC_PLACEMENT` validates against, so this is a
 * defensive re-check at the editor seam.
 */
export function setAgentNpc(
  raw: WorldAreaNPC | unknown,
): ValidationOk<WorldAreaNPC> | ValidationFail {
  const result = WorldAreaNPCSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }
  const entity = result.data;
  const npcs = new Map(state.npcs);
  npcs.set(entity.id, entity);
  state = { ...state, npcs };
  notify();
  return { ok: true, entity };
}

export function setAgentZone(
  raw: WorldArea | unknown,
): ValidationOk<WorldArea> | ValidationFail {
  const result = WorldAreaSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }
  const entity = result.data;
  const zones = new Map(state.zones);
  zones.set(entity.id, entity);
  state = { ...state, zones };
  notify();
  return { ok: true, entity };
}

export function setAgentSpawn(
  raw: WorldAreaMobSpawn | unknown,
  spawnKey: string,
): ValidationOk<WorldAreaMobSpawn> | ValidationFail {
  const result = WorldAreaMobSpawnSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }
  const entity = result.data;
  const spawns = new Map(state.spawns);
  spawns.set(spawnKey, entity);
  state = { ...state, spawns };
  notify();
  return { ok: true, entity };
}

/**
 * Validate + store a gathering resource. Resources don't have a
 * unique top-level id, so the caller passes a composite key
 * (typically `resourceKey(resourceId, position)`). Same pattern
 * as mob spawns.
 */
export function setAgentResource(
  raw: WorldAreaResource | unknown,
  resourceKey: string,
): ValidationOk<WorldAreaResource> | ValidationFail {
  const result = WorldAreaResourceSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }
  const entity = result.data;
  const resources = new Map(state.resources);
  resources.set(resourceKey, entity);
  state = { ...state, resources };
  notify();
  return { ok: true, entity };
}

/**
 * Validate + store a crafting station. Stations have a unique id
 * (anvil-1, smithy-furnace), so we key by id directly — same
 * pattern as NPCs.
 */
export function setAgentStation(
  raw: WorldAreaStation | unknown,
): ValidationOk<WorldAreaStation> | ValidationFail {
  const result = WorldAreaStationSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }
  const entity = result.data;
  const stations = new Map(state.stations);
  stations.set(entity.id, entity);
  state = { ...state, stations };
  notify();
  return { ok: true, entity };
}

/**
 * Validate + store a quest. Replaces any existing quest with the
 * same id (the schema requires `id`). Phase A1 of the AAA gap audit.
 */
export function setAgentQuest(
  raw: Quest | unknown,
): ValidationOk<Quest> | ValidationFail {
  const result = QuestSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: issuesFrom(result.error) };
  }
  const entity = result.data;
  const quests = new Map(state.quests);
  quests.set(entity.id, entity);
  state = { ...state, quests };
  notify();
  return { ok: true, entity };
}

/**
 * Phase B4 of the AAA gap audit. Replace the in-memory store with
 * a fresh snapshot built from a project's `worldContent`. Called
 * by `useProjectLoader` after the project loads from the server,
 * so a refresh doesn't lose the agent's prior work.
 *
 * Each entry is re-validated against its schema. Malformed entries
 * are dropped silently (the store cannot hold invalid data) and
 * counted in the return value so the caller can surface a warning.
 *
 * Spawn keys: spawns have no schema-level id, so we recompose the
 * same `mobId@x,y,z` key the companion uses when persisting agent
 * emissions. This means "two goblin spawns at exactly the same
 * point" collapses to one entry — which is correct (the schema
 * allows multiple ids but the runtime would render them on top of
 * each other anyway).
 */
export function rehydrateAgentWorldContentFromProject(
  worldContent: Record<string, unknown> | null | undefined,
): {
  npcs: number;
  spawns: number;
  zones: number;
  quests: number;
  resources: number;
  stations: number;
  dropped: number;
} {
  const wc = worldContent ?? {};
  const npcs = new Map<string, WorldAreaNPC>();
  const spawns = new Map<string, WorldAreaMobSpawn>();
  const zones = new Map<string, WorldArea>();
  const quests = new Map<string, Quest>();
  const resources = new Map<string, WorldAreaResource>();
  const stations = new Map<string, WorldAreaStation>();
  let dropped = 0;

  if (Array.isArray(wc.npcs)) {
    for (const raw of wc.npcs as unknown[]) {
      const r = WorldAreaNPCSchema.safeParse(raw);
      if (r.success) npcs.set(r.data.id, r.data);
      else dropped++;
    }
  }
  if (Array.isArray(wc.spawns)) {
    for (const raw of wc.spawns as unknown[]) {
      const r = WorldAreaMobSpawnSchema.safeParse(raw);
      if (r.success) {
        const s = r.data;
        const key = `${s.mobId}@${s.position.x},${s.position.y},${s.position.z}`;
        spawns.set(key, s);
      } else {
        dropped++;
      }
    }
  }
  if (Array.isArray(wc.zones)) {
    for (const raw of wc.zones as unknown[]) {
      const r = WorldAreaSchema.safeParse(raw);
      if (r.success) zones.set(r.data.id, r.data);
      else dropped++;
    }
  }
  if (Array.isArray(wc.quests)) {
    for (const raw of wc.quests as unknown[]) {
      const r = QuestSchema.safeParse(raw);
      if (r.success) quests.set(r.data.id, r.data);
      else dropped++;
    }
  }
  if (Array.isArray(wc.resources)) {
    for (const raw of wc.resources as unknown[]) {
      const r = WorldAreaResourceSchema.safeParse(raw);
      if (r.success) {
        const res = r.data;
        const key = `${res.resourceId}@${res.position.x},${res.position.y},${res.position.z}`;
        resources.set(key, res);
      } else {
        dropped++;
      }
    }
  }
  if (Array.isArray(wc.stations)) {
    for (const raw of wc.stations as unknown[]) {
      const r = WorldAreaStationSchema.safeParse(raw);
      if (r.success) stations.set(r.data.id, r.data);
      else dropped++;
    }
  }

  state = { npcs, zones, spawns, quests, resources, stations };
  notify();

  return {
    npcs: npcs.size,
    spawns: spawns.size,
    zones: zones.size,
    quests: quests.size,
    resources: resources.size,
    stations: stations.size,
    dropped,
  };
}

/**
 * Remove an entity from the agent-world-content store by its
 * native key (npc/quest/zone use schema id; mobSpawn uses the
 * composite `mobId@x,y,z` the companion uses for persistence).
 *
 * Phase A4 of the AAA gap audit. Companion + dialog call this
 * when the agent emits `REMOVE_FROM_PROJECT`. Returns true if
 * the entity was found and removed; false if it wasn't present.
 */
export function removeAgentEntity(
  kind: "npc" | "quest" | "zone" | "mobSpawn" | "resource" | "station",
  key: string,
): boolean {
  switch (kind) {
    case "npc": {
      if (!state.npcs.has(key)) return false;
      const npcs = new Map(state.npcs);
      npcs.delete(key);
      state = { ...state, npcs };
      notify();
      return true;
    }
    case "quest": {
      if (!state.quests.has(key)) return false;
      const quests = new Map(state.quests);
      quests.delete(key);
      state = { ...state, quests };
      notify();
      return true;
    }
    case "zone": {
      if (!state.zones.has(key)) return false;
      const zones = new Map(state.zones);
      zones.delete(key);
      state = { ...state, zones };
      notify();
      return true;
    }
    case "mobSpawn": {
      if (!state.spawns.has(key)) return false;
      const spawns = new Map(state.spawns);
      spawns.delete(key);
      state = { ...state, spawns };
      notify();
      return true;
    }
    case "resource": {
      if (!state.resources.has(key)) return false;
      const resources = new Map(state.resources);
      resources.delete(key);
      state = { ...state, resources };
      notify();
      return true;
    }
    case "station": {
      if (!state.stations.has(key)) return false;
      const stations = new Map(state.stations);
      stations.delete(key);
      state = { ...state, stations };
      notify();
      return true;
    }
  }
}

/**
 * Compose the `mobId@x,y,z` key the companion / rehydrator both
 * use. Exported so removal-by-position lookups can build the key
 * the same way without duplicating the logic.
 */
export function mobSpawnKey(
  mobId: string,
  position: { x: number; y: number; z: number },
): string {
  return `${mobId}@${position.x},${position.y},${position.z}`;
}

/**
 * Compose the `resourceId@x,y,z` key for resource entries.
 * Same pattern as mobSpawnKey — resources don't have unique ids
 * (multiple oak trees are all `tree_oak`), so position
 * disambiguates.
 */
export function resourceKey(
  resourceId: string,
  position: { x: number; y: number; z: number },
): string {
  return `${resourceId}@${position.x},${position.y},${position.z}`;
}

/**
 * Convenience wrapper: remove + persist. The persistence step
 * regenerates the worldContent patch from the post-removal store
 * state, so an empty slot serializes as an empty array.
 */
export async function removeAndPersistAgentEntity(
  projectId: string | null,
  kind: "npc" | "quest" | "zone" | "mobSpawn" | "resource" | "station",
  key: string,
): Promise<
  | { ok: true; removed: boolean }
  | { ok: false; stage: "persist"; error: string }
> {
  const removed = removeAgentEntity(kind, key);
  // Persist regardless — the agent may have removed an entity
  // that's still in the project but not in the local store yet
  // (rehydration race), and we want the persisted state to match
  // the post-removal local store either way.
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, removed };
}

export function clearAgentWorldContent(): void {
  if (
    state.npcs.size === 0 &&
    state.zones.size === 0 &&
    state.spawns.size === 0 &&
    state.quests.size === 0 &&
    state.resources.size === 0 &&
    state.stations.size === 0
  ) {
    return;
  }
  state = {
    npcs: new Map(),
    zones: new Map(),
    spawns: new Map(),
    quests: new Map(),
    resources: new Map(),
    stations: new Map(),
  };
  notify();
}

export function getAgentWorldContent(): AgentWorldContent {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SSR_SNAPSHOT: AgentWorldContent = {
  npcs: new Map(),
  zones: new Map(),
  spawns: new Map(),
  quests: new Map(),
  resources: new Map(),
  stations: new Map(),
};

/**
 * React hook — re-renders when any slice of the agent-world
 * content store changes. Consumers typically read just one slice
 * (e.g. `useAgentWorldContent().npcs`) and `useMemo` over it.
 */
export function useAgentWorldContent(): AgentWorldContent {
  return useSyncExternalStore(
    subscribe,
    getAgentWorldContent,
    () => SSR_SNAPSHOT,
  );
}

// ============== Phase B0'.G — Project persistence ==============

interface PersistOk {
  readonly ok: true;
}
interface PersistFail {
  readonly ok: false;
  readonly error: string;
}

/**
 * Snapshot the current local agent-world-content store and POST
 * it to the active project as a `worldContent` patch. After this
 * resolves, the agent's NPC / zone / spawn content is persisted
 * server-side and survives reload.
 *
 * Phase B0'.G of `PLAN_PROJECT_AS_DATA.md`. Today's local store
 * still drives the editor's viewport (so designer-feedback is
 * instant); this function is the durability path. Future cut
 * (B0'.G.2) flips reads to come from the project's worldContent
 * directly, retiring the local store as a transient cache.
 *
 * Caller is `AutomationPanel.onPackReceived` / equivalent —
 * pass the active project id from `state.project.currentProjectId`.
 * No-ops with `{ ok: false, error: "no active project" }` when
 * called without a project loaded.
 */
export async function persistAgentWorldContentToProject(
  projectId: string | null,
): Promise<PersistOk | PersistFail> {
  if (!projectId) {
    return { ok: false, error: "no active project" };
  }
  const snapshot = state;
  // Convert ReadonlyMap → array for the JSON wire format. Matches
  // the shape `ProjectWorldContentSchema` in manifest-schema
  // expects: `{ npcs?: WorldAreaNPC[], zones?: WorldArea[], ... }`.
  const patch: Record<string, unknown> = {};
  if (snapshot.npcs.size > 0) {
    patch.npcs = Array.from(snapshot.npcs.values());
  }
  if (snapshot.zones.size > 0) {
    patch.zones = Array.from(snapshot.zones.values());
  }
  if (snapshot.spawns.size > 0) {
    patch.spawns = Array.from(snapshot.spawns.values());
  }
  if (snapshot.quests.size > 0) {
    patch.quests = Array.from(snapshot.quests.values());
  }
  if (snapshot.resources.size > 0) {
    patch.resources = Array.from(snapshot.resources.values());
  }
  if (snapshot.stations.size > 0) {
    patch.stations = Array.from(snapshot.stations.values());
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  try {
    await patchProjectWorldContent(projectId, patch);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * One-shot: validate a single NPC, update the local store, then
 * persist to the project. Convenience wrapper combining
 * `setAgentNpc(...)` + `persistAgentWorldContentToProject(...)`.
 *
 * Returns the union of validation + persistence outcomes so the
 * caller can branch on either failure mode.
 */
export async function setAndPersistAgentNpc(
  projectId: string | null,
  raw: WorldAreaNPC | unknown,
): Promise<
  | { ok: true; entity: WorldAreaNPC }
  | { ok: false; stage: "validate"; issues: ValidationFail["issues"] }
  | { ok: false; stage: "persist"; error: string }
> {
  const validation = setAgentNpc(raw);
  if (!validation.ok) {
    return { ok: false, stage: "validate", issues: validation.issues };
  }
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, entity: validation.entity };
}

/**
 * Validate + store + persist a mob spawn in one shot.
 * Phase A2 of the AAA gap audit.
 *
 * Spawn keys aren't part of the schema (mob spawns don't have an
 * `id` field — multiple goblin spawns can coexist). The caller
 * provides a key (e.g. `"agent-spawn-0"`, `"agent-spawn-1"`); the
 * dialog passes the run-relative index for stable identity within
 * a single agent run.
 */
export async function setAndPersistAgentSpawn(
  projectId: string | null,
  raw: WorldAreaMobSpawn | unknown,
  spawnKey: string,
): Promise<
  | { ok: true; entity: WorldAreaMobSpawn }
  | { ok: false; stage: "validate"; issues: ValidationFail["issues"] }
  | { ok: false; stage: "persist"; error: string }
> {
  const validation = setAgentSpawn(raw, spawnKey);
  if (!validation.ok) {
    return { ok: false, stage: "validate", issues: validation.issues };
  }
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, entity: validation.entity };
}

/** Validate + store + persist a gathering resource. Same pattern as spawns. */
export async function setAndPersistAgentResource(
  projectId: string | null,
  raw: WorldAreaResource | unknown,
  resourceKeyValue: string,
): Promise<
  | { ok: true; entity: WorldAreaResource }
  | { ok: false; stage: "validate"; issues: ValidationFail["issues"] }
  | { ok: false; stage: "persist"; error: string }
> {
  const validation = setAgentResource(raw, resourceKeyValue);
  if (!validation.ok) {
    return { ok: false, stage: "validate", issues: validation.issues };
  }
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, entity: validation.entity };
}

/** Validate + store + persist a crafting station. */
export async function setAndPersistAgentStation(
  projectId: string | null,
  raw: WorldAreaStation | unknown,
): Promise<
  | { ok: true; entity: WorldAreaStation }
  | { ok: false; stage: "validate"; issues: ValidationFail["issues"] }
  | { ok: false; stage: "persist"; error: string }
> {
  const validation = setAgentStation(raw);
  if (!validation.ok) {
    return { ok: false, stage: "validate", issues: validation.issues };
  }
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, entity: validation.entity };
}

/**
 * Validate + store + persist a zone. Mirrors the npc/quest path.
 */
export async function setAndPersistAgentZone(
  projectId: string | null,
  raw: WorldArea | unknown,
): Promise<
  | { ok: true; entity: WorldArea }
  | { ok: false; stage: "validate"; issues: ValidationFail["issues"] }
  | { ok: false; stage: "persist"; error: string }
> {
  const validation = setAgentZone(raw);
  if (!validation.ok) {
    return { ok: false, stage: "validate", issues: validation.issues };
  }
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, entity: validation.entity };
}

/**
 * Validate + store + persist a quest. Phase A1 of the AAA gap audit.
 */
export async function setAndPersistAgentQuest(
  projectId: string | null,
  raw: Quest | unknown,
): Promise<
  | { ok: true; entity: Quest }
  | { ok: false; stage: "validate"; issues: ValidationFail["issues"] }
  | { ok: false; stage: "persist"; error: string }
> {
  const validation = setAgentQuest(raw);
  if (!validation.ok) {
    return { ok: false, stage: "validate", issues: validation.issues };
  }
  const persist = await persistAgentWorldContentToProject(projectId);
  if (!persist.ok) {
    return { ok: false, stage: "persist", error: persist.error };
  }
  return { ok: true, entity: validation.entity };
}
