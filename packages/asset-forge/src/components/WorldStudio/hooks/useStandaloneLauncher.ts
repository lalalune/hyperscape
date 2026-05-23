/**
 * useStandaloneLauncher — WorldStudio's client-side state hook for the
 * Standalone Launch flow.
 *
 * Wraps the three `/api/standalone/*` endpoints (Phase 2.2.c) into a
 * single React-friendly surface:
 *
 *   const { state, launch, stop } = useStandaloneLauncher();
 *
 * On mount + while a session is non-idle, the hook polls /status every
 * 500ms so the UI always reflects the launcher's real state without
 * the caller managing intervals. Phase 2.3 of PLAN_AAA_UE5_PARITY.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "../../../utils/api";

/**
 * Tagged state mirror of `LauncherState` from the backend launcher.
 * Kept in this file rather than imported from the server side so the
 * client doesn't reach into asset-forge/server.
 */
export type ClientLauncherState =
  | { kind: "idle" }
  | { kind: "starting"; projectId: string; startedAt: number }
  | {
      kind: "ready";
      projectId: string;
      pid: number;
      port: number;
      url: string;
      startedAt: number;
      readyAt: number;
    }
  | { kind: "stopping"; projectId: string; pid: number; stoppedAt: number }
  | { kind: "error"; projectId?: string; message: string; at: number };

interface LauncherStatusResponse {
  state: ClientLauncherState;
}

interface LauncherErrorResponse {
  error: string;
  state?: ClientLauncherState;
}

export interface UseStandaloneLauncherResult {
  /** Latest launcher state — updated on every poll + every call. */
  state: ClientLauncherState;
  /** Last error from a /launch or /stop call (UI may surface inline). */
  lastError: string | null;
  /** Boot a Standalone session for the given project id. */
  launch: (projectId: string) => Promise<void>;
  /** Tear down the running session. */
  stop: () => Promise<void>;
  /** Manual one-shot status refresh (the hook also polls on its own). */
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 500;
const IDLE_POLL_INTERVAL_MS = 5_000;

/**
 * Hook-style accessor. Single instance per WorldStudio session; multiple
 * call sites share the polling cadence via the hook's state being
 * lifted into whatever component owns it.
 */
export function useStandaloneLauncher(): UseStandaloneLauncherResult {
  const [state, setState] = useState<ClientLauncherState>({ kind: "idle" });
  const [lastError, setLastError] = useState<string | null>(null);
  const stateRef = useRef<ClientLauncherState>(state);
  stateRef.current = state;

  const refresh = useCallback(async (): Promise<void> => {
    try {
      // apiFetch auto-injects the Bearer token from the Privy session.
      // Raw fetch + credentials:"include" gets a 401 because the
      // asset-forge auth middleware reads `Authorization: Bearer …`,
      // not cookies.
      const res = await apiFetch("/api/standalone/status");
      if (!res.ok) return;
      const body = (await res.json()) as LauncherStatusResponse;
      setState(body.state);
    } catch {
      // Network blip — keep showing the prior state, next poll will
      // either recover or surface a persistent error.
    }
  }, []);

  const launch = useCallback(async (projectId: string): Promise<void> => {
    setLastError(null);
    try {
      const res = await apiFetch(
        `/api/standalone/${encodeURIComponent(projectId)}/launch`,
        { method: "POST" },
      );
      const body = (await res.json()) as
        | LauncherStatusResponse
        | LauncherErrorResponse;
      if (!res.ok) {
        const err = body as LauncherErrorResponse;
        const msg = err.error ?? `Launch failed (${res.status})`;
        // Loud in the console so the dev-tools network panel isn't
        // the only place the actual failure reason is visible.
        console.error("[StandaloneLaunch] launch failed:", msg, err);
        setLastError(msg);
        if (err.state) setState(err.state);
        return;
      }
      const ok = body as LauncherStatusResponse;
      setState(ok.state);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Network error launching";
      console.error("[StandaloneLaunch] launch threw:", msg, err);
      setLastError(msg);
    }
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    setLastError(null);
    try {
      const res = await apiFetch("/api/standalone/stop", { method: "POST" });
      const body = (await res.json()) as
        | LauncherStatusResponse
        | LauncherErrorResponse;
      if (!res.ok) {
        const err = body as LauncherErrorResponse;
        setLastError(err.error ?? `Stop failed (${res.status})`);
        return;
      }
      const ok = body as LauncherStatusResponse;
      setState(ok.state);
    } catch (err) {
      setLastError(
        err instanceof Error ? err.message : "Network error stopping",
      );
    }
  }, []);

  // Initial fetch + active polling. When idle, poll less aggressively
  // so an open editor with no Standalone session doesn't hammer the
  // backend. When mid-transition (starting/stopping), poll fast so
  // the UI shows the ready/error transition promptly.
  useEffect(() => {
    let cancelled = false;
    void refresh();

    const intervalMs =
      state.kind === "starting" || state.kind === "stopping"
        ? POLL_INTERVAL_MS
        : IDLE_POLL_INTERVAL_MS;

    const timer = setInterval(() => {
      if (cancelled) return;
      void refresh();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh, state.kind]);

  return { state, lastError, launch, stop, refresh };
}
