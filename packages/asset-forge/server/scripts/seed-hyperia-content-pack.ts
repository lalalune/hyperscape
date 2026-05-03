/**
 * Hyperia Content Pack Seeder — manual re-seed wrapper.
 *
 * Phase D of `PLAN_AAA_CONTENT_SYSTEM.md`. The canonical
 * Hyperia content pack now lives in
 * `server/builtins/content-packs.ts` alongside the five themed
 * packs (arctic / tropical / desert / volcanic / wetland), and
 * the asset-forge server auto-bootstraps every built-in pack
 * on start.
 *
 * This script remains as a thin wrapper that re-runs the SAME
 * upsert flow as the bootstrap, useful when:
 *   - re-seeding production without restarting the API
 *   - CI environments that want explicit pack-population
 *     control before tests run
 *   - debugging a corrupted pack row
 *
 * Equivalent to `seed-themed-content-packs.ts` (both call
 * `upsertBuiltinContentPacks`); kept for backward compat with
 * the older "Hyperia-only" seeder name.
 *
 * Usage:
 *   bun run packages/asset-forge/server/scripts/seed-hyperia-content-pack.ts
 */

import { Pool } from "pg";
import {
  BUILTIN_CONTENT_PACKS,
  upsertBuiltinContentPacks,
} from "../builtins/content-packs.js";

async function main(): Promise<void> {
  const url =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.FORGE_POSTGRES_USER || "forge"}:${process.env.FORGE_POSTGRES_PASSWORD || "forge_dev_password"}@localhost:${process.env.FORGE_POSTGRES_PORT || "5489"}/${process.env.FORGE_POSTGRES_DB || "forge"}`;
  const pool = new Pool({ connectionString: url });

  const { ok, failed } = await upsertBuiltinContentPacks(pool);
  console.log(
    `[seed-hyperia-content] done: ${ok}/${BUILTIN_CONTENT_PACKS.length} packs ready` +
      (failed > 0 ? ` (${failed} failed)` : ""),
  );
  await pool.end();
}

void main().catch((err) => {
  console.error("[seed-hyperia-content] failed:", err);
  process.exit(1);
});
