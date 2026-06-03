import { create } from "zustand";
import type { LayoutPreset, WindowState, Size } from "../types";

/** Generate a unique preset ID */
function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Preset store state and actions */
export interface PresetStoreState {
  /** All saved presets */
  presets: LayoutPreset[];
  /** Currently active preset ID */
  activePresetId: string | null;
  /** Whether presets are loading */
  isLoading: boolean;

  /** Load presets from storage */
  loadFromStorage: () => Promise<void>;
  /** Save current layout as a preset */
  savePreset: (
    name: string,
    windows: WindowState[],
    resolution: Size,
  ) => Promise<LayoutPreset>;
  /** Delete a preset */
  deletePreset: (id: string) => Promise<void>;
  /** Rename a preset */
  renamePreset: (id: string, name: string) => Promise<void>;
  /** Set the active preset */
  setActivePreset: (id: string | null) => void;
  /** Internal: set presets array */
  _setPresets: (presets: LayoutPreset[]) => void;
}

// Ensure we have IndexedDB types in scope
declare const indexedDB: IDBFactory;

// IndexedDB will be initialized lazily
let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("hyperia", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("presets")) {
        db.createObjectStore("presets", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
    };
  });

  return dbPromise;
}

async function getAllPresets(): Promise<LayoutPreset[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readonly");
    const store = tx.objectStore("presets");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function savePresetToDb(preset: LayoutPreset): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    const store = tx.objectStore("presets");
    const request = store.put(preset);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function deletePresetFromDb(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    const store = tx.objectStore("presets");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Zustand store for layout presets
 */
export const usePresetStore = create<PresetStoreState>((set, get) => ({
  presets: [],
  activePresetId: null,
  isLoading: false,

  loadFromStorage: async () => {
    set({ isLoading: true });
    try {
      const presets = await getAllPresets();
      set({ presets, isLoading: false });
    } catch (error) {
      console.error("Failed to load presets:", error);
      set({ isLoading: false });
    }
  },

  savePreset: async (
    name: string,
    windows: WindowState[],
    resolution: Size,
  ): Promise<LayoutPreset> => {
    const now = Date.now();
    const preset: LayoutPreset = {
      id: generatePresetId(),
      name,
      windows: windows.map((w) => ({ ...w })), // Deep copy
      createdAt: now,
      modifiedAt: now,
      resolution,
    };

    await savePresetToDb(preset);

    set((state) => ({
      presets: [...state.presets, preset],
      activePresetId: preset.id,
    }));

    return preset;
  },

  deletePreset: async (id: string) => {
    await deletePresetFromDb(id);

    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
      activePresetId: state.activePresetId === id ? null : state.activePresetId,
    }));
  },

  renamePreset: async (id: string, name: string) => {
    const { presets } = get();
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;

    const updated: LayoutPreset = {
      ...preset,
      name,
      modifiedAt: Date.now(),
    };

    await savePresetToDb(updated);

    set((state) => ({
      presets: state.presets.map((p) => (p.id === id ? updated : p)),
    }));
  },

  setActivePreset: (id: string | null) => {
    set({ activePresetId: id });
  },

  _setPresets: (presets: LayoutPreset[]) => {
    set({ presets });
  },
}));
