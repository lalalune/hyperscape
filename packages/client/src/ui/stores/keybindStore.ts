/**
 * Keybind Store
 *
 * Zustand store for custom keybind management.
 * Persists keybinds to localStorage and provides hooks for
 * reading and updating keybinds across the application.
 *
 * @packageDocumentation
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/shallow";

/** Keybind action categories */
export type KeybindCategory =
  | "actionbar" // ActionBar slots
  | "presets" // Preset load/save
  | "interface" // UI toggles
  | "movement" // Movement controls
  | "combat" // Combat shortcuts
  | "camera"; // Camera controls

/** Individual keybind definition */
export interface KeybindDefinition {
  /** Unique ID: "actionbar.slot.1", "preset.load.1", etc. */
  id: string;
  /** Category for grouping in UI */
  category: KeybindCategory;
  /** Display label */
  label: string;
  /** Description for tooltips */
  description?: string;
  /** Default key binding */
  defaultKey: string;
  /** Whether this keybind can be changed */
  isRebindable: boolean;
}

/** Keybind profile for saving sets */
export interface KeybindProfile {
  id: string;
  name: string;
  /** Map of keybind ID to key string */
  bindings: Record<string, string>;
  isDefault: boolean;
  createdAt: number;
}

/** Default action bar keybinds (slots 1-14) */
export const DEFAULT_ACTIONBAR_KEYBINDS: KeybindDefinition[] = [
  {
    id: "actionbar.slot.0",
    category: "actionbar",
    label: "Slot 1",
    defaultKey: "1",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.1",
    category: "actionbar",
    label: "Slot 2",
    defaultKey: "2",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.2",
    category: "actionbar",
    label: "Slot 3",
    defaultKey: "3",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.3",
    category: "actionbar",
    label: "Slot 4",
    defaultKey: "4",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.4",
    category: "actionbar",
    label: "Slot 5",
    defaultKey: "5",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.5",
    category: "actionbar",
    label: "Slot 6",
    defaultKey: "6",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.6",
    category: "actionbar",
    label: "Slot 7",
    defaultKey: "7",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.7",
    category: "actionbar",
    label: "Slot 8",
    defaultKey: "8",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.8",
    category: "actionbar",
    label: "Slot 9",
    defaultKey: "9",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.9",
    category: "actionbar",
    label: "Slot 10",
    defaultKey: "0",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.10",
    category: "actionbar",
    label: "Slot 11",
    defaultKey: "-",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.11",
    category: "actionbar",
    label: "Slot 12",
    defaultKey: "=",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.12",
    category: "actionbar",
    label: "Slot 13",
    defaultKey: "Backspace",
    isRebindable: true,
  },
  {
    id: "actionbar.slot.13",
    category: "actionbar",
    label: "Slot 14",
    defaultKey: "Insert",
    isRebindable: true,
  },
];

/** Default preset keybinds */
export const DEFAULT_PRESET_KEYBINDS: KeybindDefinition[] = [
  {
    id: "preset.load.0",
    category: "presets",
    label: "Load Preset 1",
    defaultKey: "F1",
    isRebindable: true,
  },
  {
    id: "preset.load.1",
    category: "presets",
    label: "Load Preset 2",
    defaultKey: "F2",
    isRebindable: true,
  },
  {
    id: "preset.load.2",
    category: "presets",
    label: "Load Preset 3",
    defaultKey: "F3",
    isRebindable: true,
  },
  {
    id: "preset.load.3",
    category: "presets",
    label: "Load Preset 4",
    defaultKey: "F4",
    isRebindable: true,
  },
  {
    id: "preset.save.0",
    category: "presets",
    label: "Save Preset 1",
    defaultKey: "Shift+F1",
    isRebindable: true,
  },
  {
    id: "preset.save.1",
    category: "presets",
    label: "Save Preset 2",
    defaultKey: "Shift+F2",
    isRebindable: true,
  },
  {
    id: "preset.save.2",
    category: "presets",
    label: "Save Preset 3",
    defaultKey: "Shift+F3",
    isRebindable: true,
  },
  {
    id: "preset.save.3",
    category: "presets",
    label: "Save Preset 4",
    defaultKey: "Shift+F4",
    isRebindable: true,
  },
];

/** Default interface keybinds */
export const DEFAULT_INTERFACE_KEYBINDS: KeybindDefinition[] = [
  {
    id: "interface.editMode",
    category: "interface",
    label: "Toggle Edit Mode",
    defaultKey: "L",
    isRebindable: true,
  },
  {
    id: "interface.hideUI",
    category: "interface",
    label: "Hide UI",
    defaultKey: "Z",
    isRebindable: true,
  },
  {
    id: "interface.inventory",
    category: "interface",
    label: "Toggle Inventory",
    defaultKey: "I",
    isRebindable: true,
  },
  {
    id: "interface.equipment",
    category: "interface",
    label: "Toggle Equipment",
    defaultKey: "E",
    isRebindable: true,
  },
  {
    id: "interface.skills",
    category: "interface",
    label: "Toggle Skills",
    defaultKey: "K",
    isRebindable: true,
  },
  {
    id: "interface.prayer",
    category: "interface",
    label: "Toggle Prayer",
    defaultKey: "P",
    isRebindable: true,
  },
  {
    id: "interface.settings",
    category: "interface",
    label: "Toggle Settings",
    defaultKey: "Escape",
    isRebindable: false,
  },
];

