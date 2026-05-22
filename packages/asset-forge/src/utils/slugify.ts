/**
 * slugify — kebab-case a free-form string for use as an identifier
 * (pack id, manifest id, team slug, asset id).
 *
 * Algorithm: NFKD-normalize, strip combining marks, lowercase,
 * collapse non-alphanumeric to "-", trim leading/trailing dashes,
 * cap length.
 *
 *   "Medieval Weapons!"   → "medieval-weapons"
 *   "Café Olé"            → "cafe-ole"
 *   "  ---foo---bar  "    → "foo-bar"
 *
 * Single source of truth — every site that turns user text into an
 * id must call this. Callers that previously rolled their own
 * variant should pass an explicit `maxLength` if they need a tighter
 * cap (team slugs were historically capped at 48).
 */
export function slugify(input: string, maxLength = 60): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
