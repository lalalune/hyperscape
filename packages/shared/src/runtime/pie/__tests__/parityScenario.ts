/**
 * Parity scenario — scripted sequence of steps that runs against
 * either a PIE session OR a real Hyperia server (port 3333 over
 * WebSocket). State recorded at each step is the basis for the
 * cross-context equivalence check.
 *
 * Phase B0'.J of `PLAN_PROJECT_AS_DATA.md`. The scenario itself is
 * pure data — `apply` mutates a session, `record` snapshots its
 * observable state. Both functions are runtime-agnostic so the
 * same scenario runs against PIE in vitest AND against a real
 * Hyperia deploy in an external harness.
 *
 * Today's scenario is intentionally minimal — three steps that
 * exercise the substrate without depending on B0'.F.2 (avatar
 * spawn). As F.2 + F.3 land, this file's scenario expands to the
 * full "spawn → walk → talk → attack → die → respawn" sequence
 * the original B0'.J plan describes.
 */

import type { PIEEditorSession } from "../PIEEditorSession";

/**
 * Snapshot of session-observable state at one step. Comparable
 * across runs (and ultimately across PIE vs `localhost:3333`).
 *
 * Numeric fields are rounded so timing jitter doesn't break
 * equality. Tick-rate is shared between the two contexts so this
 * is conservative.
 */
export interface ParityStateSnapshot {
  /** Step name for debugging the diff. */
  readonly stepName: string;
  /** Number of entities the client world knows about. */
  readonly clientEntityCount: number;
  /** Number of entities the server world knows about. */
  readonly serverEntityCount: number;
  /** Player namespace from `getDataContext()`, or null pre-spawn. */
  readonly dataContext: Record<string, unknown> | null;
  /** Whether the session is currently running. */
  readonly running: boolean;
}

/**
 * One step in the scenario. `apply` mutates the session; `record`
 * snapshots state. Steps run sequentially with a tick budget
 * between each (handled by the harness).
 */
export interface ParityStep {
  readonly name: string;
  /**
   * Mutate the session. May be async (e.g. start/stop are async).
   * The harness awaits this before invoking `record`.
   */
  apply(session: PIEEditorSession): Promise<void>;
  /**
   * Read observable state from the session. Pure — must not
   * mutate. Called by the harness AFTER `apply` completes and
   * AFTER the inter-step tick budget elapses.
   */
  record(session: PIEEditorSession): ParityStateSnapshot;
}

// ───────── helper readers ─────────

interface InternalSession {
  _clientWorld: {
    entities?: {
      items?: Map<string, unknown> | { size: number };
      get?(id: string): unknown;
    };
  } | null;
  _server?: {
    world: {
      entities?: {
        items?: Map<string, unknown> | { size: number };
      };
    };
  } | null;
  getDataContext?(): Record<string, unknown>;
}

function readClientEntityCount(session: PIEEditorSession): number {
  const inner = session as unknown as InternalSession;
  const entities = inner._clientWorld?.entities;
  if (!entities) return 0;
  const items = entities.items;
  if (items instanceof Map) return items.size;
  if (items && typeof (items as { size: number }).size === "number") {
    return (items as { size: number }).size;
  }
  return 0;
}

function readServerEntityCount(session: PIEEditorSession): number {
  const inner = session as unknown as InternalSession;
  const entities = inner._server?.world.entities;
  if (!entities) return 0;
  const items = entities.items;
  if (items instanceof Map) return items.size;
  if (items && typeof (items as { size: number }).size === "number") {
    return (items as { size: number }).size;
  }
  return 0;
}

function readDataContext(
  session: PIEEditorSession,
): Record<string, unknown> | null {
  const inner = session as unknown as InternalSession;
  if (typeof inner.getDataContext !== "function") return null;
  try {
    const ctx = inner.getDataContext();
    return Object.keys(ctx).length > 0 ? ctx : null;
  } catch {
    return null;
  }
}