/** All default keybinds */
export const ALL_DEFAULT_KEYBINDS: KeybindDefinition[] = [
  ...DEFAULT_ACTIONBAR_KEYBINDS,
  ...DEFAULT_PRESET_KEYBINDS,
  ...DEFAULT_INTERFACE_KEYBINDS,
];

/** Keybind store state */
export interface KeybindStoreState {
  /** Custom keybind overrides (id -> key) */
  customBindings: Record<string, string>;
  /** Available profiles */
  profiles: KeybindProfile[];
  /** Active profile ID */
  activeProfileId: string | null;
  /** Currently listening for a new keybind */
  listeningFor: string | null;

  // Actions
  /** Get the key for a keybind ID (custom or default) */
  getKey: (id: string) => string;
  /** Get all keybinds for a category */
  getKeybindsByCategory: (
    category: KeybindCategory,
  ) => { id: string; key: string; definition: KeybindDefinition }[];
  /** Get action bar keybinds as simple string array (for ActionBar component) */
  getActionBarKeybinds: () => string[];
  /** Set a custom keybind */
  setKeybind: (id: string, key: string) => void;
  /** Reset a keybind to default */
  resetKeybind: (id: string) => void;
  /** Reset all keybinds to defaults */
  resetAllKeybinds: () => void;
  /** Start listening for a keybind change */
  startListening: (id: string) => void;
  /** Stop listening */
  stopListening: () => void;
  /** Save current bindings as a profile */
  saveProfile: (name: string) => void;
  /** Load a profile */
  loadProfile: (id: string) => void;
  /** Delete a profile */
  deleteProfile: (id: string) => void;
}

/** Storage key */
const STORAGE_KEY = "hyperia-keybinds";

/**
 * Zustand store for keybind management
 */
export const useKeybindStore = create<KeybindStoreState>()(
  persist(
    (set, get) => ({
      customBindings: {},
      profiles: [],
      activeProfileId: null,
      listeningFor: null,

      getKey: (id: string) => {
        const custom = get().customBindings[id];
        if (custom !== undefined) return custom;

        // Find default
        const def = ALL_DEFAULT_KEYBINDS.find((d) => d.id === id);
        return def?.defaultKey ?? "";
      },

      getKeybindsByCategory: (category: KeybindCategory) => {
        const definitions = ALL_DEFAULT_KEYBINDS.filter(
          (d) => d.category === category,
        );
        return definitions.map((def) => ({
          id: def.id,
          key: get().getKey(def.id),
          definition: def,
        }));
      },

      getActionBarKeybinds: () => {
        // Return keybinds for slots 0-13 in order
        return DEFAULT_ACTIONBAR_KEYBINDS.map((def) => get().getKey(def.id));
      },

      setKeybind: (id: string, key: string) => {
        const def = ALL_DEFAULT_KEYBINDS.find((d) => d.id === id);
        if (!def || !def.isRebindable) return;

        set((state) => ({
          customBindings: { ...state.customBindings, [id]: key },
          listeningFor: null,
        }));

        // Emit event for other systems
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("keybindChange", { detail: { id, key } }),
          );
        }
      },

      resetKeybind: (id: string) => {
        set((state) => {
          const { [id]: _, ...rest } = state.customBindings;
          return { customBindings: rest };
        });
      },

      resetAllKeybinds: () => {
        set({ customBindings: {}, activeProfileId: null });
      },

      startListening: (id: string) => {
        const def = ALL_DEFAULT_KEYBINDS.find((d) => d.id === id);
        if (!def || !def.isRebindable) return;
        set({ listeningFor: id });
      },

      stopListening: () => {
        set({ listeningFor: null });
      },

      saveProfile: (name: string) => {
        const id = `profile_${Date.now()}`;
        const profile: KeybindProfile = {
          id,
          name,
          bindings: { ...get().customBindings },
          isDefault: false,
          createdAt: Date.now(),
        };

        set((state) => ({
          profiles: [...state.profiles, profile],
          activeProfileId: id,
        }));
      },

      loadProfile: (id: string) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return;

        set({
          customBindings: { ...profile.bindings },
          activeProfileId: id,
        });
      },

      deleteProfile: (id: string) => {
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
          activeProfileId:
            state.activeProfileId === id ? null : state.activeProfileId,
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        customBindings: state.customBindings,
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
      }),
    },
  ),
);

/**
 * Hook to get a single keybind value
 */
export function useKeybind(id: string): string {
  return useKeybindStore((s) => s.getKey(id));
}

/**
 * Hook to get all action bar keybinds
 * Uses useShallow to prevent infinite re-renders from array creation
 */
export function useActionBarKeybinds(): string[] {
  return useKeybindStore(useShallow((s) => s.getActionBarKeybinds()));
}

/**
 * Hook to check if currently listening for a specific keybind
 */
export function useIsListeningFor(id: string): boolean {
  return useKeybindStore((s) => s.listeningFor === id);
}
