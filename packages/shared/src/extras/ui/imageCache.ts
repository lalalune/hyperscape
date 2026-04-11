/**
 * imageCache.ts - Async Image Loading Cache for UI Nodes
 *
 * Module-level singleton that loads and caches HTMLImageElement instances
 * for use with Canvas 2D drawImage(). Coalesces multiple load requests
 * per URL and triggers callbacks when images are ready.
 *
 * Used by UIImage nodes to render item icons, skill icons, and other
 * game assets loaded from the CDN.
 */

const isBrowser = typeof window !== "undefined";

/** Maximum cached images before evicting oldest entries */
const MAX_CACHE_SIZE = 256;

interface LoadingEntry {
  status: "loading";
  img: HTMLImageElement;
  callbacks: Array<() => void>;
}

interface LoadedEntry {
  status: "loaded";
  img: HTMLImageElement;
}

/** How long to cache a failed load before allowing retry (30 seconds). */
const ERROR_TTL_MS = 30_000;

interface ErrorEntry {
  status: "error";
  timestamp: number;
}

type CacheEntry = LoadingEntry | LoadedEntry | ErrorEntry;

const cache = new Map<string, CacheEntry>();
const insertionOrder: string[] = [];

/**
 * Evict oldest entries when cache exceeds MAX_CACHE_SIZE.
 * Skips entries that are still loading.
 */
function evictIfNeeded(): void {
  let attempts = 0;
  while (insertionOrder.length > MAX_CACHE_SIZE) {
    const oldestUrl = insertionOrder[0];
    const entry = cache.get(oldestUrl);
    if (entry && entry.status !== "loading") {
      cache.delete(oldestUrl);
      insertionOrder.shift();
    } else {
      // Don't evict loading entries; rotate to back
      insertionOrder.shift();
      if (oldestUrl) insertionOrder.push(oldestUrl);
    }
    if (++attempts >= insertionOrder.length) break; // all loading, give up
  }
}

/**
 * Load an image from the given URL, returning the HTMLImageElement
 * immediately if already cached, or null if still loading.
 *
 * The `onLoad` callback is called once the image finishes loading.
 * Multiple onLoad callbacks per URL are coalesced — only one
 * HTMLImageElement is created per unique URL.
 *
 * @param url - Pre-resolved HTTP URL (not asset:// — resolve before calling)
 * @param onLoad - Called when image is ready (used to trigger UI redraw)
 * @returns The loaded HTMLImageElement, or null if still loading/error
 */
export function loadCachedImage(
  url: string,
  onLoad: () => void,
): HTMLImageElement | null {
  if (!isBrowser || !url) return null;

  const existing = cache.get(url);

  if (existing) {
    if (existing.status === "loaded") {
      return existing.img;
    }
    if (existing.status === "loading") {
      // Coalesce callback — deduplicate by reference to avoid accumulation
      // from repeated draw() cycles (callers should cache their callback).
      if (!existing.callbacks.includes(onLoad)) {
        existing.callbacks.push(onLoad);
      }
      return null;
    }
    // Error — allow retry after TTL expires
    if (Date.now() - existing.timestamp < ERROR_TTL_MS) {
      return null;
    }
    // TTL expired, clear and fall through to re-load
    cache.delete(url);
    const idx = insertionOrder.indexOf(url);
    if (idx !== -1) insertionOrder.splice(idx, 1);
  }

  // Start new load
  evictIfNeeded();

  const img = new Image();
  img.crossOrigin = "anonymous";

  const entry: LoadingEntry = {
    status: "loading",
    img,
    callbacks: [onLoad],
  };
  cache.set(url, entry);
  insertionOrder.push(url);

  img.addEventListener("load", () => {
    const loadedEntry: LoadedEntry = { status: "loaded", img };
    cache.set(url, loadedEntry);
    // Fire all coalesced callbacks
    for (const cb of entry.callbacks) {
      try {
        cb();
      } catch (e) {
        console.error("[imageCache] callback error", e);
      }
    }
    entry.callbacks.length = 0;
  });

  img.addEventListener("error", () => {
    cache.set(url, { status: "error", timestamp: Date.now() });
    // Notify callers so they can show a placeholder or retry
    for (const cb of entry.callbacks) {
      try {
        cb();
      } catch (e) {
        console.error("[imageCache] error callback error", e);
      }
    }
    entry.callbacks.length = 0;
  });

  img.src = url;

  return null;
}

/**
 * Check if an image URL is already cached and loaded.
 */
export function isImageCached(url: string): boolean {
  const entry = cache.get(url);
  return entry !== undefined && entry.status === "loaded";
}

/**
 * Clear all cached images. Useful for memory cleanup on scene transitions.
 */
export function clearImageCache(): void {
  cache.clear();
  insertionOrder.length = 0;
}
