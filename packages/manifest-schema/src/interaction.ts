/**
 * Interaction manifest schema.
 *
 * Source of truth for session/interaction tuning values previously
 * hardcoded in `packages/shared/src/constants/interaction.ts`.
 * Extracted as part of Phase A10 of
 * `PLAN_WORLD_STUDIO_AAA_COMPLETION.md`.
 *
 * What lives here:
 *   - SessionType enum values (store/bank/dialogue)
 *   - Per-session-type max interaction distance (Chebyshev, tile-based-MMORPG-style)
 *   - Transaction rate limit (ms)
 *   - Session validation tick intervals
 *   - Generic input validation limits (item id / store id string length,
 *     max quantity, max request age, max clock skew, max inventory slots)
 *
 * What DOES NOT live here:
 *   - `MAX_BANK_SLOTS` — canonically in banking.json (still pulled by
 *     the façade from `BANKING_CONSTANTS`)
 */

import { z } from "zod";

export const SessionTypeValuesSchema = z.object({
  store: z.string().min(1),
  bank: z.string().min(1),
  dialogue: z.string().min(1),
});
export type SessionTypeValues = z.infer<typeof SessionTypeValuesSchema>;

export const InteractionDistanceSchema = z.object({
  store: z.number().positive(),
  bank: z.number().positive(),
  dialogue: z.number().positive(),
});
export type InteractionDistance = z.infer<typeof InteractionDistanceSchema>;

export const SessionConfigSchema = z.object({
  validationIntervalTicks: z.number().int().positive(),
  gracePeriodTicks: z.number().int().nonnegative(),
  maxSessionTicks: z.number().int().positive(),
});
export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export const InputLimitsSchema = z.object({
  maxItemIdLength: z.number().int().positive(),
  maxStoreIdLength: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
  maxInventorySlots: z.number().int().positive(),
  maxRequestAgeMs: z.number().int().positive(),
  maxClockSkewMs: z.number().int().nonnegative(),
});
export type InputLimits = z.infer<typeof InputLimitsSchema>;

export const InteractionManifestSchema = z.object({
  $schema: z.literal("hyperforge.interaction.v1"),
  sessionTypes: SessionTypeValuesSchema,
  interactionDistance: InteractionDistanceSchema,
  transactionRateLimitMs: z.number().int().positive(),
  sessionConfig: SessionConfigSchema,
  inputLimits: InputLimitsSchema,
});
export type InteractionManifest = z.infer<typeof InteractionManifestSchema>;
