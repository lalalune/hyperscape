/**
 * In-memory installed-plugins registry for the Plugin Browser UI.
 *
 * Browser-side persistence option for installed plugin bundles.
 * Today this is in-memory only (clears on page reload). When the
 * Plugin Browser graduates to a "real" install flow with hot-reload
 * into the running editor world, the byte payloads can be written
 * to IndexedDB here without changing the public API.
 *
 * Phase I5 close-out — paired with `installPlugin()` in
 * `pluginApi.ts`.
 */

import type { InstalledPlugin } from "./pluginApi";

type Listener = () => void;

const installed = new Map<string, InstalledPlugin>();
const listeners = new Set<Listener>();

/**
 * Cached snapshot — `useSyncExternalStore` requires reference
 * stability between calls when state hasn't changed, otherwise
 * React thinks the snapshot changed on every render and loops
 * infinitely. We rebuild this only when the underlying Map mutates.
 */
let snapshot: InstalledPlugin[] = [];

function key(id: string, version: string): string {
  return `${id}@${version}`;
}

function rebuildSnapshot(): void {
  snapshot = Array.from(installed.values()).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

function notify(): void {
  rebuildSnapshot();
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // listener errors must not break the store
    }
  }
}

/**
 * Record a successful install. Replaces any existing entry for the
 * same id+version pair (idempotent — useful for reinstall flows).
 */
export function recordInstalledPlugin(plugin: InstalledPlugin): void {
  installed.set(key(plugin.id, plugin.version), plugin);
  notify();
}

/** Remove a plugin from the local installed set. */
export function uninstallPlugin(id: string, version: string): boolean {
  const existed = installed.delete(key(id, version));
  if (existed) notify();
  return existed;
}

/**
 * Read-only snapshot of currently installed plugins, newest-first.
 * Returns the same array reference between calls until `notify()`
 * rebuilds it — required by `useSyncExternalStore`.
 */
export function listInstalledPlugins(): InstalledPlugin[] {
  return snapshot;
}

/** Look up a single installed plugin by id+version. */
export function getInstalledPlugin(
  id: string,
  version: string,
): InstalledPlugin | undefined {
  return installed.get(key(id, version));
}

/** Returns true if id+version is currently installed locally. */
export function isInstalled(id: string, version: string): boolean {
  return installed.has(key(id, version));
}

/**
 * Subscribe to install/uninstall events. Returns an unsubscribe
 * function. React components use this with a `useSyncExternalStore`
 * pattern to re-render when the installed set changes.
 */
export function subscribeInstalledPlugins(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
