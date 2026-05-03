/**
 * Themed Content Pack Seeder — manual re-seed wrapper.
 *
 * Phase D / Phase F-prelude of `PLAN_AAA_CONTENT_SYSTEM.md`.
 * The canonical built-in pack catalog lives in
 * `server/builtins/content-packs.ts`; the asset-forge server
 * auto-bootstraps every built-in pack on start (no manual
 * seeder run required for first-boot or for picking up new
 * packs added in code).
 *
 * This script remains as a thin wrapper for the cases where a
 * manual re-seed is wanted:
 *   - re-seeding production without restarting the API
 *   - CI environments that want explicit pack-population
 *     control before tests run
 *   - debugging a corrupted pack row
 *
 * Usage:
 *   bun run packages/asset-forge/server/scripts/seed-themed-content-packs.ts
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
    `[seed-themed-content] done: ${ok}/${BUILTIN_CONTENT_PACKS.length} packs ready` +
      (failed > 0 ? ` (${failed} failed)` : ""),
  );
  await pool.end();
}

void main().catch((err) => {
  console.error("[seed-themed-content] failed:", err);
  process.exit(1);
});
