/**
 * `@hyperforge/asset-pack-hyperia-trees-v1` — public entry.
 *
 * The asset pack itself ships static data (model URLs + species
 * metadata) loaded by every themed content pack that wants to
 * reuse the Hyperia tree models. The single public export today
 * is the parsed manifest; downstream packs read it to enumerate
 * available species.
 *
 * Phase 3.3 of PLAN_AAA_UE5_PARITY established this package as
 * the canonical home for the previously string-referenced
 * `@hyperforge/asset-pack-hyperia-trees-v1` id.
 */

export { manifest } from "./manifest.js";
