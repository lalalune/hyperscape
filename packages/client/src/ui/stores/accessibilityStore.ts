/**
 * Accessibility Store
 *
 * Zustand store for accessibility settings with localStorage persistence.
 * Automatically applies CSS variables and data attributes on state change.
 *
 * @packageDocumentation
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type {
  AccessibilitySettings,
  ColorblindMode,
  FontSizeOption,
} from "../types/accessibility";
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  COLORBLIND_PALETTES,
  FONT_SIZE_SCALE,
} from "../types/accessibility";

/** Accessibility store state and actions */
export interface AccessibilityStoreState extends AccessibilitySettings {
  /** Set colorblind mode */
  setColorblindMode: (mode: ColorblindMode) => void;
  /** Toggle high contrast mode */
  setHighContrast: (enabled: boolean) => void;
  /** Toggle reduced motion */
  setReducedMotion: (enabled: boolean) => void;
  /** Set font size */
  setFontSize: (size: FontSizeOption) => void;
  /** Toggle keyboard navigation */
  setKeyboardNavigation: (enabled: boolean) => void;
  /** Reset all settings to defaults */
  resetToDefaults: () => void;
  /** Get all settings as an object */
  getSettings: () => AccessibilitySettings;
}

/**
 * Apply accessibility settings to CSS custom properties and data attributes
 */
function applyAccessibilityToDOM(settings: AccessibilitySettings): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Apply colorblind mode data attribute
  if (settings.colorblindMode === "none") {
    root.removeAttribute("data-colorblind");
  } else {
    root.setAttribute("data-colorblind", settings.colorblindMode);
  }

  // Apply colorblind palette overrides as CSS variables
  const palette = COLORBLIND_PALETTES[settings.colorblindMode];
  if (palette.health) {
    root.style.setProperty("--color-health-full", palette.health);
    root.style.setProperty("--color-hp", palette.health);
  }
  if (palette.danger) {
    root.style.setProperty("--color-danger", palette.danger);
    root.style.setProperty("--color-error", palette.danger);
  }
  if (palette.success) {
    root.style.setProperty("--color-success", palette.success);
  }
  if (palette.mana) {
    root.style.setProperty("--color-mana", palette.mana);
    root.style.setProperty("--color-prayer", palette.mana);
  }
  if (palette.info) {
    root.style.setProperty("--color-info", palette.info);
  }
  if (palette.primary) {
    root.style.setProperty("--color-primary", palette.primary);
  }
  if (palette.link) {
    root.style.setProperty("--color-link", palette.link);
  }
  if (palette.energy) {
    root.style.setProperty("--color-energy", palette.energy);
  }

  // Apply high contrast mode
  if (settings.highContrast) {
    root.setAttribute("data-contrast", "high");
  } else {
    root.removeAttribute("data-contrast");
  }

  // Apply reduced motion
  if (settings.reducedMotion) {
    root.setAttribute("data-reduced-motion", "true");
    root.style.setProperty("--animation-duration-multiplier", "0");
  } else {
    root.removeAttribute("data-reduced-motion");
    root.style.setProperty("--animation-duration-multiplier", "1");
  }

  // Apply font size scale
  const scale = FONT_SIZE_SCALE[settings.fontSize];
  root.style.setProperty("--font-scale", String(scale));
  root.style.setProperty("--font-size-xs", `${10 * scale}px`);
  root.style.setProperty("--font-size-sm", `${12 * scale}px`);
  root.style.setProperty("--font-size-base", `${14 * scale}px`);
  root.style.setProperty("--font-size-lg", `${16 * scale}px`);
  root.style.setProperty("--font-size-xl", `${20 * scale}px`);
  root.style.setProperty("--font-size-xxl", `${24 * scale}px`);

  // Apply keyboard navigation mode
  if (settings.keyboardNavigation) {
    root.setAttribute("data-keyboard-nav", "true");
    // Ensure focus rings are always visible
    root.style.setProperty(
      "--focus-visible-outline",
      "2px solid var(--color-accent-primary)",
    );
  } else {
    root.removeAttribute("data-keyboard-nav");
    root.style.removeProperty("--focus-visible-outline");
  }
}

/**
 * Check for system preference for reduced motion
 */
function getSystemReducedMotionPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Zustand store for accessibility settings
 *
 * @example
 * ```tsx
 * function AccessibilityToggle() {
 *   const { highContrast, setHighContrast } = useAccessibilityStore();
 *
 *   return (
 *     <button onClick={() => setHighContrast(!highContrast)}>
 *       High Contrast: {highContrast ? 'On' : 'Off'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useAccessibilityStore = create<AccessibilityStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_ACCESSIBILITY_SETTINGS,

      setColorblindMode: (mode: ColorblindMode) => {
        set({ colorblindMode: mode });
        applyAccessibilityToDOM({ ...get(), colorblindMode: mode });
      },

      setHighContrast: (enabled: boolean) => {
        set({ highContrast: enabled });
        applyAccessibilityToDOM({ ...get(), highContrast: enabled });
      },

      setReducedMotion: (enabled: boolean) => {
        set({ reducedMotion: enabled });
        applyAccessibilityToDOM({ ...get(), reducedMotion: enabled });
      },

      setFontSize: (size: FontSizeOption) => {
        set({ fontSize: size });
        applyAccessibilityToDOM({ ...get(), fontSize: size });
      },

      setKeyboardNavigation: (enabled: boolean) => {
        set({ keyboardNavigation: enabled });
        applyAccessibilityToDOM({ ...get(), keyboardNavigation: enabled });
      },

      resetToDefaults: () => {
        set(DEFAULT_ACCESSIBILITY_SETTINGS);
        applyAccessibilityToDOM(DEFAULT_ACCESSIBILITY_SETTINGS);
      },

      getSettings: () => {
        const state = get();
        return {
          colorblindMode: state.colorblindMode,
          highContrast: state.highContrast,
          reducedMotion: state.reducedMotion,
          fontSize: state.fontSize,
          keyboardNavigation: state.keyboardNavigation,
        };
      },
    }),
    {
      name: "hyperia-accessibility",
      partialize: (state) => ({
        colorblindMode: state.colorblindMode,
        highContrast: state.highContrast,
        reducedMotion: state.reducedMotion,
        fontSize: state.fontSize,
        keyboardNavigation: state.keyboardNavigation,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Check system preference for reduced motion if not explicitly set
          if (!state.reducedMotion && getSystemReducedMotionPreference()) {
            state.reducedMotion = true;
          }
          applyAccessibilityToDOM(state.getSettings());
        }
      },
    },
  ),
);

/**
 * Hook to get current accessibility settings
 * Uses useShallow for shallow comparison to prevent unnecessary re-renders
 */
export function useAccessibility(): AccessibilitySettings {
  return useAccessibilityStore(useShallow((s) => s.getSettings()));
}

/**
 * Initialize accessibility settings on app load
 * Call this once at app startup to apply saved settings
 */
export function initializeAccessibility(): void {
  const store = useAccessibilityStore.getState();
  applyAccessibilityToDOM(store.getSettings());
}
