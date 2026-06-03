/**
 * Theme Store
 *
 * Zustand store for theme state management.
 * Supports base and hyperia themes with persistence.
 *
 * @packageDocumentation
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  themes,
  baseTheme,
  hyperiaTheme,
  type Theme,
  type ThemeName,
} from "../theme/themes";

/** Theme store state */
export interface ThemeStoreState {
  /** Current theme name */
  themeName: ThemeName;
  /** Current theme object */
  theme: Theme;
  /** Set theme by name */
  setTheme: (name: ThemeName) => void;
  /** Toggle between base and hyperia */
  toggleTheme: () => void;
  /** Check if using base theme */
  isBase: () => boolean;
  /** Check if using hyperia theme */
  isHyperia: () => boolean;
  // Legacy compatibility
  isDark: () => boolean;
  isLight: () => boolean;
}

/**
 * Zustand store for theme management
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { themeName, toggleTheme } = useThemeStore();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {themeName === 'dark' ? '🌙' : '☀️'}
 *     </button>
 *   );
 * }
 * ```
 */
export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => ({
      themeName: "hyperia" as ThemeName,
      theme: hyperiaTheme,

      setTheme: (name: ThemeName) => {
        const newTheme = themes[name];
        set({
          themeName: name,
          theme: newTheme,
        });

        // Apply CSS custom properties
        applyThemeToCSSVariables(newTheme);
      },

      toggleTheme: () => {
        const current = get().themeName;
        const next = current === "hyperia" ? "base" : "hyperia";
        get().setTheme(next);
      },

      isBase: () => get().themeName === "base",
      isHyperia: () => get().themeName === "hyperia",

      // Legacy compatibility - both themes are dark
      isDark: () => true,
      isLight: () => false,
    }),
    {
      name: "hyperia-theme",
      partialize: (state) => ({ themeName: state.themeName }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure valid theme name (handle legacy "dark"/"light" values)
          const validTheme =
            state.themeName === "base" || state.themeName === "hyperia"
              ? state.themeName
              : "hyperia";
          state.themeName = validTheme;
          state.theme = themes[validTheme];
          applyThemeToCSSVariables(state.theme);
        }
      },
    },
  ),
);

/**
 * Apply theme to CSS custom properties
 */
