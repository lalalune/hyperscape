/**
 * useSettings Hook
 *
 * Main hook for settings state management with persistence.
 * Supports localStorage/IndexedDB persistence, profiles, and import/export.
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_SETTINGS,
  getDefaultValues,
  getSettingById,
  searchSettings,
  validateSettingValue,
  type SettingCategory,
  type SettingDefinition,
} from "./settingsSchema";

// ============================================================================
// Types
// ============================================================================

/** Settings profile for saving/loading configurations */
export interface SettingsProfile {
  /** Unique profile ID */
  id: string;
  /** Display name */
  name: string;
  /** All setting values */
  values: Record<string, unknown>;
  /** When created */
  createdAt: number;
  /** When last modified */
  modifiedAt: number;
  /** Whether this is the default profile */
  isDefault: boolean;
}

/** Result from useSettings hook */
export interface UseSettingsResult {
  /** All current setting values */
  values: Record<string, unknown>;
  /** Get a specific setting value */
  getValue: <T>(id: string) => T;
  /** Set a specific setting value */
  setValue: (id: string, value: unknown) => void;
  /** Set multiple values at once */
  setValues: (values: Record<string, unknown>) => void;
  /** Reset a single setting to default */
  resetSetting: (id: string) => void;
  /** Reset all settings in a category to defaults */
  resetCategory: (category: SettingCategory) => void;
  /** Reset all settings to defaults */
  resetAll: () => void;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Save current changes */
  save: () => Promise<void>;
  /** Discard unsaved changes */
  discardChanges: () => void;
  /** Search settings by query */
  search: (query: string) => SettingDefinition[];
  /** All available profiles */
  profiles: SettingsProfile[];
  /** Currently active profile */
  activeProfile: SettingsProfile | null;
  /** Create a new profile */
  createProfile: (name: string) => Promise<SettingsProfile>;
  /** Load a profile */
  loadProfile: (id: string) => Promise<void>;
  /** Delete a profile */
  deleteProfile: (id: string) => Promise<void>;
  /** Rename a profile */
  renameProfile: (id: string, name: string) => Promise<void>;
  /** Export settings as JSON string */
  exportSettings: () => string;
  /** Import settings from JSON string */
  importSettings: (json: string) => boolean;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Last error (if any) */
  error: string | null;
}

/** Options for useSettings hook */
export interface UseSettingsOptions {
  /** Storage key prefix */
  storageKey?: string;
  /** Whether to auto-save on change (default: false) */
  autoSave?: boolean;
  /** Custom persistence adapter */
  persistence?: SettingsPersistence;
}

/** Persistence adapter interface */
export interface SettingsPersistence {
  load: () => Promise<{
    values: Record<string, unknown>;
    profiles: SettingsProfile[];
    activeProfileId: string | null;
  } | null>;
  save: (data: {
    values: Record<string, unknown>;
    profiles: SettingsProfile[];
    activeProfileId: string | null;
  }) => Promise<void>;
}

// ============================================================================
// Default Persistence (localStorage)
// ============================================================================

function createLocalStoragePersistence(key: string): SettingsPersistence {
  return {
    load: async () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        console.warn("Failed to load settings from localStorage");
      }
      return null;
    },
    save: async (data) => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        console.warn("Failed to save settings to localStorage");
      }
    },
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

const DEFAULT_STORAGE_KEY = "hyperia-settings";

