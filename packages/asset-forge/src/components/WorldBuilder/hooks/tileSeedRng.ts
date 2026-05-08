/**
 * Deterministic per-tile LCG RNG used for client-side tree
 * placement. Matches the server's `createTileRng` byte-for-byte
 * so the same `(seed, tileX, tileZ, salt)` produces the same
 * stream on both sides — critical for visual parity between the
 * studio's preview and the live world.
 *
 * Phase 1.1 seventh carve from `TileBasedTerrain.tsx` (PLAN_AAA_MASTER_AUDIT
 * debt #2 — split the 5,000+ line monolith). Pure stateless
 * function; no React or scene refs. Salt-hash uses djb2-xor
 * (`hash = ((hash << 5) + hash) ^ ch`); LCG constants are the
 * Numerical Recipes pair (`a=1664525`, `c=1013904223`).
 *
 * The RNG is consumed in tight inner loops on tile generation,
 * so the implementation aggressively uses `>>> 0` to coerce to
 * uint32 — this is the canonical JS pattern for fixed-width
 * integer math and is what the server-side mirror does too. Do
 * not refactor to BigInt or signed math without updating the
 * server in lockstep — the streams must match.
 */

/**
 * Build a deterministic uniform-[0,1) RNG seeded by the tuple
 * `(baseSeed, tileX, tileZ, salt)`. Distinct `salt` values for
 * different uses (e.g. `"trees"`, `"rocks"`, `"flowers"`)
 * produce independent streams from the same base seed.
 */
export function createTileRng(
  baseSeed: number,
  tileX: number,
  tileZ: number,
  salt: string,
): () => number {
  const seed = baseSeed >>> 0;
  let saltHash = 5381 >>> 0;
  for (let i = 0; i < salt.length; i++) {
    saltHash = (((saltHash << 5) + saltHash) ^ salt.charCodeAt(i)) >>> 0;
  }
  let state =
    (seed ^
      ((tileX * 73856093) >>> 0) ^
      ((tileZ * 19349663) >>> 0) ^
      saltHash) >>>
    0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
