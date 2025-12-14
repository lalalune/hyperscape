/**
 * Combat Input Validation
 *
 * Centralized validation for all combat-related inputs.
 * Prevents injection attacks, validates entity IDs, and sanitizes display names.
 *
 * Security considerations:
 * - Entity IDs must match strict format to prevent injection
 * - All string inputs are length-limited
 * - Display names are HTML-escaped for XSS prevention
 */

/**
 * Entity ID validation pattern
 * Allows alphanumeric characters, underscores, and hyphens
 * Length: 1-128 characters
 */
const ENTITY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * UUID v4 validation pattern (for stricter validation if needed)
 */
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate entity ID format
 * Returns true if the ID is a valid string matching the entity ID pattern
 */
export function validateEntityId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id.length === 0 || id.length > 128) return false;
  return ENTITY_ID_PATTERN.test(id);
}

/**
 * Validate UUID v4 format (stricter than entity ID)
 */
export function validateUUID(id: unknown): id is string {
  if (typeof id !== "string") return false;
  return UUID_V4_PATTERN.test(id);
}

/**
 * Validate attack type (melee only for MVP)
 */
export function validateAttackType(type: unknown): type is "melee" | undefined {
  return type === "melee" || type === undefined || type === null;
}

/**
 * Combat request validation result
 */
export interface CombatRequestValidation {
  valid: boolean;
  error?: string;
  data?: {
    targetId: string;
    attackType: "melee";
  };
}

/**
 * Validate a complete combat attack request
 * Returns validation result with sanitized data or error message
 */
export function validateCombatRequest(data: unknown): CombatRequestValidation {
  // Check basic structure
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid request format" };
  }

  const payload = data as Record<string, unknown>;

  // Extract target ID (support both mobId and targetId for compatibility)
  const targetId = payload.mobId ?? payload.targetId;

  // Validate target ID
  if (!validateEntityId(targetId)) {
    return { valid: false, error: "Invalid target ID format" };
  }

  // Validate attack type (optional, defaults to melee)
  if (!validateAttackType(payload.attackType)) {
    return { valid: false, error: "Invalid attack type" };
  }

  return {
    valid: true,
    data: {
      targetId: targetId as string,
      attackType: "melee",
    },
  };
}

/**
 * Validate attack style change request
 */
export interface AttackStyleValidation {
  valid: boolean;
  error?: string;
  data?: {
    newStyle: string;
  };
}

const VALID_ATTACK_STYLES = [
  "accurate",
  "aggressive",
  "defensive",
  "controlled",
];

export function validateAttackStyleRequest(
  data: unknown,
): AttackStyleValidation {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid request format" };
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.newStyle !== "string") {
    return { valid: false, error: "Missing attack style" };
  }

  if (!VALID_ATTACK_STYLES.includes(payload.newStyle)) {
    return { valid: false, error: "Invalid attack style" };
  }

  return {
    valid: true,
    data: {
      newStyle: payload.newStyle,
    },
  };
}

/**
 * Sanitize display name (prevents XSS)
 * - Truncates to max length
 * - Escapes HTML entities
 */
export function sanitizeDisplayName(name: unknown, maxLength = 50): string {
  if (typeof name !== "string") return "Unknown";

  // Truncate to max length
  const truncated = name.slice(0, maxLength);

  // Escape HTML entities
  return truncated
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Rate limiting state for a player
 */
export interface RateLimitState {
  requestCount: number;
  windowStartTick: number;
  throttledUntilTick: number;
}

/**
 * Check if a player is currently rate limited
 */
export function isRateLimited(
  state: RateLimitState,
  currentTick: number,
): boolean {
  return currentTick < state.throttledUntilTick;
}

/**
 * Update rate limit state and check if request should be allowed
 * Returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  state: RateLimitState,
  currentTick: number,
  maxRequestsPerWindow: number,
  windowSizeTicks: number,
  throttleDurationTicks: number,
): boolean {
  // Check if currently throttled
  if (currentTick < state.throttledUntilTick) {
    return false;
  }

  // Reset window if expired
  if (currentTick >= state.windowStartTick + windowSizeTicks) {
    state.windowStartTick = currentTick;
    state.requestCount = 0;
  }

  // Increment request count
  state.requestCount++;

  // Check if over limit
  if (state.requestCount > maxRequestsPerWindow) {
    state.throttledUntilTick = currentTick + throttleDurationTicks;
    return false;
  }

  return true;
}

/**
 * Create initial rate limit state
 */
export function createRateLimitState(): RateLimitState {
  return {
    requestCount: 0,
    windowStartTick: 0,
    throttledUntilTick: 0,
  };
}
