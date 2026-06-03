import type { LayoutPreset } from "../../types";

/**
 * IndexedDB persistence layer for Hyperia UI
 *
 * This module provides low-level access to the IndexedDB storage.
 * For most use cases, use the usePresets hook instead.
 */

const DB_NAME = "hyperia";
const DB_VERSION = 1;

/** Database stores - used to type-check store access */
type _StoreNames = "presets" | "settings" | "currentLayout";

// Ensure we have IndexedDB types in scope
declare const indexedDB: IDBFactory;

/** Get or create the database connection */
let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create presets store
      if (!db.objectStoreNames.contains("presets")) {
        db.createObjectStore("presets", { keyPath: "id" });
      }

      // Create settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }

      // Create current layout store
      if (!db.objectStoreNames.contains("currentLayout")) {
        db.createObjectStore("currentLayout");
      }
    };
  });

  return dbPromise;
}

/** Close the database connection */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/** Get all presets */
export async function getAllPresets(): Promise<LayoutPreset[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readonly");
    const store = tx.objectStore("presets");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/** Get a single preset by ID */
export async function getPreset(id: string): Promise<LayoutPreset | undefined> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readonly");
    const store = tx.objectStore("presets");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/** Save a preset */
export async function savePreset(preset: LayoutPreset): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    const store = tx.objectStore("presets");
    const request = store.put(preset);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/** Delete a preset */
export async function deletePreset(id: string): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("presets", "readwrite");
    const store = tx.objectStore("presets");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/** Get a setting value */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/** Set a setting value */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/** Save current layout (auto-save) */
export async function saveCurrentLayout(windows: unknown[]): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("currentLayout", "readwrite");
    const store = tx.objectStore("currentLayout");
    const request = store.put(windows, "current");

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/** Load current layout */
export async function loadCurrentLayout(): Promise<unknown[] | undefined> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("currentLayout", "readonly");
    const store = tx.objectStore("currentLayout");
    const request = store.get("current");

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
