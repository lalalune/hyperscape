/**
 * XP curves manifest schema.
 *
 * Phase F1 of the World Studio AAA plan — authors describe how XP
 * scales into levels, either as a closed-form `formula` (e.g.
 * "rs-classic" matches the tile-based MMORPG 99-level table) or as an
 * explicit `lookup` table where entry `n` holds the cumulative XP
 * required to reach level `n+1`.
 *
 * A single manifest can bundle multiple curves keyed by `id`; game
 * code resolves a skill's curve by id so different skills can opt
 * into different progression shapes without forking the runtime.
 */

import { z } from "zod";

/**
 * Closed-form curve kind. Runtime evaluators map each enum value to
 * an XP(level) → number function; authors tweak `params` rather than
 * re-implementing the math.
 */
export const XpFormulaKindSchema = z.enum([
  "linear",
  "quadratic",
  "exponential",
  "rs-classic",
]);
export type XpFormulaKind = z.infer<typeof XpFormulaKindSchema>;

export const XpFormulaCurveSchema = z.object({
  kind: z.literal("formula"),
  formula: XpFormulaKindSchema,
  /** Maximum level this curve supports (>=2). */
  maxLevel: z.number().int().min(2),
  /**
   * Free-form numeric params consumed by the formula (e.g. `base`,
   * `growth`, `exponent`). Evaluator validates per-formula.
   */
  params: z.record(z.string().min(1), z.number()).default({}),
});
export type XpFormulaCurve = z.infer<typeof XpFormulaCurveSchema>;

export const XpLookupCurveSchema = z.object({
  kind: z.literal("lookup"),
  /**
   * Cumulative XP thresholds. `xp[0]` = XP to reach level 2; `xp[n]` =
   * XP to reach level `n+2`. Must be monotonically increasing; entries
   * must be non-negative integers.
   */
  xp: z.array(z.number().int().nonnegative()).min(1),
});
export type XpLookupCurve = z.infer<typeof XpLookupCurveSchema>;

export const XpCurveSchema = z
  .discriminatedUnion("kind", [XpFormulaCurveSchema, XpLookupCurveSchema])
  .and(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().default(""),
    }),
  );
export type XpCurve = z.infer<typeof XpCurveSchema>;

export const XpCurvesManifestSchema = z
  .array(XpCurveSchema)
  .refine((list) => new Set(list.map((c) => c.id)).size === list.length, {
    message: "curve ids must be unique",
  })
  .refine(
    (list) =>
      list.every(
        (c) =>
          c.kind !== "lookup" ||
          c.xp.every((v, i, arr) => i === 0 || v > arr[i - 1]!),
      ),
    { message: "lookup xp arrays must be strictly increasing" },
  );
export type XpCurvesManifest = z.infer<typeof XpCurvesManifestSchema>;
