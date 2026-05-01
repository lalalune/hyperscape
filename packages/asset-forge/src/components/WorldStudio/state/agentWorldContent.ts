/**
 * agentWorldContent — World-Studio-local state holder for the
 * subset of agent-emitted *world content* that doesn't yet have a
 * `Placed*` counterpart in `extendedLayers`: namely **quests** and
 * **zones**.
 *
 * P0.5.b of `PLAN_AGENT_STUDIO_PARITY.md`. The five placement
 * kinds (NPCs, mob spawns, resources, stations, teleports) used to
 * land here in a parallel store; they now flow through the studio
 * reducer into `extendedLayers` (P0.3 emit + P0.6 rehydrate),
 * sharing the gizmo / property-panel / outliner machinery with
 * designer + procgen entries. This file is what's left for quests
 * + zones — both will follow the same pattern in P0.7+ once they
 * gain Placed* counterparts.
 *
 * Lifecycle:
 *   1. Companion's `applyTurnSideEffects` calls
 *      `setAndPersistAgentQuest` / `setAndPersistAgentZone` when
 *      the agent emits PROPOSE_QUEST / PROPOSE_ZONE.
 *   2. OutlinerPanel.buildAgentContentNode subscribes via
 *      `useAgentWorldContent()` and shows the entries under the
 *      "AI Generated" subtree.
 *   3. `useProjectLoader` calls
 *      `rehydrateAgentWorldContentFromProject` on project load to
 *      restore quests + zones from the persisted `worldContent`.
 *   4. `clearAgentWorldContent()` empties the maps.
 */

import { useSyncExternalStore } from "react";
import {
  QuestSchema,
  WorldAreaSchema,
  type Quest,
  type WorldArea,
} from "@hyperforge/manifest-schema";
import { patchProjectWorldContent } from "../../../utils/worldProjectApi";

export interface AgentWorldContent {
  readonly zones: ReadonlyMap<string, WorldArea>;
  readonly quests: ReadonlyMap<string, Quest>;
}

let state: AgentWorldContent = {
  zones: new Map(),
  quests: new Map(),
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
 * Validate + store a zone (named bounded region). Replaces any
 * existing zone with the same id.
 */
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

/**
 * Validate + store a quest. Replaces any existing quest with the
 * same id.
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
 * Replace the in-memory store with a fresh snapshot built from a
 * project's `worldContent`. Called by `useProjectLoader` after the
 * project loads from the server.
 *
 * P0.5.b: scope reduced to quests + zones. The five placement
 * kinds are rehydrated by
 * `rehydrateExtendedLayersFromWorldContent` instead — see
 * `utils/rehydrateExtendedLayers.ts`.
 *
 * Each entry is re-validated against its schema. Malformed entries
 * are dropped silently (the store cannot hold invalid data) and
 * counted in the return value so the caller can surface a warning.
 */
export function rehydrateAgentWorldContentFromProject(
  worldContent: Record<string, unknown> | null | undefined,
): {
  zones: number;
  quests: number;
  dropped: number;
} {
  const wc = worldContent ?? {};
  const zones = new Map<string, WorldArea>();
  const quests = new Map<string, Quest>();
  let dropped = 0;

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

  state = { zones, quests };
  notify();

  return {
    zones: zones.size,
    quests: quests.size,
    dropped,
  };
}

/**
 * Remove a quest or zone from the agent-world-content store by id.
 * Returns true if the entity was found and removed; false if it
 * wasn't present.
 *
 * Placement removals (npc / mobSpawn / resource / station /
 * teleport) go through the studio reducer's `actions.removeNPC` /
 * `removeMobSpawn` / etc. — see WorldStudioCompanion's removal
 * branch.
 */
export function removeAgentEntity(
  kind: "quest" | "zone",
  key: string,
): boolean {
  switch (kind) {
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
  }
}

/**
 * Convenience wrapper: remove + persist. The persistence step
 * regenerates the worldContent patch from the post-removal store
 * state, so an empty slot serializes as an empty array.
 */
export async function removeAndPersistAgentEntity(
  projectId: string | null,
  kind: "quest" | "zone",
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
  if (state.zones.size === 0 && state.quests.size === 0) {
    return;
  }
  state = {
    zones: new Map(),
    quests: new Map(),
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
  zones: new Map(),
  quests: new Map(),
};

/**
 * React hook — re-renders when the quest or zone slice of the
 * agent-world-content store changes.
 */
export function useAgentWorldContent(): AgentWorldContent {
  return useSyncExternalStore(
    subscribe,
    getAgentWorldContent,
    () => SSR_SNAPSHOT,
  );
}

// ============== Project persistence ==============

interface PersistOk {
  readonly ok: true;
}
interface PersistFail {
  readonly ok: false;
  readonly error: string;
}

/**
 * Snapshot the current local agent-world-content store and POST
 * it to the active project as a `worldContent` patch.
 *
 * P0.5.b: only patches quests + zones. The five placement kinds
 * are persisted via `useAutoSave` (which serializes
 * `extendedLayers`); they don't flow through this path anymore.
 */
export async function persistAgentWorldContentToProject(
  projectId: string | null,
): Promise<PersistOk | PersistFail> {
  if (!projectId) {
    return { ok: false, error: "no active project" };
  }
  const snapshot = state;
  const patch: Record<string, unknown> = {};
  if (snapshot.zones.size > 0) {
    patch.zones = Array.from(snapshot.zones.values());
  }
  if (snapshot.quests.size > 0) {
    patch.quests = Array.from(snapshot.quests.values());
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
 * Validate + store + persist a zone in one shot.
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
 * Validate + store + persist a quest in one shot.
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
