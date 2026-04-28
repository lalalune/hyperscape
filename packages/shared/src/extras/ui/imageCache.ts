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

/** Error TTL — retry after 30 seconds so transient CDN failures don't permanently block images */
const ERROR_TTL_MS = 30_000;

interface ErrorEntry {
  status: "error";
  errorTime: number;
}

type CacheEntry = LoadingEntry | LoadedEntry | ErrorEntry;

const cache = new Map<string, CacheEntry>();
const insertionOrder: string[] = [];

/**
 * Evict oldest entries when cache exceeds MAX_CACHE_SIZE.
 * Skips entries that are still loading.
 */
function evictIfNeeded(): void {
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
      break;
    }
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
      // Coalesce callback
      existing.callbacks.push(onLoad);
      return null;
    }
    // Error — retry after TTL expires
    if (Date.now() - existing.errorTime < ERROR_TTL_MS) {
      return null;
    }
    cache.delete(url); // TTL expired, fall through to reload
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
      cb();
    }
    entry.callbacks.length = 0;
  });

  img.addEventListener("error", () => {
    const errorEntry: ErrorEntry = { status: "error", errorTime: Date.now() };
    cache.set(url, errorEntry);
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
