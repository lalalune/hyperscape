/**
 * Content-pack identifier constants.
 *
 * The agent installs content packs by manifest id, and the
 * studio detects "themed pack" status by id-prefix matching.
 * Both literals lived as magic strings in 8+ places before this
 * carve — centralising them here means renaming the npm scope
 * or the pack-id prefix is a single-line change.
 *
 * Note the distinction:
 *
 *   - `CONTENT_PACK_ID_PREFIX` matches ANY themed content pack
 *     (tropical / arctic / desert / volcanic / wetland / hyperia).
 *   - `HYPERIA_CONTENT_PACK_ID` is the canonical id for the
 *     Hyperia pack specifically — used as the default fallback
 *     when tag inference can't pick one.
 *   - `HYPERIA_CONTENT_PACK_PREFIX` matches any version of the
 *     Hyperia pack (v1 / v2 / etc.) — used by Hyperia-content
 *     gating that doesn't want to pin a specific version.
 */

/** Prefix every themed content pack's manifest id starts with. */
export const CONTENT_PACK_ID_PREFIX = "@hyperforge/content-pack-";

/** Canonical id of the Hyperia content pack (current latest). */
export const HYPERIA_CONTENT_PACK_ID = "@hyperforge/content-pack-hyperia-v1";

/** Version-agnostic prefix for any Hyperia content pack. */
export const HYPERIA_CONTENT_PACK_PREFIX = "@hyperforge/content-pack-hyperia-";

/**
 * Predicate: is this id any themed content pack (tropical / arctic /
 * desert / volcanic / wetland / hyperia / etc.)?
 */
export function isContentPackId(id: string): boolean {
  return id.startsWith(CONTENT_PACK_ID_PREFIX);
}

/**
 * Predicate: is this id any version of the Hyperia content pack
 * (e.g. `-hyperia-v1`, `-hyperia-v2`)?
 */
export function isHyperiaContentPackId(id: string): boolean {
  return id.startsWith(HYPERIA_CONTENT_PACK_PREFIX);
}
