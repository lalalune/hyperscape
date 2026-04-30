/**
 * Run the parity scenario against a real `localhost:3333` Hyperia
 * deploy over a real WebSocket. Companion to
 * `recordScenarioInPIE` — together they produce the two
 * recordings the cross-context parity smoke diffs.
 *
 * Phase B0'.J of `PLAN_PROJECT_AS_DATA.md`. THIS IMPLEMENTATION IS
 * CURRENTLY A STUB.
 *
 * Why stubbed: the standard parity scenario depends on player-
 * mediated steps (walk, talk, attack, die, respawn). Those steps
 * can't run against PIE today because B0'.F.2 (avatar spawn in PIE)
 * isn't shipped yet — there's no controllable PlayerLocal in PIE,
 * so any PIE-side run of those steps would skip them. Comparing a
 * fully-played localhost recording against a half-played PIE
 * recording would produce mismatches that aren't real regressions.
 *
 * The function shape is established so:
 *   1. Tests can import and call it without TypeScript errors
 *   2. The future implementation slots in by replacing the stub
 *      body with a WebSocket harness (using `ws` or similar)
 *   3. CI can call it with `skipUnlessAvailable: true` and
 *      gracefully no-op until the stub is filled in
 *
 * Filling in the stub is its own focused slice (B0'.J.2):
 *   - WebSocket connection to `ws://localhost:3333`
 *   - Privy auth handshake (or test bypass)
 *   - Translate scenario steps to network packets
 *   - Listen for `entityAdded` / state replication
 *   - Build `ParityStateSnapshot`s from received packets
 */

import type { ParityStateSnapshot, ParityStep } from "./parityScenario";
import type { ScenarioRunOk, ScenarioRunFail } from "./recordScenario";

export interface LocalhostHyperiaRunOptions {
  /**
   * If `true`, the runner reports a no-op success when localhost
   * isn't reachable. Useful for vitest environments where the
   * dev server isn't running.
   */
  readonly skipUnlessAvailable?: boolean;
  /** WebSocket URL. Defaults to `ws://localhost:3333`. */
  readonly wsUrl?: string;
  /** Timeout per scenario step (ms). Defaults to 10s. */
  readonly stepTimeoutMs?: number;
}

/**
 * Stub. Returns a structured "stubbed" outcome so callers can
 * branch on it without surprise.
 */
export interface ScenarioRunStubbed {
  readonly ok: false;
  readonly stubbed: true;
  readonly reason: string;
  readonly recording: ReadonlyArray<ParityStateSnapshot>;
}

export async function runScenarioInLocalhostHyperia(
  _scenario: ReadonlyArray<ParityStep>,
  options: LocalhostHyperiaRunOptions = {},
): Promise<ScenarioRunOk | ScenarioRunFail | ScenarioRunStubbed> {
  // Accept the option to make the function shape forward-compatible
  // with the eventual implementation.
  void options;

  return {
    ok: false,
    stubbed: true,
    reason:
      "B0'.J.2 — localhost:3333 scenario runner not implemented yet. Depends on B0'.F.2 (avatar spawn in PIE) so the cross-context comparison covers identical scenarios. Implementation: connect WebSocket, run Privy handshake (or test bypass), translate scenario steps to packets, build ParityStateSnapshots from received state. See `runScenarioInLocalhostHyperia.ts` JSDoc for full plan.",
    recording: [],
  };
}
