/**
 * Preset Sync Hook
 *
 * Wires up the cloud sync functionality with Privy authentication
 * to sync UI layout presets with the server on login/save.
 *
 * @packageDocumentation
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useCloudSync } from "@/ui";
import { privyAuthManager } from "../auth/PrivyAuthManager";

/** Preset sync state */
export interface PresetSyncState {
  /** Whether initial sync from server has completed */
  isLoaded: boolean;
  /** Whether currently syncing */
  isSyncing: boolean;
  /** Last error message */
  error: string | null;
  /** Last sync timestamp */
  lastSyncAt: number | null;
  /** Whether user is authenticated and sync is enabled */
  isEnabled: boolean;
}

/** Preset sync result */
export interface PresetSyncResult extends PresetSyncState {
  /** Manually trigger a pull from server */
  pullFromServer: () => Promise<boolean>;
  /** Manually trigger a push to server */
  pushToServer: () => Promise<boolean>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook that integrates useCloudSync with Hyperia authentication.
 *
 * Automatically:
 * - Pulls presets from server on initial login
 * - Pushes presets to server when they change (auto-sync)
 *
 * @example
 * ```tsx
 * function InterfaceManagerWrapper() {
 *   const { isLoaded, isSyncing, error } = usePresetSync();
 *
 *   if (!isLoaded) {
 *     return <div>Loading layout presets...</div>;
 *   }
 *
 *   return <InterfaceManager />;
 * }
 * ```
 */
export function usePresetSync(): PresetSyncResult {
  // Track auth state
  const [userId, setUserId] = useState<string | null>(
    privyAuthManager.getUserId(),
  );
  const [isEnabled, setIsEnabled] = useState(
    privyAuthManager.isAuthenticated(),
  );
  const initialPullDoneRef = useRef(false);

  // Subscribe to auth changes
  useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe((state) => {
      setUserId(state.privyUserId);
      setIsEnabled(state.isAuthenticated);

      // Reset initial pull flag on logout
      if (!state.isAuthenticated) {
        initialPullDoneRef.current = false;
      }
    });

    return unsubscribe;
  }, []);

  // Use the cloud sync hook
  const cloudSync = useCloudSync({
    apiBaseUrl: "/api",
    userId: userId ?? "",
    autoSync: true,
    autoSyncDelay: 3000, // 3 second debounce for auto-save
  });

  // Initial pull on login
  useEffect(() => {
    if (isEnabled && userId && !initialPullDoneRef.current) {
      initialPullDoneRef.current = true;

      // Delay slightly to ensure component is mounted
      const timer = setTimeout(() => {
        cloudSync.pullFromCloud().then((success) => {
          if (!success && cloudSync.error) {
            console.warn(
              "[PresetSync] ⚠️ Failed to load presets:",
              cloudSync.error,
            );
          }
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isEnabled, userId, cloudSync]);

  // Wrap pull/push for external use
  const pullFromServer = useCallback(async (): Promise<boolean> => {
    if (!isEnabled) {
      console.warn("[PresetSync] Cannot pull: not authenticated");
      return false;
    }
    return cloudSync.pullFromCloud();
  }, [isEnabled, cloudSync]);

  const pushToServer = useCallback(async (): Promise<boolean> => {
    if (!isEnabled) {
      console.warn("[PresetSync] Cannot push: not authenticated");
      return false;
    }
    return cloudSync.pushToCloud();
  }, [isEnabled, cloudSync]);

  return {
    isLoaded: cloudSync.isLoaded || !isEnabled,
    isSyncing: cloudSync.isSyncing,
    error: cloudSync.error,
    lastSyncAt: cloudSync.lastSyncAt,
    isEnabled,
    pullFromServer,
    pushToServer,
    clearError: cloudSync.clearError,
  };
}

/**
 * Hook to get the sync status display text
 */
export function usePresetSyncStatus(): string {
  const { isSyncing, lastSyncAt, error, isEnabled } = usePresetSync();

  if (!isEnabled) return "Not logged in";
  if (error) return `Sync error: ${error}`;
  if (isSyncing) return "Syncing...";
  if (lastSyncAt) {
    const ago = Math.round((Date.now() - lastSyncAt) / 1000);
    if (ago < 60) return "Just synced";
    if (ago < 3600) return `Synced ${Math.round(ago / 60)}m ago`;
    return `Synced ${Math.round(ago / 3600)}h ago`;
  }
  return "Not synced";
}
