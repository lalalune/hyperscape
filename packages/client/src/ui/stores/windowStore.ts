import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  WindowState,
  WindowConfig,
  TabState,
  TabConfig,
  Size,
  WindowAnchor,
} from "../types";
import { useEditStore } from "./editStore";
import {
  repositionWindowForViewport,
  getDefaultAnchor,
  getDefaultPositionForAnchor,
} from "./anchorUtils";

/** Whether to log debug messages (disabled in production) */
const DEBUG =
  typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

/** Log a debug message (only in development) */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(message, ...args);
  }
}

/**
 * Generate a unique ID using crypto.randomUUID() with fallback.
 * Provides collision-safe IDs suitable for distributed systems.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `window_${crypto.randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID
  return `window_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a unique tab ID using crypto.randomUUID() with fallback.
 * Provides collision-safe IDs suitable for distributed systems.
 */
function generateTabId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `tab_${crypto.randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID
  return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/** Default window configuration - uses Pick to allow optional fields to remain undefined */
const DEFAULT_WINDOW_CONFIG: Pick<
  WindowConfig,
  "position" | "size" | "minSize" | "transparency"
> & {
  tabs: TabConfig[];
  maxSize: Size | undefined;
  aspectRatio: number | undefined;
} = {
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
  minSize: { width: 200, height: 150 },
  maxSize: undefined,
  aspectRatio: undefined,
  transparency: 0,
  tabs: [],
};

/**
 * Snap a value to the edit mode grid.
 * Gets grid size from editStore for consistency across all window positioning.
 */
function snapToGrid(value: number): number {
  const gridSize = useEditStore.getState().gridSize;
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Clamp a window's position to ensure it stays within the viewport.
 * Ensures at least 50px of the window is visible on each edge.
 * Also snaps the final position to the edit mode grid for consistent alignment.
 */
function clampToViewport(
  position: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  const viewport = {
    width:
      typeof globalThis.window !== "undefined"
        ? globalThis.window.innerWidth
        : 1920,
    height:
      typeof globalThis.window !== "undefined"
        ? globalThis.window.innerHeight
        : 1080,
  };

  const minVisiblePx = 50; // At least 50px of window must be visible

  // First clamp to viewport bounds
  const clampedX = Math.max(
    minVisiblePx - size.width,
    Math.min(position.x, viewport.width - minVisiblePx),
  );
  const clampedY = Math.max(
    0, // Don't allow windows above viewport
    Math.min(position.y, viewport.height - minVisiblePx),
  );

  // Then snap to grid for consistent alignment
  return {
    x: snapToGrid(clampedX),
    y: snapToGrid(clampedY),
  };
}

/** Window store state and actions */
export interface WindowStoreState {
  /** Map of window ID to window state */
  windows: Map<string, WindowState>;
  /** Next z-index to assign */
  nextZIndex: number;

  /** Create a new window */
  createWindow: (config?: WindowConfig) => WindowState;
  /** Update a window's state */
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
  /** Destroy a window */
  destroyWindow: (id: string) => void;
  /** Bring a window to front */
  bringToFront: (id: string) => void;
  /** Get a window by ID */
  getWindow: (id: string) => WindowState | undefined;
  /** Get all windows as array */
  getAllWindows: () => WindowState[];
  /** Set all windows (for loading presets) */
  setWindows: (windows: WindowState[]) => void;
  /** Load a layout from JSON with resolution scaling */
  loadLayout: (
    windows: WindowState[],
    sourceResolution: { width: number; height: number },
  ) => void;
  /** Reset to empty state */
  reset: () => void;

  // Tab operations
  /** Add a tab to a window */
  addTab: (windowId: string, config: TabConfig) => TabState | undefined;
  /** Remove a tab from a window */
  removeTab: (windowId: string, tabId: string) => void;
  /** Set active tab */
  setActiveTab: (windowId: string, index: number) => void;
  /** Reorder tabs within a window */
  reorderTabs: (windowId: string, fromIndex: number, toIndex: number) => void;
  /** Move a tab to another window */
  moveTab: (
    tabId: string,
    sourceWindowId: string,
    targetWindowId: string,
    index?: number,
  ) => void;
}

/** Storage key for window layout persistence */
const STORAGE_KEY = "hyperscape-window-layout";

/**
 * Schema version for window layout persistence.
 * Increment this when making breaking changes to the storage format.
 *
 * Version history:
 * - 1: Initial version
 * - 2: Remove maxSize from minimap/chat windows for unlimited resizing
 * - 3: Remove maxSize from menubar windows for unlimited resizing (deprecated by v5)
 * - 4: Apply proper maxSize to actionbar windows (prevents resizing larger than content)
 * - 5: Apply proper maxSize to menubar windows (prevents resizing larger than content)
 * - 6: Remove aspectRatio from minimap windows for independent width/height resizing
 * - 7: Reset stats panel size for new compact design (160x160 preferred)
 * - 8: Expand stats panel for full skills display (all 13 skills: combat, gathering, production)
 * - 9: Adjust stats panel with tighter constraints to prevent content cutoff
 * - 10: Reset menubar constraints for dynamic sizing (minSize = maxSize = content size)
 * - 11: New default layout - clear all windows to apply new layout (Settings+Chat left, Minimap+Stats+Inventory right, Menu bottom-right)
 * - 12: Fix default layout - Stats panel without Skills tab, force clean reset
 * - 13: Add anchor property to windows for responsive viewport scaling
 */
const SCHEMA_VERSION = 13;

/** Panel ID to icon mapping for tab display migration */
const PANEL_ICONS: Record<string, string> = {
  minimap: "🗺️",
  inventory: "🎒",
  equipment: "🎽",
  stats: "📊",
  skills: "⭐",
  prayer: "✨",
  combat: "🗡️",
  account: "👤",
  settings: "⚙️",
  bank: "🏦",
  quests: "📜",
  map: "🗺️",
  chat: "💬",
  friends: "👥",
  presets: "📐",
  dashboard: "📈",
  action: "⚡",
  "actionbar-0": "⚡",
  "actionbar-1": "⚡",
  "actionbar-2": "⚡",
  "actionbar-3": "⚡",
  "actionbar-4": "⚡",
  menubar: "☰",
};

/** Get icon for a panel/tab ID */
function getPanelIcon(panelId: string): string | undefined {
  // Direct match
  if (PANEL_ICONS[panelId]) {
    return PANEL_ICONS[panelId];
  }
  // Check if it starts with a known prefix (e.g., "actionbar-3" -> "⚡")
  for (const key of Object.keys(PANEL_ICONS)) {
    if (panelId.startsWith(key)) {
      return PANEL_ICONS[key];
    }
  }
  return undefined;
}

/** Panels that have been deprecated and should be removed from cached layouts */
/** Note: "store" and "bank" are modals, not regular windows, so any persisted ones are orphans */
const DEPRECATED_PANELS = new Set([
  "dashboard", // Old dashboard panel, replaced by new layout
  "store", // Rendered as modal, not window
  "bank", // Rendered as modal, not window
]);

/** Filter out deprecated panels from tabs */
function filterDeprecatedTabs(tabs: TabState[]): TabState[] {
  return tabs.filter((tab) => {
    // content can be ReactNode | string, only check if it's a string
    const panelId = typeof tab.content === "string" ? tab.content : tab.id;
    return !DEPRECATED_PANELS.has(panelId);
  });
}

/** Migrate tabs to add icons if missing */
function migrateTabsWithIcons(tabs: TabState[]): TabState[] {
  return tabs.map((tab) => {
    if (tab.icon) return tab; // Already has icon

    // Try to get icon from content or id (content can be ReactNode | string)
    const contentId = typeof tab.content === "string" ? tab.content : "";
    const icon = getPanelIcon(contentId) || getPanelIcon(tab.id);
    if (icon) {
      return { ...tab, icon };
    }
    return tab;
  });
}

/** Full tab migration: remove deprecated, add icons, update old icons */
function migrateTabs(tabs: TabState[]): TabState[] {
  // First filter out deprecated panels
  let migrated = filterDeprecatedTabs(tabs);
  // Then add/update icons
  migrated = migrateTabsWithIcons(migrated);
  // Update old icons that have changed
  migrated = migrated.map((tab) => {
    const panelId = typeof tab.content === "string" ? tab.content : tab.id;
    const correctIcon = PANEL_ICONS[panelId];
    if (correctIcon && tab.icon !== correctIcon) {
      return { ...tab, icon: correctIcon };
    }
    return tab;
  });
  return migrated;
}

/**
 * Versioned migration system for window store.
 * Each migration function transforms state from version N to N+1.
 * Migrations run incrementally from the stored version to SCHEMA_VERSION.
 */
type MigrationFn = (
  windows: Map<string, WindowState>,
) => Map<string, WindowState>;

const migrations: Record<number, MigrationFn> = {
  /**
   * Migration 1 → 2: Remove maxSize from minimap/chat windows
   * These panels should have unlimited resizing capability.
   */
  2: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const shouldRemoveMaxSize =
        id === "minimap-window" ||
        id.startsWith("panel-chat-") ||
        id.startsWith("panel-minimap-");

      if (shouldRemoveMaxSize && windowState.maxSize !== undefined) {
        debugLog(`[WindowStore Migration v2] Removing maxSize from ${id}`);
        const { maxSize: _, ...rest } = windowState;
        migrated.set(id, rest as WindowState);
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 2 → 3: Remove maxSize from menubar windows
   * Menubar panels should have unlimited resizing capability for vertical layouts.
   */
  3: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const shouldRemoveMaxSize =
        id.startsWith("panel-menubar-") || id === "menubar-window";

      if (shouldRemoveMaxSize && windowState.maxSize !== undefined) {
        debugLog(`[WindowStore Migration v3] Removing maxSize from ${id}`);
        const { maxSize: _, ...rest } = windowState;
        migrated.set(id, rest as WindowState);
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 3 → 4: Apply proper maxSize to actionbar windows
   * This prevents resizing actionbar windows larger than their content.
   * The actual maxSize values are calculated dynamically in PanelRegistry
   * based on ACTION_BAR_DIMENSIONS - here we just clear any old maxSize
   * so the new values from config are applied.
   */
  4: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isActionbar =
        id.startsWith("panel-action") ||
        id.startsWith("panel-actionbar-") ||
        id === "action-window" ||
        id === "actionbar-window";

      if (isActionbar) {
        // Remove old maxSize (if any) so the new one from config is applied
        debugLog(
          `[WindowStore Migration v4] Resetting actionbar constraints for ${id}`,
        );
        const { maxSize: _, ...rest } = windowState;
        migrated.set(id, rest as WindowState);
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 4 → 5: Apply proper maxSize to menubar windows
   * This prevents resizing menubar windows larger than their content.
   * The actual maxSize values are calculated dynamically in PanelRegistry
   * based on MENUBAR_DIMENSIONS - here we just clear any old maxSize
   * so the new values from config are applied.
   * Note: This supersedes migration v3 which removed maxSize entirely.
   */
  5: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isMenubar =
        id.startsWith("panel-menubar-") || id === "menubar-window";

      if (isMenubar) {
        // Remove old maxSize (if any) so the new one from config is applied
        debugLog(
          `[WindowStore Migration v5] Resetting menubar constraints for ${id}`,
        );
        const { maxSize: _, ...rest } = windowState;
        migrated.set(id, rest as WindowState);
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 5 → 6: Remove aspectRatio from minimap windows
   * This allows independent width/height resizing instead of forcing square aspect.
   */
  6: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isMinimap =
        id.startsWith("panel-minimap-") || id === "minimap-window";

      if (isMinimap && windowState.aspectRatio !== undefined) {
        debugLog(`[WindowStore Migration v6] Removing aspectRatio from ${id}`);
        const { aspectRatio: _, ...rest } = windowState;
        migrated.set(id, rest as WindowState);
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 6 → 7: Reset stats panel size for new compact design (180x190)
   * The new design is significantly smaller and uses mini-bars.
   */
  7: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isStats = id.startsWith("panel-stats-") || id === "stats-window";

      if (isStats) {
        debugLog(
          `[WindowStore Migration v7] Resetting stats panel size for ${id}`,
        );
        // Reset size to new compact dimensions
        migrated.set(id, {
          ...windowState,
          size: { width: 180, height: 190 },
          minSize: { width: 160, height: 170 },
          maxSize: { width: 240, height: 260 },
        });
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  // v8: Expand stats panel for full skills display (all 13 skills)
  8: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isStats = id.startsWith("panel-stats-") || id === "stats-window";

      if (isStats) {
        debugLog(
          `[WindowStore Migration v8] Expanding stats panel for full skills display: ${id}`,
        );
        // Expand size to accommodate all 13 skills (combat, gathering, production)
        migrated.set(id, {
          ...windowState,
          size: { width: 200, height: 280 },
          minSize: { width: 180, height: 240 },
          maxSize: { width: 260, height: 360 },
        });
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  // v9: Tighter stats panel constraints to prevent content cutoff
  9: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isStats = id.startsWith("panel-stats-") || id === "stats-window";

      if (isStats) {
        debugLog(
          `[WindowStore Migration v9] Adjusting stats panel constraints: ${id}`,
        );
        // Tighter minimum to prevent content cutoff, limited max for consistency
        migrated.set(id, {
          ...windowState,
          size: { width: 210, height: 285 },
          minSize: { width: 195, height: 265 },
          maxSize: { width: 250, height: 340 },
        });
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 9 → 10: Reset menubar and actionbar constraints for dynamic sizing
   * Both MenuBarPanel and ActionBarPanel now dynamically set minSize = maxSize = content size
   * based on button/slot count. Clear any old constraints so the effects can apply fresh values.
   */
  10: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      const isMenubar =
        id.startsWith("panel-menubar-") || id === "menubar-window";
      const isActionbar =
        id.startsWith("panel-action") ||
        id.startsWith("panel-actionbar-") ||
        id === "action-window" ||
        id === "actionbar-window";

      if (isMenubar || isActionbar) {
        debugLog(
          `[WindowStore Migration v10] Resetting ${isMenubar ? "menubar" : "actionbar"} for dynamic sizing: ${id}`,
        );
        // Clear minSize and maxSize so the panel effects can set them dynamically
        const { minSize: _, maxSize: __, ...rest } = windowState;
        migrated.set(id, rest as WindowState);
      } else {
        migrated.set(id, windowState);
      }
    }
    return migrated;
  },

  /**
   * Migration 10 → 11: New default layout
   * Clear all windows to force the new default layout to be applied.
   * New layout: Settings+Chat on left, Minimap+Stats+Inventory on right, Menu bar bottom-right
   */
  11: (_windows) => {
    debugLog(
      "[WindowStore Migration v11] Clearing all windows for new default layout",
    );
    // Return empty map - InterfaceManager will create new defaults on mount
    return new Map<string, WindowState>();
  },

  /**
   * Migration 11 → 12: Fix default layout
   * Clear all windows again to apply corrected layout (Stats without Skills tab)
   */
  12: (_windows) => {
    debugLog(
      "[WindowStore Migration v12] Clearing all windows for corrected default layout",
    );
    // Return empty map - InterfaceManager will create new defaults on mount
    return new Map<string, WindowState>();
  },

  /**
   * Migration 12 → 13: Add anchor property to windows
   * Sets appropriate anchor based on window ID for responsive viewport scaling.
   * This enables proper edge-snapping when resizing between different screen sizes.
   */
  13: (windows) => {
    const migrated = new Map<string, WindowState>();
    for (const [id, windowState] of windows) {
      // Set anchor based on window ID if not already set
      const anchor = windowState.anchor ?? getDefaultAnchor(id);
      debugLog(
        `[WindowStore Migration v13] Setting anchor for ${id}: ${anchor}`,
      );
      migrated.set(id, {
        ...windowState,
        anchor,
      });
    }
    return migrated;
  },
};

/**
 * Run all migrations from fromVersion to SCHEMA_VERSION
 */
function runMigrations(
  windows: Map<string, WindowState>,
  fromVersion: number,
): Map<string, WindowState> {
  let current = windows;

  for (let version = fromVersion + 1; version <= SCHEMA_VERSION; version++) {
    const migration = migrations[version];
    if (migration) {
      debugLog(`[WindowStore] Running migration to v${version}`);
      current = migration(current);
    }
  }

  return current;
}

/**
 * Zustand store for window state management
 *
 * Uses persist middleware to automatically save/load from localStorage.
 * Window layouts are preserved across page reloads and server restarts.
 */
export const useWindowStore = create<WindowStoreState>()(
  persist(
    (set, get) => ({
      windows: new Map(),
      nextZIndex: 1000,

      createWindow: (config?: WindowConfig) => {
        const id = config?.id || generateId();
        const tabs: TabState[] = (config?.tabs || []).map((tabConfig) => ({
          id: tabConfig.id || generateTabId(),
          windowId: id,
          label: tabConfig.label,
          icon: tabConfig.icon,
          closeable: tabConfig.closeable ?? true,
          content: tabConfig.content,
        }));

        const size = config?.size ??
          DEFAULT_WINDOW_CONFIG.size ?? { width: 400, height: 300 };
        const rawPosition = config?.position ??
          DEFAULT_WINDOW_CONFIG.position ?? { x: 100, y: 100 };
        // Clamp position to viewport bounds
        const position = clampToViewport(rawPosition, size);

        const windowState: WindowState = {
          id,
          position,
          size,
          minSize: config?.minSize ??
            DEFAULT_WINDOW_CONFIG.minSize ?? { width: 200, height: 150 },
          maxSize: config?.maxSize,
          aspectRatio: config?.aspectRatio,
          tabs,
          activeTabIndex: 0,
          transparency:
            config?.transparency ?? DEFAULT_WINDOW_CONFIG.transparency ?? 0,
          visible: true,
          zIndex: get().nextZIndex,
          locked: false,
          anchor: config?.anchor ?? getDefaultAnchor(id),
        };

        set((state) => {
          const newWindows = new Map(state.windows);
          newWindows.set(id, windowState);
          return {
            windows: newWindows,
            nextZIndex: state.nextZIndex + 1,
          };
        });

        return windowState;
      },

      updateWindow: (id: string, updates: Partial<WindowState>) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, ...updates });
          return { windows: newWindows };
        });
      },

      destroyWindow: (id: string) => {
        set((state) => {
          const newWindows = new Map(state.windows);
          newWindows.delete(id);
          return { windows: newWindows };
        });
      },

      bringToFront: (id: string) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          // Already on top
          if (window.zIndex === state.nextZIndex - 1) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, zIndex: state.nextZIndex });
          return {
            windows: newWindows,
            nextZIndex: state.nextZIndex + 1,
          };
        });
      },

      getWindow: (id: string) => {
        return get().windows.get(id);
      },

      getAllWindows: () => {
        return Array.from(get().windows.values());
      },

      setWindows: (windows: WindowState[]) => {
        const windowMap = new Map<string, WindowState>();
        let maxZIndex = 1000;

        windows.forEach((w) => {
          // Clamp position to viewport bounds
          const clampedPosition = clampToViewport(w.position, w.size);
          windowMap.set(w.id, { ...w, position: clampedPosition });
          if (w.zIndex > maxZIndex) maxZIndex = w.zIndex;
        });

        set({
          windows: windowMap,
          nextZIndex: maxZIndex + 1,
        });
      },

      loadLayout: (
        windows: WindowState[],
        sourceResolution: { width: number; height: number },
      ) => {
        const currentWidth =
          typeof globalThis.window !== "undefined"
            ? globalThis.window.innerWidth
            : 1920;
        const currentHeight =
          typeof globalThis.window !== "undefined"
            ? globalThis.window.innerHeight
            : 1080;
        const scaleX = currentWidth / sourceResolution.width;
        const scaleY = currentHeight / sourceResolution.height;

        const scaledWindows = windows.map((w) => {
          const scaledSize = {
            width: Math.min(w.size.width, currentWidth - 50),
            height: Math.min(w.size.height, currentHeight - 50),
          };
          const scaledPosition = {
            x: Math.round(w.position.x * scaleX),
            y: Math.round(w.position.y * scaleY),
          };
          // Clamp to viewport after scaling
          const clampedPosition = clampToViewport(scaledPosition, scaledSize);
          return {
            ...w,
            position: clampedPosition,
            size: scaledSize,
          };
        });

        const windowMap = new Map<string, WindowState>();
        let maxZIndex = 1000;

        scaledWindows.forEach((w) => {
          windowMap.set(w.id, w);
          if (w.zIndex > maxZIndex) maxZIndex = w.zIndex;
        });

        set({
          windows: windowMap,
          nextZIndex: maxZIndex + 1,
        });
      },

      reset: () => {
        set({
          windows: new Map(),
          nextZIndex: 1000,
        });
      },

      // Tab operations
      addTab: (windowId: string, config: TabConfig) => {
        const window = get().windows.get(windowId);
        if (!window) return undefined;

        const tab: TabState = {
          id: config.id || generateTabId(),
          windowId,
          label: config.label,
          icon: config.icon,
          closeable: config.closeable ?? true,
          content: config.content,
        };

        set((state) => {
          const newWindows = new Map(state.windows);
          const existingWindow = newWindows.get(windowId);
          if (!existingWindow) return state;

          newWindows.set(windowId, {
            ...existingWindow,
            tabs: [...existingWindow.tabs, tab],
            activeTabIndex: existingWindow.tabs.length, // Select the new tab
          });
          return { windows: newWindows };
        });

        return tab;
      },

      removeTab: (windowId: string, tabId: string) => {
        set((state) => {
          const window = state.windows.get(windowId);
          if (!window) return state;

          const tabIndex = window.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const newTabs = window.tabs.filter((t) => t.id !== tabId);

          // If this was the last tab, destroy the window
          if (newTabs.length === 0) {
            const newWindows = new Map(state.windows);
            newWindows.delete(windowId);
            return { windows: newWindows };
          }

          // Adjust active tab index if needed
          let newActiveIndex = window.activeTabIndex;
          if (tabIndex <= window.activeTabIndex) {
            newActiveIndex = Math.max(0, window.activeTabIndex - 1);
          }
          newActiveIndex = Math.min(newActiveIndex, newTabs.length - 1);

          const newWindows = new Map(state.windows);
          newWindows.set(windowId, {
            ...window,
            tabs: newTabs,
            activeTabIndex: newActiveIndex,
          });
          return { windows: newWindows };
        });
      },

      setActiveTab: (windowId: string, index: number) => {
        set((state) => {
          const window = state.windows.get(windowId);
          if (!window) return state;

          const clampedIndex = Math.max(
            0,
            Math.min(index, window.tabs.length - 1),
          );

          const newWindows = new Map(state.windows);
          newWindows.set(windowId, { ...window, activeTabIndex: clampedIndex });
          return { windows: newWindows };
        });
      },

      reorderTabs: (windowId: string, fromIndex: number, toIndex: number) => {
        set((state) => {
          const window = state.windows.get(windowId);
          if (!window) return state;

          if (
            fromIndex < 0 ||
            fromIndex >= window.tabs.length ||
            toIndex < 0 ||
            toIndex >= window.tabs.length
          ) {
            return state;
          }

          const newTabs = [...window.tabs];
          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);

          // Adjust active tab index
          let newActiveIndex = window.activeTabIndex;
          if (window.activeTabIndex === fromIndex) {
            newActiveIndex = toIndex;
          } else if (
            fromIndex < window.activeTabIndex &&
            toIndex >= window.activeTabIndex
          ) {
            newActiveIndex--;
          } else if (
            fromIndex > window.activeTabIndex &&
            toIndex <= window.activeTabIndex
          ) {
            newActiveIndex++;
          }

          const newWindows = new Map(state.windows);
          newWindows.set(windowId, {
            ...window,
            tabs: newTabs,
            activeTabIndex: newActiveIndex,
          });
          return { windows: newWindows };
        });
      },

      moveTab: (
        tabId: string,
        sourceWindowId: string,
        targetWindowId: string,
        index?: number,
      ) => {
        set((state) => {
          const sourceWindow = state.windows.get(sourceWindowId);
          const targetWindow = state.windows.get(targetWindowId);

          if (!sourceWindow || !targetWindow) return state;

          const tabIndex = sourceWindow.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) return state;

          const tab = sourceWindow.tabs[tabIndex];
          const newSourceTabs = sourceWindow.tabs.filter((t) => t.id !== tabId);

          // Update tab's window ID
          const movedTab: TabState = { ...tab, windowId: targetWindowId };

          // Insert into target window
          const insertIndex = index ?? targetWindow.tabs.length;
          const newTargetTabs = [...targetWindow.tabs];
          newTargetTabs.splice(insertIndex, 0, movedTab);

          const newWindows = new Map(state.windows);

          // Handle source window
          if (newSourceTabs.length === 0) {
            // Remove empty window
            newWindows.delete(sourceWindowId);
          } else {
            // Adjust active tab index
            let newActiveIndex = sourceWindow.activeTabIndex;
            if (tabIndex <= sourceWindow.activeTabIndex) {
              newActiveIndex = Math.max(0, sourceWindow.activeTabIndex - 1);
            }
            newActiveIndex = Math.min(newActiveIndex, newSourceTabs.length - 1);

            newWindows.set(sourceWindowId, {
              ...sourceWindow,
              tabs: newSourceTabs,
              activeTabIndex: newActiveIndex,
            });
          }

          // Update target window
          newWindows.set(targetWindowId, {
            ...targetWindow,
            tabs: newTargetTabs,
            activeTabIndex: insertIndex,
          });

          return { windows: newWindows };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Custom serialization to handle Map - includes schema version and viewport size
      partialize: (state) => ({
        version: SCHEMA_VERSION,
        windows: Array.from(state.windows.entries()),
        nextZIndex: state.nextZIndex,
        // Store viewport size for proportional scaling on different screen sizes
        savedViewportSize: {
          width:
            typeof globalThis.window !== "undefined"
              ? globalThis.window.innerWidth
              : 1920,
          height:
            typeof globalThis.window !== "undefined"
              ? globalThis.window.innerHeight
              : 1080,
        },
      }),
      // Custom deserialization to restore Map with versioned migrations
      merge: (persisted, current) => {
        const persistedState = persisted as
          | {
              version?: number;
              windows?: [string, WindowState][];
              nextZIndex?: number;
              savedViewportSize?: { width: number; height: number };
            }
          | undefined;
        if (!persistedState?.windows) {
          return current;
        }

        // Get saved viewport size for proportional scaling
        const savedViewport = persistedState.savedViewportSize || {
          width: 1920,
          height: 1080,
        };
        const currentViewport = {
          width:
            typeof globalThis.window !== "undefined"
              ? globalThis.window.innerWidth
              : 1920,
          height:
            typeof globalThis.window !== "undefined"
              ? globalThis.window.innerHeight
              : 1080,
        };

        // Detect mobile/desktop mode change between saved and current viewport
        const MOBILE_BREAKPOINT = 768;
        const savedWasMobile = savedViewport.width < MOBILE_BREAKPOINT;
        const currentIsMobile = currentViewport.width < MOBILE_BREAKPOINT;
        const isMobileToDesktopTransition = savedWasMobile && !currentIsMobile;

        debugLog(
          `[WindowStore] Loading layout - saved viewport: ${savedViewport.width}x${savedViewport.height}, ` +
            `current: ${currentViewport.width}x${currentViewport.height}, ` +
            `transition: ${isMobileToDesktopTransition ? "mobile->desktop" : "none"}`,
        );

        // Get persisted version (default to 1 for pre-versioning data)
        const storedVersion = persistedState.version ?? 1;

        if (storedVersion < SCHEMA_VERSION) {
          debugLog(
            `[WindowStore] Migrating from v${storedVersion} to v${SCHEMA_VERSION}`,
          );
        }

        // First pass: basic tab migrations (always run for compatibility)
        const basicMigratedWindows: [string, WindowState][] = [];

        for (const [id, windowState] of persistedState.windows) {
          // Migration: Skip store/bank windows (they're rendered as modals now)
          // Check window ID and tab labels for store/bank patterns
          const idLower = id.toLowerCase();

          // First check: ID-based patterns
          const idHasModalPattern =
            idLower.includes("store") ||
            idLower.includes("bank") ||
            idLower.includes("trade") ||
            idLower.includes("central") ||
            idLower.includes("general") ||
            idLower.includes("shop") ||
            idLower.includes("keeper");

          // Second check: Tab-based patterns (more thorough)
          const tabHasModalPattern = windowState.tabs.some((tab) => {
            const label = tab.label?.toLowerCase() || "";
            const content =
              typeof tab.content === "string" ? tab.content.toLowerCase() : "";
            const tabId = tab.id?.toLowerCase() || "";

            return (
              // Content matches
              content.includes("store") ||
              content.includes("bank") ||
              // Label matches
              label.includes("store") ||
              label.includes("bank") ||
              label.includes("trade") ||
              label.includes("central") ||
              label.includes("general") ||
              label.includes("shop") ||
              label.includes("keeper") ||
              // Tab ID matches
              tabId.includes("store") ||
              tabId.includes("bank") ||
              tabId.includes("trade")
            );
          });

          const isOrphanedModal = idHasModalPattern || tabHasModalPattern;

          if (isOrphanedModal) {
            debugLog(`[WindowStore] Removing orphaned modal window: ${id}`, {
              tabs: windowState.tabs.map((t) => ({
                id: t.id,
                label: t.label,
                content:
                  typeof t.content === "string" ? t.content : "(component)",
              })),
            });
            continue;
          }

          const migratedTabs = migrateTabs(windowState.tabs);

          // Skip windows that have no tabs left after filtering deprecated panels
          if (migratedTabs.length === 0) {
            debugLog(
              `[WindowStore] Removing empty window after migration: ${id}`,
            );
            continue;
          }

          // Adjust activeTabIndex if it's now out of bounds
          const newActiveIndex = Math.min(
            windowState.activeTabIndex,
            migratedTabs.length - 1,
          );

          // Build migrated window state
          const migratedWindow: WindowState = {
            ...windowState,
            tabs: migratedTabs,
            activeTabIndex: Math.max(0, newActiveIndex),
          };

          basicMigratedWindows.push([id, migratedWindow]);
        }

        // Second pass: run versioned migrations
        let windowsMap = new Map(basicMigratedWindows);
        if (storedVersion < SCHEMA_VERSION) {
          windowsMap = runMigrations(windowsMap, storedVersion);
        }

        // Third pass: reposition windows using anchor-based positioning
        // This ensures windows maintain their position relative to their anchor point
        const clampedWindowsMap = new Map<string, WindowState>();

        // Track stacking offsets for each anchor (for mobile->desktop transition)
        const anchorStackOffsets = new Map<string, number>();

        for (const [id, windowState] of windowsMap) {
          // Get anchor from window state or determine from ID
          const anchor: WindowAnchor =
            windowState.anchor ?? getDefaultAnchor(id);

          let newPosition: { x: number; y: number };

          if (isMobileToDesktopTransition) {
            // For mobile->desktop transition, use default anchor positions with stacking
            // Mobile positions are meaningless for desktop layout
            const basePosition = getDefaultPositionForAnchor(
              windowState.size,
              anchor,
              currentViewport,
            );

            // Get current stack offset for this anchor
            const stackOffset = anchorStackOffsets.get(anchor) ?? 0;

            // Apply stack offset based on anchor type
            // For bottom anchors, stack upward; for top anchors, stack downward
            if (anchor.startsWith("bottom")) {
              newPosition = {
                x: basePosition.x,
                y: basePosition.y - stackOffset,
              };
            } else if (anchor.startsWith("top")) {
              newPosition = {
                x: basePosition.x,
                y: basePosition.y + stackOffset,
              };
            } else {
              // Center anchors - stack horizontally or use offset
              newPosition = {
                x: basePosition.x + stackOffset * 0.3,
                y: basePosition.y,
              };
            }

            // Update stack offset for next window at this anchor
            anchorStackOffsets.set(
              anchor,
              stackOffset + windowState.size.height + 5,
            );

            debugLog(
              `[WindowStore] Reset window ${id} to anchor ${anchor} position: (${newPosition.x}, ${newPosition.y})`,
            );
          } else {
            // Normal resize: preserve offset from anchor
            newPosition = repositionWindowForViewport(
              windowState.position,
              windowState.size,
              anchor,
              savedViewport,
              currentViewport,
            );
            debugLog(
              `[WindowStore] Repositioning window ${id} using anchor ${anchor}: ` +
                `(${windowState.position.x}, ${windowState.position.y}) -> (${newPosition.x}, ${newPosition.y})`,
            );
          }

          clampedWindowsMap.set(id, {
            ...windowState,
            position: newPosition,
            anchor, // Ensure anchor is saved
          });
        }

        return {
          ...current,
          windows: clampedWindowsMap,
          nextZIndex: persistedState.nextZIndex ?? current.nextZIndex,
        };
      },
    },
  ),
);
