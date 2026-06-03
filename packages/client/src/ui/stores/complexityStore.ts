/**
 * Complexity Store
 *
 * Zustand store for progressive complexity mode management.
 * Controls feature visibility based on player experience level.
 *
 * @packageDocumentation
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { ComplexityMode, ComplexityFeatures } from "../types/complexity";
import { COMPLEXITY_MODE_CONFIGS } from "../types/complexity";

/** Complexity store state and actions */
export interface ComplexityStoreState {
  /** Current complexity mode */
  mode: ComplexityMode;
  /** Whether auto-progression prompt has been shown */
  standardPromptShown: boolean;
  /** Whether advanced mode prompt has been shown */
  advancedPromptShown: boolean;
  /** Whether user dismissed the last prompt */
  promptDismissed: boolean;
  /** Timestamp of last prompt dismissal */
  lastPromptDismissedAt: number | null;

  /** Set complexity mode */
  setMode: (mode: ComplexityMode) => void;
  /** Get feature visibility for current mode */
  getFeatures: () => ComplexityFeatures;
  /** Check if a specific feature is enabled */
  isFeatureEnabled: (feature: keyof ComplexityFeatures) => boolean;
  /** Mark standard prompt as shown */
  markStandardPromptShown: () => void;
  /** Mark advanced prompt as shown */
  markAdvancedPromptShown: () => void;
  /** Dismiss current prompt */
  dismissPrompt: () => void;
  /** Check if should show upgrade prompt */
  shouldShowUpgradePrompt: (targetMode: ComplexityMode) => boolean;
  /** Get current mode config */
  getModeConfig: () => (typeof COMPLEXITY_MODE_CONFIGS)[ComplexityMode];
}

/**
 * Zustand store for complexity mode
 *
 * @example
 * ```tsx
 * function EditModeButton() {
 *   const { isFeatureEnabled } = useComplexityStore();
 *
 *   if (!isFeatureEnabled('editMode')) {
 *     return null;
 *   }
 *
 *   return <button>Edit Mode</button>;
 * }
 * ```
 */
export const useComplexityStore = create<ComplexityStoreState>()(
  persist(
    (set, get) => ({
      mode: "advanced" as ComplexityMode,
      standardPromptShown: false,
      advancedPromptShown: false,
      promptDismissed: false,
      lastPromptDismissedAt: null,

      setMode: (mode: ComplexityMode) => {
        set({ mode });
        // Emit event for other systems to react
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("complexityModeChange", { detail: { mode } }),
          );
        }
      },

      getFeatures: () => {
        const mode = get().mode;
        return COMPLEXITY_MODE_CONFIGS[mode].features;
      },

      isFeatureEnabled: (feature: keyof ComplexityFeatures) => {
        const mode = get().mode;
        return COMPLEXITY_MODE_CONFIGS[mode].features[feature];
      },

      markStandardPromptShown: () => {
        set({ standardPromptShown: true });
      },

      markAdvancedPromptShown: () => {
        set({ advancedPromptShown: true });
      },

      dismissPrompt: () => {
        set({
          promptDismissed: true,
          lastPromptDismissedAt: Date.now(),
        });
      },

      shouldShowUpgradePrompt: (targetMode: ComplexityMode) => {
        const state = get();

        // Don't show if already at or above target mode
        const modeOrder: ComplexityMode[] = ["simple", "standard", "advanced"];
        const currentIndex = modeOrder.indexOf(state.mode);
        const targetIndex = modeOrder.indexOf(targetMode);

        if (currentIndex >= targetIndex) return false;

        // Check if prompt was already shown
        if (targetMode === "standard" && state.standardPromptShown)
          return false;
        if (targetMode === "advanced" && state.advancedPromptShown)
          return false;

        // Check cooldown (24 hours after dismissal)
        if (state.lastPromptDismissedAt) {
          const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
          if (Date.now() - state.lastPromptDismissedAt < cooldownMs) {
            return false;
          }
        }

        return true;
      },

      getModeConfig: () => {
        const mode = get().mode;
        return COMPLEXITY_MODE_CONFIGS[mode];
      },
    }),
    {
      name: "hyperia-complexity",
      version: 1, // Bump version for migration
      partialize: (state) => ({
        mode: state.mode,
        standardPromptShown: state.standardPromptShown,
        advancedPromptShown: state.advancedPromptShown,
        promptDismissed: state.promptDismissed,
        lastPromptDismissedAt: state.lastPromptDismissedAt,
      }),
      // Migrate existing users to advanced mode so edit features work
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0) {
          // Migrate from simple default to advanced default
          state.mode = "advanced";
        }
        return state as typeof persistedState;
      },
    },
  ),
);

/**
 * Hook to check if a feature is enabled in current complexity mode
 */
export function useFeatureEnabled(feature: keyof ComplexityFeatures): boolean {
  return useComplexityStore((s) => s.isFeatureEnabled(feature));
}

/**
 * Hook to get current complexity mode
 */
export function useComplexityMode(): ComplexityMode {
  return useComplexityStore((s) => s.mode);
}

/**
 * Hook to get all current features
 * Uses useShallow for shallow comparison to prevent unnecessary re-renders
 */
export function useComplexityFeatures(): ComplexityFeatures {
  return useComplexityStore(useShallow((s) => s.getFeatures()));
}