/**
 * Hook for managing game settings
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const {
 *     getValue,
 *     setValue,
 *     hasUnsavedChanges,
 *     save,
 *     resetAll,
 *   } = useSettings();
 *
 *   return (
 *     <div>
 *       <label>
 *         Master Volume
 *         <input
 *           type="range"
 *           value={getValue<number>('audio.master')}
 *           onChange={(e) => setValue('audio.master', Number(e.target.value))}
 *         />
 *       </label>
 *       {hasUnsavedChanges && (
 *         <button onClick={save}>Save Changes</button>
 *       )}
 *       <button onClick={resetAll}>Reset to Defaults</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSettings(
  options: UseSettingsOptions = {},
): UseSettingsResult {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    autoSave = false,
    persistence = createLocalStoragePersistence(storageKey),
  } = options;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<Record<string, unknown>>(() =>
    getDefaultValues(),
  );
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>(
    () => getDefaultValues(),
  );
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const data = await persistence.load();
        if (data) {
          // Merge with defaults to handle new settings
          const defaults = getDefaultValues();
          const merged = { ...defaults, ...data.values };
          setSavedValues(merged);
          setCurrentValues(merged);
          setProfiles(data.profiles ?? []);
          setActiveProfileId(data.activeProfileId);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load settings",
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [persistence]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return Object.keys(currentValues).some(
      (key) => currentValues[key] !== savedValues[key],
    );
  }, [currentValues, savedValues]);

  // Get active profile
  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  // Get a setting value
  const getValue = useCallback(
    <T>(id: string): T => {
      return currentValues[id] as T;
    },
    [currentValues],
  );

  // Set a setting value
  const setValue = useCallback(
    (id: string, value: unknown) => {
      const setting = getSettingById(id);
      if (setting && !validateSettingValue(setting, value)) {
        console.warn(`Invalid value for setting ${id}:`, value);
        return;
      }

      setCurrentValues((prev) => ({ ...prev, [id]: value }));

      // Auto-save if enabled
      if (autoSave) {
        const newValues = { ...currentValues, [id]: value };
        persistence.save({
          values: newValues,
          profiles,
          activeProfileId,
        });
        setSavedValues(newValues);
      }
    },
    [currentValues, autoSave, persistence, profiles, activeProfileId],
  );

  // Set multiple values at once
  const setValues = useCallback((values: Record<string, unknown>) => {
    const validated: Record<string, unknown> = {};
    for (const [id, value] of Object.entries(values)) {
      const setting = getSettingById(id);
      if (setting && validateSettingValue(setting, value)) {
        validated[id] = value;
      }
    }
    setCurrentValues((prev) => ({ ...prev, ...validated }));
  }, []);

  // Reset a single setting
  const resetSetting = useCallback((id: string) => {
    const setting = getSettingById(id);
    if (setting) {
      setCurrentValues((prev) => ({ ...prev, [id]: setting.defaultValue }));
    }
  }, []);

  // Reset a category
  const resetCategory = useCallback((category: SettingCategory) => {
    const categorySettings = ALL_SETTINGS.filter(
      (s) => s.category === category,
    );
    const categoryDefaults: Record<string, unknown> = {};
    for (const setting of categorySettings) {
      categoryDefaults[setting.id] = setting.defaultValue;
    }
    setCurrentValues((prev) => ({ ...prev, ...categoryDefaults }));
  }, []);

  // Reset all settings
  const resetAll = useCallback(() => {
    setCurrentValues(getDefaultValues());
  }, []);

  // Save changes
  const save = useCallback(async () => {
    try {
      await persistence.save({
        values: currentValues,
        profiles,
        activeProfileId,
      });
      setSavedValues(currentValues);
      setError(null);

      // Emit event for other systems
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("settingsChanged", { detail: currentValues }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      throw err;
    }
  }, [currentValues, profiles, activeProfileId, persistence]);

  // Discard unsaved changes
  const discardChanges = useCallback(() => {
    setCurrentValues(savedValues);
  }, [savedValues]);

  // Search settings
  const search = useCallback((query: string) => {
    return searchSettings(query);
  }, []);

  // Create a profile
  const createProfile = useCallback(
    async (name: string): Promise<SettingsProfile> => {
      const profile: SettingsProfile = {
        id: `profile_${Date.now()}`,
        name,
        values: { ...currentValues },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isDefault: false,
      };

      const newProfiles = [...profiles, profile];
      setProfiles(newProfiles);
      setActiveProfileId(profile.id);

      await persistence.save({
        values: currentValues,
        profiles: newProfiles,
        activeProfileId: profile.id,
      });

      return profile;
    },
    [currentValues, profiles, persistence],
  );

  // Load a profile
  const loadProfile = useCallback(
    async (id: string) => {
      const profile = profiles.find((p) => p.id === id);
      if (!profile) {
        throw new Error(`Profile ${id} not found`);
      }

      // Merge profile values with defaults
      const defaults = getDefaultValues();
      const merged = { ...defaults, ...profile.values };

      setCurrentValues(merged);
      setSavedValues(merged);
      setActiveProfileId(id);

      await persistence.save({
        values: merged,
        profiles,
        activeProfileId: id,
      });
    },
    [profiles, persistence],
  );

  // Delete a profile
  const deleteProfile = useCallback(
    async (id: string) => {
      const newProfiles = profiles.filter((p) => p.id !== id);
      const newActiveId = activeProfileId === id ? null : activeProfileId;

      setProfiles(newProfiles);
      setActiveProfileId(newActiveId);

      await persistence.save({
        values: currentValues,
        profiles: newProfiles,
        activeProfileId: newActiveId,
      });
    },
    [profiles, activeProfileId, currentValues, persistence],
  );

  // Rename a profile
  const renameProfile = useCallback(
    async (id: string, name: string) => {
      const newProfiles = profiles.map((p) =>
        p.id === id ? { ...p, name, modifiedAt: Date.now() } : p,
      );

      setProfiles(newProfiles);

      await persistence.save({
        values: currentValues,
        profiles: newProfiles,
        activeProfileId,
      });
    },
    [profiles, currentValues, activeProfileId, persistence],
  );

  // Export settings
  const exportSettings = useCallback((): string => {
    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      values: currentValues,
      profile: activeProfile
        ? { name: activeProfile.name }
        : { name: "Exported Settings" },
    };
    return JSON.stringify(exportData, null, 2);
  }, [currentValues, activeProfile]);

  // Import settings
  const importSettings = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (typeof data !== "object" || !data.values) {
        throw new Error("Invalid settings format");
      }

      // Validate and merge with defaults
      const defaults = getDefaultValues();
      const imported: Record<string, unknown> = { ...defaults };

      for (const [id, value] of Object.entries(data.values)) {
        const setting = getSettingById(id);
        if (setting && validateSettingValue(setting, value)) {
          imported[id] = value;
        }
      }

      setCurrentValues(imported);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import settings",
      );
      return false;
    }
  }, []);

  return {
    values: currentValues,
    getValue,
    setValue,
    setValues,
    resetSetting,
    resetCategory,
    resetAll,
    hasUnsavedChanges,
    save,
    discardChanges,
    search,
    profiles,
    activeProfile,
    createProfile,
    loadProfile,
    deleteProfile,
    renameProfile,
    exportSettings,
    importSettings,
    isLoading,
    error,
  };
}
