/**
 * Scenario recording harness.
 *
 * Phase B0'.J of `PLAN_PROJECT_AS_DATA.md`. Runs a `ParityStep[]`
 * against a fresh `PIEEditorSession`, records state at each step,
 * and returns the recording.
 *
 * Two of these recordings — one from PIE, one from a real
 * `localhost:3333` Hyperia deploy — are compared in the parity
 * smoke test for state-equivalence.
 *
 * Today's harness only runs the PIE side. The localhost runner is
 * stubbed in `runScenarioInLocalhostHyperia.ts` pending B0'.F.2
 * (avatar spawn) — without an avatar in PIE, the player-mediated
 * scenario steps can't actually run, and the cross-context
 * comparison is premature.
 */

import { PIEEditorSession } from "../PIEEditorSession";
import type { ParityStep, ParityStateSnapshot } from "./parityScenario";

/** Tick budget between steps. Each step gets this many ticks
 * after `apply` and before `record` so the loopback drains and
 * any async side-effects settle. */
const TICKS_BETWEEN_STEPS = 8;
const TICK_DT_SEC = 0.016;

/**
 * Run a scenario against a fresh PIE session. Returns one
 * snapshot per step.
 *
 * The first step is expected to call `session.start(...)`. Steps
 * after that mutate the running session. The scenario's last
 * step typically calls `session.stop()`.
 *
 * On error, the partial recording is included with the error so
 * test failures show "we got through 3 steps before X failed".
 */
export interface ScenarioRunOk {
  readonly ok: true;
  readonly recording: ReadonlyArray<ParityStateSnapshot>;
}
export interface ScenarioRunFail {
  readonly ok: false;
  readonly recording: ReadonlyArray<ParityStateSnapshot>;
  readonly error: Error;
  readonly failedStep: string;
}

export async function recordScenarioInPIE(
  scenario: ReadonlyArray<ParityStep>,
): Promise<ScenarioRunOk | ScenarioRunFail> {
  const session = new PIEEditorSession();
  const recording: ParityStateSnapshot[] = [];
  let lastStepName = "<before any step>";

  try {
    for (const step of scenario) {
      lastStepName = step.name;
      await step.apply(session);
      // Tick to drain the loopback so entityAdded packets,
      // scripting graph events, etc. settle.
      for (let i = 0; i < TICKS_BETWEEN_STEPS; i++) {
        try {
          session.tick(TICK_DT_SEC);
        } catch {
          // tick() can throw post-stop on internal state machines —
          // benign in that branch since we're recording the state
          // immediately after.
          break;
        }
        // Yield to the microtask queue so packet handlers run.
        await new Promise<void>((r) => setTimeout(r, 0));
      }
      recording.push(step.record(session));
    }
    return { ok: true, recording };
  } catch (err) {
    // Best-effort cleanup so subsequent tests in the same vitest
    // file get a fresh state.
    try {
      await session.stop();
    } catch {
      // ignore — already failed
    }
    return {
      ok: false,
      recording,
      error: err instanceof Error ? err : new Error(String(err)),
      failedStep: lastStepName,
    };
  }
}

/**
 * Compare two scenario recordings step-by-step. Returns the list
 * of mismatches; empty list means the recordings are equivalent.
 *
 * Equivalence rules:
 *   - `stepName` must match exactly (sanity check the harnesses
 *     ran the same scenario).
 *   - `clientEntityCount` / `serverEntityCount` must match.
 *   - `running` flag must match.
 *   - `dataContext`: deep-equal when both non-null, both null OK,
 *     mismatch when one is null and the other isn't.
 *
 * Used by both the PIE-self-determinism test (run PIE twice,
 * check identical) and the future PIE-vs-localhost cross-context
 * smoke (run both, diff).
 */
export interface ParityMismatch {
  readonly index: number;
  readonly field: string;
  readonly stepName: string;
  readonly left: unknown;
  readonly right: unknown;
}

export function diffRecordings(
  left: ReadonlyArray<ParityStateSnapshot>,
  right: ReadonlyArray<ParityStateSnapshot>,
): ParityMismatch[] {
  const mismatches: ParityMismatch[] = [];
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    const l = left[i];
    const r = right[i];
    if (!l || !r) {
      mismatches.push({
        index: i,
        field: "step-presence",
        stepName: l?.stepName ?? r?.stepName ?? "<missing>",
        left: l ?? null,
        right: r ?? null,
      });
      continue;
    }
    if (l.stepName !== r.stepName) {
      mismatches.push({
        index: i,
        field: "stepName",
        stepName: l.stepName,
        left: l.stepName,
        right: r.stepName,
      });
    }
    if (l.clientEntityCount !== r.clientEntityCount) {
      mismatches.push({
        index: i,
        field: "clientEntityCount",
        stepName: l.stepName,
        left: l.clientEntityCount,
        right: r.clientEntityCount,
      });
    }
    if (l.serverEntityCount !== r.serverEntityCount) {
      mismatches.push({
        index: i,
        field: "serverEntityCount",
        stepName: l.stepName,
        left: l.serverEntityCount,
        right: r.serverEntityCount,
      });
    }
    if (l.running !== r.running) {
      mismatches.push({
        index: i,
        field: "running",
        stepName: l.stepName,
        left: l.running,
        right: r.running,
      });
    }
    // dataContext: deep-equal via JSON serialization. Cheap
    // because the snapshots are small.
    const leftCtx = JSON.stringify(l.dataContext);
    const rightCtx = JSON.stringify(r.dataContext);
    if (leftCtx !== rightCtx) {
      mismatches.push({
        index: i,
        field: "dataContext",
        stepName: l.stepName,
        left: l.dataContext,
        right: r.dataContext,
      });
    }
  }
  return mismatches;
}
