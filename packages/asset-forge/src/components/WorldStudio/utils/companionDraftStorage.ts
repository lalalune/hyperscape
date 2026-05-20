/**
 * companionDraftStorage — persist + restore the companion-chat
 * draft across page reloads.
 *
 * Sibling to `designDraftStorage` — same concerns, different key
 * shape + payload. The companion's draft is per-project (one id)
 * and only carries the message history (no plan), whereas the
 * design-with-AI dialog's draft is per-team-and-game (two ids)
 * and carries an OnboardingPlan alongside the messages.
 *
 * Concerns owned by this module:
 *
 *  - localStorage key shape (`hyperforge:companion:draft:<projectId>`).
 *  - Versioned envelope (`COMPANION_VERSION`).
 *  - Safe-fail behavior when localStorage is disabled (Safari
 *    private mode, embedded contexts, server-render boundary).
 *  - Structural validation on read: rejects drafts with too-few
 *    messages (one-greeting-only thread isn't worth restoring).
 *
 * Concerns left in the panel:
 *
 *  - WHEN to save / load (the panel's useEffect on `messages`
 *    changes calls into here).
 *  - What text the greeting is (different per panel).
 */

const COMPANION_VERSION = 1;

/**
 * Persisted companion draft shape. Generic over the message
 * type so the panel can pass its own `ChatMessage` shape
 * without import-coupling.
 */
export interface CompanionDraft<MsgT> {
  readonly version: number;
  readonly messages: ReadonlyArray<MsgT>;
}

/**
 * Compute the localStorage key for a given project. Exposed for
 * tests + diagnostics; production callers go through
 * `loadCompanionDraft` / `saveCompanionDraft` / `clearCompanionDraft`.
 */
export function companionDraftKey(projectId: string): string {
  return `hyperforge:companion:draft:${projectId}`;
}

/**
 * Read a previously-saved companion draft. Returns `null` when:
 *
 *  - `window` is undefined (server render).
 *  - localStorage throws (Safari private mode, quota, etc.).
 *  - Stored JSON is malformed.
 *  - Stored payload's version doesn't match `COMPANION_VERSION`.
 *  - Stored payload's `messages` isn't an array, or has only the
 *    one-greeting message (not worth restoring).
 */
export function loadCompanionDraft<MsgT>(
  projectId: string,
): CompanionDraft<MsgT> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(companionDraftKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CompanionDraft<MsgT>> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== COMPANION_VERSION ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length <= 1
    ) {
      return null;
    }
    return parsed as CompanionDraft<MsgT>;
  } catch {
    return null;
  }
}

/**
 * Write a draft to localStorage. Silent best-effort — failures
 * (storage disabled, quota exceeded) don't propagate to the UI.
 *
 * Drafts with <= 1 message (one-greeting state) are cleared
 * rather than persisted, so re-opening the panel without
 * activity doesn't show a stale "restored draft" hint.
 */
export function saveCompanionDraft<MsgT>(
  projectId: string,
  messages: ReadonlyArray<MsgT>,
): void {
  if (typeof window === "undefined") return;
  if (messages.length <= 1) {
    clearCompanionDraft(projectId);
    return;
  }
  try {
    const draft: CompanionDraft<MsgT> = {
      version: COMPANION_VERSION,
      messages,
    };
    window.localStorage.setItem(
      companionDraftKey(projectId),
      JSON.stringify(draft),
    );
  } catch {
    // localStorage may be disabled (Safari private mode etc.) —
    // best-effort persistence, don't crash the UI.
  }
}

/**
 * Remove the saved draft for a project. Used when the user
 * explicitly resets or when the chat session ends.
 */
export function clearCompanionDraft(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(companionDraftKey(projectId));
  } catch {
    /* ignore */
  }
}