function applyThemeToCSSVariables(theme: Theme): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Background colors
  root.style.setProperty("--color-bg-primary", theme.colors.background.primary);
  root.style.setProperty(
    "--color-bg-secondary",
    theme.colors.background.secondary,
  );
  root.style.setProperty(
    "--color-bg-tertiary",
    theme.colors.background.tertiary,
  );
  root.style.setProperty("--color-bg-overlay", theme.colors.background.overlay);
  root.style.setProperty("--color-bg-glass", theme.colors.background.glass);

  // Text colors
  root.style.setProperty("--color-text-primary", theme.colors.text.primary);
  root.style.setProperty("--color-text-secondary", theme.colors.text.secondary);
  root.style.setProperty("--color-text-muted", theme.colors.text.muted);
  root.style.setProperty("--color-text-disabled", theme.colors.text.disabled);
  root.style.setProperty("--color-text-link", theme.colors.text.link);
  root.style.setProperty("--color-text-accent", theme.colors.text.accent);

  // Border colors
  root.style.setProperty("--color-border-default", theme.colors.border.default);
  root.style.setProperty("--color-border-hover", theme.colors.border.hover);
  root.style.setProperty("--color-border-active", theme.colors.border.active);
  root.style.setProperty("--color-border-focus", theme.colors.border.focus);
  root.style.setProperty(
    "--color-border-decorative",
    theme.colors.border.decorative,
  );

  // Accent colors
  root.style.setProperty("--color-accent-primary", theme.colors.accent.primary);
  root.style.setProperty(
    "--color-accent-secondary",
    theme.colors.accent.secondary,
  );
  root.style.setProperty("--color-accent-hover", theme.colors.accent.hover);
  root.style.setProperty("--color-accent-active", theme.colors.accent.active);

  // State colors
  root.style.setProperty("--color-state-success", theme.colors.state.success);
  root.style.setProperty("--color-state-warning", theme.colors.state.warning);
  root.style.setProperty("--color-state-danger", theme.colors.state.danger);
  root.style.setProperty("--color-state-info", theme.colors.state.info);

  // Status colors (HP, prayer, etc.)
  root.style.setProperty("--color-status-hp", theme.colors.status.hp);
  root.style.setProperty(
    "--color-status-hp-bg",
    theme.colors.status.hpBackground,
  );
  root.style.setProperty("--color-status-prayer", theme.colors.status.prayer);
  root.style.setProperty(
    "--color-status-prayer-bg",
    theme.colors.status.prayerBackground,
  );
  root.style.setProperty(
    "--color-status-adrenaline",
    theme.colors.status.adrenaline,
  );
  root.style.setProperty(
    "--color-status-adrenaline-bg",
    theme.colors.status.adrenalineBackground,
  );
  root.style.setProperty("--color-status-energy", theme.colors.status.energy);
  root.style.setProperty(
    "--color-status-energy-bg",
    theme.colors.status.energyBackground,
  );

  // Slot colors
  root.style.setProperty("--color-slot-empty", theme.colors.slot.empty);
  root.style.setProperty("--color-slot-filled", theme.colors.slot.filled);
  root.style.setProperty("--color-slot-hover", theme.colors.slot.hover);
  root.style.setProperty("--color-slot-selected", theme.colors.slot.selected);

  // Spacing
  root.style.setProperty("--spacing-xs", `${theme.spacing.xs}px`);
  root.style.setProperty("--spacing-sm", `${theme.spacing.sm}px`);
  root.style.setProperty("--spacing-md", `${theme.spacing.md}px`);
  root.style.setProperty("--spacing-lg", `${theme.spacing.lg}px`);
  root.style.setProperty("--spacing-xl", `${theme.spacing.xl}px`);
  root.style.setProperty("--spacing-grid", `${theme.spacing.grid}px`);

  // Border radius
  root.style.setProperty("--radius-sm", `${theme.borderRadius.sm}px`);
  root.style.setProperty("--radius-md", `${theme.borderRadius.md}px`);
  root.style.setProperty("--radius-lg", `${theme.borderRadius.lg}px`);
  root.style.setProperty("--radius-xl", `${theme.borderRadius.xl}px`);

  // Shadows
  root.style.setProperty("--shadow-sm", theme.shadows.sm);
  root.style.setProperty("--shadow-md", theme.shadows.md);
  root.style.setProperty("--shadow-lg", theme.shadows.lg);
  root.style.setProperty("--shadow-window", theme.shadows.window);
  root.style.setProperty("--shadow-glow", theme.shadows.glow);

  // Glass effect
  root.style.setProperty("--glass-blur", `${theme.glass.blur}px`);
  root.style.setProperty("--glass-opacity", `${theme.glass.opacity}`);

  // Slot dimensions
  root.style.setProperty("--slot-size", `${theme.slot.size}px`);
  root.style.setProperty("--slot-gap", `${theme.slot.gap}px`);
  root.style.setProperty("--slot-radius", `${theme.slot.borderRadius}px`);
  root.style.setProperty("--slot-icon-size", `${theme.slot.iconSize}px`);

  // Panel dimensions
  root.style.setProperty(
    "--panel-header-height",
    `${theme.panel.headerHeight}px`,
  );
  root.style.setProperty("--panel-min-width", `${theme.panel.minWidth}px`);
  root.style.setProperty("--panel-min-height", `${theme.panel.minHeight}px`);

  // Set theme attribute for CSS selectors
  root.setAttribute("data-theme", theme.name);
}

/**
 * Hook to use current theme
 */
export function useTheme(): Theme {
  return useThemeStore((s) => s.theme);
}

// Re-export themes for convenience
export { baseTheme, hyperiaTheme };
