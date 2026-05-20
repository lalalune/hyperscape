/**
 * designDraftStorage — persist + restore the AI design-onboarding
 * draft across page reloads.
 *
 * Phase 1.2 first cut from `DesignWithAIDialog.tsx` (4,478-line
 * monolith — flagged as critical blocker #4 in PLAN_AAA_MASTER_AUDIT).
 *
 * Concern owned by this module:
 *
 *  - localStorage key shape (`hyperforge:design-with-ai:draft:
 *    <teamId>:<gameId>`).
 *  - Serialization format (versioned + shape-validated on read).
 *  - Safe-fail behavior when localStorage is disabled (Safari
 *    private mode, embedded contexts, server-render boundary).
 *
 * Shape-agnostic on the message + plan types — the dialog passes
 * its own `ChatMessage` and `OnboardingPlan` types via generics
 * so the storage helper doesn't need to know about either. Type
 * validation on read is purely structural (version + array +
 * non-null plan) so the caller is responsible for trusting /
 * casting the payload.
 *
 * Concerns left in the dialog:
 *
 *  - WHEN to save / load (the dialog's useEffect on
 *    `messages` / `plan` changes calls into here).
 *  - WHAT counts as a non-trivial draft worth restoring (the
 *    dialog drops drafts with only the greeting message).
 */

const DRAFT_VERSION = 1;

/**
 * Persisted draft shape. Generic over the message + plan types
 * so callers can use their own domain types without circular
 * import dance.
 */
export interface DesignDraft<MsgT, PlanT> {
  readonly version: number;
  readonly messages: ReadonlyArray<MsgT>;
  readonly plan: PlanT;
}

/**
 * Compute the localStorage key for a given (team, game) pair.
 * Exposed for tests + diagnostics; production callers go
 * through `loadDraft` / `saveDraft` / `clearDraft`.
 */
export function draftKey(teamId: string, gameId: string): string {
  return `hyperforge:design-with-ai:draft:${teamId}:${gameId}`;
}

/**
 * Read a previously-saved draft. Returns `null` when:
 *
 *  - `window` is undefined (server render).
 *  - localStorage throws (Safari private mode, quota, etc.).
 *  - Stored JSON is malformed.
 *  - Stored payload's version doesn't match `DRAFT_VERSION`.
 *  - Stored payload's `messages` isn't an array or `plan` is null.
 *
 * The returned cast is `as DesignDraft<MsgT, PlanT>` — callers
 * accept structural risk on the inner shapes (we only validate
 * the envelope).
 */
export function loadDraft<MsgT, PlanT>(
  teamId: string,
  gameId: string,
): DesignDraft<MsgT, PlanT> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(teamId, gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DesignDraft<MsgT, PlanT>> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== DRAFT_VERSION ||
      !Array.isArray(parsed.messages) ||
      !parsed.plan
    ) {
      return null;
    }
    return parsed as DesignDraft<MsgT, PlanT>;
  } catch {
    return null;
  }
}

/**
 * Write a draft to localStorage. Silent best-effort — failures
 * (storage disabled, quota exceeded) don't propagate to the UI.
 */
export function saveDraft<MsgT, PlanT>(
  teamId: string,
  gameId: string,
  messages: ReadonlyArray<MsgT>,
  plan: PlanT,
): void {
  if (typeof window === "undefined") return;
  try {
    const draft: DesignDraft<MsgT, PlanT> = {
      version: DRAFT_VERSION,
      messages,
      plan,
    };
    window.localStorage.setItem(
      draftKey(teamId, gameId),
      JSON.stringify(draft),
    );
  } catch {
    // localStorage may be disabled (Safari private mode etc.) —
    // best-effort persistence, don't crash the UI.
  }
}

/**
 * Remove the saved draft for a (team, game) pair. Used when the
 * project is successfully created (no draft needed once the
 * onboarding committed) or when the user explicitly resets.
 */
export function clearDraft(teamId: string, gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(teamId, gameId));
  } catch {
    /* ignore */
  }
}
