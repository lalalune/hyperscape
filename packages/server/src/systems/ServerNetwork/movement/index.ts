/**
 * Movement Module - Barrel Export
 *
 * Server-side movement validation and anti-cheat systems.
 * Use these to validate all client movement requests before processing.
 *
 * @example
 * import {
 *   MovementInputValidator,
 *   MovementAntiCheat,
 *   MovementViolationSeverity
 * } from "./movement";
 */

// Input Validation
export {
  MovementInputValidator,
  MovementViolationSeverity,
} from "./MovementInputValidator";
export type {
  ValidatedMovePayload,
  MoveRequestValidation,
} from "./MovementInputValidator";

// Anti-Cheat Monitoring
export { MovementAntiCheat } from "./MovementAntiCheat";
