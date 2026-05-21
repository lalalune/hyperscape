import { isContentPackId } from "./contentPackConstants";
/**
 * Tag-based themed-pack inference.
 *
 * Phase 1.2 eleventh carve from DesignWithAIDialog. Used as a
 * safety net when the agent stays silent on
 * `PROPOSE_ASSET_PACK_INSTALL`: the dialog walks the user's
 * conversation for tag overlap with the live themed-pack catalog
 * and picks the best match.
 *
 * Each themed content pack ships its own tags (e.g. tropical:
 * ["tropical", "jungle", "beach", "warm", "humid"]). Adding a
 * new themed pack is a data-only change — drop a manifest into
 * `server/builtins/content-packs.ts` with appropriate tags and
 * this matcher picks it up automatically. No client-side
 * keyword tables, no per-pack code changes.
 *
 * The agent's prompt-driven choice always takes precedence;
 * this only fires when the agent didn't propose a pack itself.
 */

interface MessageLike {
  readonly role: string;
  readonly text: string;
}

interface PackCatalogEntry {
  readonly manifestId: string;
  readonly tags: ReadonlyArray<string>;
}

/**
 * Generic tags every content pack carries — they don't
 * discriminate between themes so we ignore them when scoring.
 */
const GENERIC_TAGS = new Set(["content-pack", "built-in", "fork", "starter"]);

/**
 * Walk the conversation's user messages, score each themed pack
 * (canonical id prefix: `@hyperforge/content-pack-`) by tag-hit
 * count, return the manifestId with the highest score. Returns
 * null when the catalog is empty, there are no user messages,
 * or no pack has any tag overlap.
 */
export function inferThemedPackFromCatalog(
  messages: ReadonlyArray<MessageLike>,
  catalog: ReadonlyArray<PackCatalogEntry>,
): string | null {
  if (catalog.length === 0) return null;
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join(" ")
    .toLowerCase();
  if (!userText) return null;

  let bestPack: string | null = null;
  let bestHits = 0;
  for (const pack of catalog) {
    if (!isContentPackId(pack.manifestId)) continue;
    let hits = 0;
    for (const tag of pack.tags) {
      const tagLower = tag.toLowerCase();
      if (GENERIC_TAGS.has(tagLower)) continue;
      // Word-boundary check would be ideal but `includes` is
      // fine for our short catalogs — a false positive on
      // "snow" inside "snowflake" doesn't break anything.
      if (userText.includes(tagLower)) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestPack = pack.manifestId;
    }
  }
  return bestPack;
}