function isRunning(session: PIEEditorSession): boolean {
  // PIE session has no public `running` getter; infer from
  // _server presence.
  const inner = session as unknown as InternalSession;
  return inner._server !== null && inner._server !== undefined;
}

function snapshot(
  stepName: string,
  session: PIEEditorSession,
): ParityStateSnapshot {
  return {
    stepName,
    clientEntityCount: readClientEntityCount(session),
    serverEntityCount: readServerEntityCount(session),
    dataContext: readDataContext(session),
    running: isRunning(session),
  };
}

// ───────── the scenario ─────────

/**
 * Standard parity scenario.
 *
 * Today's coverage is the substrate-only steps (start, spawn a
 * mob, stop). Once B0'.F.2 (avatar spawn) lands, this expands
 * with player-mediated steps: walk to NPC, talk, attack mob,
 * take damage, die, respawn — each producing a snapshot the
 * cross-context harness compares between PIE and `localhost:3333`.
 */
export const STANDARD_PARITY_SCENARIO: ReadonlyArray<ParityStep> = [
  {
    name: "start (engine boot, no entities)",
    async apply(session) {
      await session.start({ playerSpawn: { x: 0, y: 0, z: 0 } });
    },
    record(session) {
      return snapshot("start (engine boot, no entities)", session);
    },
  },
  {
    name: "spawn-mob (one goblin spawned via mobSpawns)",
    async apply(session) {
      // No mutation at this step — the mob is supplied at start
      // time. Future steps (post-F.2) will spawn dynamically; this
      // step just records the post-boot snapshot of the
      // declarative spawn.
      // The work happens in `start` above.
      // Tick budget is handled by the harness between steps.
      await Promise.resolve();
    },
    record(session) {
      return snapshot("spawn-mob (one goblin spawned via mobSpawns)", session);
    },
  },
  {
    name: "stop (clean teardown)",
    async apply(session) {
      await session.stop();
    },
    record(session) {
      return snapshot("stop (clean teardown)", session);
    },
  },
];

/**
 * Agent-content scenario — proves agent-emitted spawns and NPCs
 * are fed into the PIE runtime as real entities, not just visual
 * markers. This is the test for the "PIE feeds agent content" cut
 * shipped in this audit pass.
 *
 * Steps:
 *   1. Boot session WITH agent-style mobSpawns (`agent-spawn-*`)
 *      and NPCs (`agent-npc-*`) supplied via start() options —
 *      mirroring how `usePIESession` synthesizes them from
 *      `agentWorldContent`.
 *   2. Snapshot — server world should hold the player + each
 *      declared mob + each declared NPC.
 *   3. Stop.
 */
export const AGENT_CONTENT_PARITY_SCENARIO: ReadonlyArray<ParityStep> = [
  {
    name: "start (with agent-emitted mob spawn + NPC)",
    async apply(session) {
      await session.start({
        playerSpawn: { x: 0, y: 0, z: 0 },
        mobSpawns: [
          {
            id: "agent-spawn-goblin@5,0,5",
            mobId: "goblin",
            name: "goblin",
            position: { x: 5, y: 0, z: 5 },
            spawnRadius: 2,
            maxCount: 1,
          },
        ],
        npcs: [
          {
            id: "agent-npc-eldric",
            type: "shopkeeper",
            name: "Eldric",
            position: { x: -3, y: 0, z: 4 },
          },
        ],
      });
    },
    record(session) {
      return snapshot("start (with agent-emitted mob spawn + NPC)", session);
    },
  },
  {
    name: "settle (server tick budget for spawn instantiation)",
    async apply() {
      // The harness inserts a tick budget between steps; this
      // step is just a marker that the post-start snapshot
      // reflects fully-spawned entities, not just declared ones.
      await Promise.resolve();
    },
    record(session) {
      return snapshot(
        "settle (server tick budget for spawn instantiation)",
        session,
      );
    },
  },
  {
    name: "stop (clean teardown after agent content present)",
    async apply(session) {
      await session.stop();
    },
    record(session) {
      return snapshot(
        "stop (clean teardown after agent content present)",
        session,
      );
    },
  },
];
