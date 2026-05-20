/**
 * Shared `/design/stream` SSE protocol types.
 *
 * The agent server emits three event types on the streaming
 * design endpoint:
 *
 *   - `"turn"` → `StreamTurnEvent` (one per agent turn)
 *   - `"done"` → `DesignResponse` (final state + status)
 *   - `"error"` → `{ message: string }` (terminal error)
 *
 * Both `DesignWithAIDialog` (onboarding mode) and
 * `WorldStudioCompanion` (companion mode) consume the same
 * stream and react to the same events. Centralising the
 * protocol shapes here gives both consumers a single source
 * of truth and prevents drift from one side independently
 * updating its inline declaration.
 *
 * `OfferedChoicesPayload` is the embedded shape attached to
 * agent messages with OFFER_CHOICES chips (B1'.4); it's small
 * enough to live alongside the parent envelope types.
 */

import type { OnboardingPlan } from "./onboardingPlan";

/**
 * One streamed turn the SSE handler emits. The agent emits one
 * of these per turn it took during a conversation pass.
 */
export interface StreamTurnEvent {
  turn: number;
  assistantText: string;
  toolCalls: ReadonlyArray<{
    name: string;
    success: boolean;
    data: unknown;
  }>;
}

/**
 * Hybrid-UX choice chips (B1'.4) — the agent's last
 * OFFER_CHOICES emission. Companion ChatMessages and the final
 * `DesignResponse` both carry an optional payload of this shape.
 */
export interface OfferedChoicesPayload {
  question: string | null;
  choices: ReadonlyArray<{ label: string; prompt: string }>;
}

/**
 * Final response envelope from the agent server's
 * `/design/stream` endpoint. `ok=true` indicates a clean run;
 * `ok=false` (with `error`) indicates a server-side failure
 * the client should surface to the user.
 *
 * `plan` is the canonical aggregate the agent built up over its
 * turns (used by onboarding mode to populate the project's
 * worldContent). Companion mode usually ignores `plan` since it
 * reacts to each turn's tool calls live via PROPOSE_*
 * dispatches.
 */
export interface DesignResponse {
  ok: boolean;
  pack?: unknown;
  finalText?: string;
  turns?: number;
  truncated?: boolean;
  error?: string;
  /** B1'.2.2 — present when the request was sent in onboarding mode. */
  plan?: OnboardingPlan;
  /** B1'.4 — choice chips offered on the last agent turn. */
  choices?: OfferedChoicesPayload | null;
}
