/**
 * Shared header fragments for the new orthogonal pack types
 * (`BiomePack`, `TerrainPack`, `WaterPack`, `VegetationPack`,
 * `ProjectPack`). See `PLAN_PACK_TYPES.md`.
 *
 * Each pack manifest carries the same identity + provenance
 * surface as `AssetPackManifest`: a globally unique id, a SemVer
 * `packVersion`, an author, license, tags, and a literal
 * `version: 1` (the schema version, separate from `packVersion`).
 *
 * Extracting these here keeps the per-type schemas focused on
 * what's actually unique to that type, and prevents drift
 * between the five pack kinds when the header surface evolves
 * (e.g. when a `signature` field gets added in a future supply-
 * chain phase).
 */

import { z } from "zod";
import { PluginAuthorSchema } from "./plugin.js";

/**
 * SemVer for pack versions — shared by every pack type. Same
 * regex as `asset-pack.ts` but exported so dependent packs (e.g.
 * `ProjectPack`) can reuse it for their own pinned-pack-version
 * fields.
 */
export const PackSemVerSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    "Pack version must look like '1.2.3' (SemVer)",
  );

/**
 * npm-style package id. Same shape as `AssetPackIdSchema` but
 * shared so every pack kind validates ids identically.
 */
export const PackIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^@?[a-z0-9][a-z0-9-_./]*$/i, {
    message: "Pack id must look like an npm-style package name",
  });
export type PackId = z.infer<typeof PackIdSchema>;

/**
 * Common identity + provenance fields every pack manifest carries.
 * Per-type schemas spread this into their object via
 * `PackHeaderShape` (see usage in `biome-pack.ts` etc.) so the
 * fields show up on the resolved type with no extra nesting.
 */
export const PackHeaderShape = {
  /**
   * Manifest schema version — bumped only when this package
   * makes a breaking change to the pack's shape. Unrelated to
   * the per-pack `packVersion`.
   */
  version: z.literal(1),
  id: PackIdSchema,
  name: z.string().min(1),
  description: z.string().default(""),
  /**
   * Per-pack SemVer (e.g. `"1.0.0"`). Pack manifests are
   * immutable per `packVersion` — a new cut ships as a new id
   * (`...-v2`) rather than mutating an existing version.
   */
  packVersion: PackSemVerSchema,
  author: PluginAuthorSchema,
  /** SPDX or `"UNLICENSED"`. Free-form to avoid pinning the SPDX list. */
  license: z.string().min(1).default("UNLICENSED"),
  /** Free-form tags applied to the whole pack. */
  tags: z.array(z.string()).default([]),
} as const;
